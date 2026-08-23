
from flask_cors import CORS
from flask import Flask, request, redirect, render_template, session, jsonify, url_for, flash
import sqlite3, hashlib, os, json, tempfile, base64, smtplib
from datetime import datetime
from paddleocr import PaddleOCR
from email.message import EmailMessage
#from Backend.ocr import ocr_bp  # Not needed for production.

app = Flask(__name__)

app.secret_key = os.environ.get(
    "SECRET_KEY",
    "dev-secret-key-change-this"
)

is_production = os.environ.get("RENDER") == "true"

app.config.update(
    SESSION_COOKIE_SECURE=is_production,
    SESSION_COOKIE_SAMESITE="None" if is_production else "Lax"
)

CORS(
    app,
    supports_credentials=True,
    origins=[
        "https://hsk-hero.onrender.com",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ]
)

paddle_ocr = PaddleOCR(
    lang="ch",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False
)


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(BASE_DIR, 'users.db')
print("Using database at:", db_path)
print("Database exists:", os.path.exists(db_path))

average_stroke_count = 9 # The average HSK character contains ca. 9 strokes
weighing_parameter = 5 # This one is set manually. A higher weighing_parameter results in a lower forgetting_rate, and hence a higher recall_score

def recall_score(times_practiced, successes, fails, stroke_counts, time_passed, proficiency_score,):

    max_strokes = max(stroke_counts)
    r_h = times_practiced * (successes / (fails + 1))                   # r_h = review_history
    f_r = max_strokes / (weighing_parameter * max(times_practiced, 1))  # f_r = forgetting_rate
    d   = average_stroke_count / max_strokes                            # difficulty
    r_s = (r_h - (f_r * time_passed) + d) * proficiency_score           # r_s = recall_score
    return r_s

def initialize_user_proficiency(cursor, user_id):
    """
    Create proficiency records for all vocabulary words
    for a new user. All words start at proficiency level 0 (Noob).
    """

    # Fetch all vocabulary words
    cursor.execute('SELECT word_id FROM vocabulary')
    word_ids = [row[0] for row in cursor.fetchall()]

    # Create initial proficiency entries
    entries = [(user_id, wid, 0) for wid in word_ids]

    cursor.executemany(
        """
        INSERT INTO user_word_proficiency_new
        (user_id, word_id, proficiency_level)
        VALUES (?, ?, ?)
        """,
        entries
    )


def create_connection():
    return sqlite3.connect(db_path)

def send_contact_email(name, user_email, user_message):

    smtp_server = os.environ['MAIL_SERVER']
    smtp_port = int(os.environ.get('MAIL_PORT', 587))
    smtp_username = os.environ['MAIL_USERNAME']
    smtp_password = os.environ['MAIL_PASSWORD']
    recipient = os.environ['CONTACT_EMAIL']

    msg = EmailMessage()

    msg['Subject'] = f'HSK Hero contact form - {name}'

    # Your own authenticated account should be the sender
    msg['From'] = smtp_username

    # The message gets delivered to you
    msg['To'] = recipient

    # Pressing Reply in your mail client replies to the user
    msg['Reply-To'] = user_email

    msg.set_content(
        f"""
New HSK Hero contact message

Name:
{name}

Email:
{user_email}

Message:
{user_message}
"""
    )

    with smtplib.SMTP(smtp_server, smtp_port) as server:
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg)


@app.route('/register', methods=['POST'])
def register():
    email = request.form['email']
    password = request.form['password']
    hashed_pw = hashlib.sha256(password.encode()).hexdigest()

    conn = create_connection()
    cursor = conn.cursor()

    try:
        # Create user
        cursor.execute(
            'INSERT INTO users (email, password) VALUES (?, ?)',
            (email, hashed_pw)
        )

        user_id = cursor.lastrowid

        # Initialize all vocabulary as Noob
        initialize_user_proficiency(cursor, user_id)

        conn.commit()

    except sqlite3.IntegrityError:
        return "Email already exists!"

    except Exception as e:
        print("❌ Error registering user:", e)
        return "An error occurred while creating your account."

    finally:
        conn.close()

    return "You registered successfully!"

@app.route('/welcome_page')
def show_welcome_page():
    current_year = datetime.now().year
    return render_template('welcome_page.html', current_year=current_year)

@app.route('/contact')
def show_contact_page():
    return render_template('contact_page.html')

@app.route('/contact/submit', methods=['POST'])
def submit_contact():

    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    message = request.form.get('message', '').strip()

    # Basic validation
    if not name or not email or not message:
        flash('Please complete all fields.', 'error')
        return redirect(url_for('show_contact_page'))

    if len(name) > 100 or len(email) > 254 or len(message) > 5000:
        flash('Your message is too long.', 'error')
        return redirect(url_for('show_contact_page'))

    try:
        send_contact_email(name, email, message)

    except Exception as e:
        print(f"Contact form email error: {e}")

        flash(
            'Something went wrong while sending your message. Please try again.',
            'error'
        )

        return redirect(url_for('show_contact_page'))

    flash(
        'Thanks! Your message has been sent.',
        'success'
    )

    return redirect(url_for('show_contact_page'))

@app.route('/terms_and_conditions')
def show_terms_and_conditions():
    current_year = datetime.now().year
    return render_template('terms_and_conditions.html', current_year=current_year)

@app.route('/privacy')
def show_privacy_policy():
    return render_template('privacy_policy.html')

@app.route('/registration_page')
def show_registration_page():
    return render_template('registration_page.html')


@app.route('/home_page')
def show_home_page():
    if 'user_email' not in session:
        return redirect(url_for('show_signin_page'))

    email = session['user_email']

    conn = create_connection()
    cursor = conn.cursor()

    # Get saved levels
    cursor.execute('SELECT selected_levels FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    selected_levels = json.loads(row[0]) if row and row[0] else []

    counts = {}
    mastered = {}
    proficiency_counts = {}

    try:
        # Get user_id
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_row = cursor.fetchone()
        user_id = user_row[0] if user_row else None
        if not user_id:
            raise ValueError("User not found")

        # --- HSK 2.0: total counts per level ---
        for level in range(1, 7):
            cursor.execute("SELECT COUNT(*) FROM vocabulary WHERE level_id = ?", (level,))
            counts[f"HSK2_0__Level_{level}"] = cursor.fetchone()[0]

        # --- HSK 2.0: proficiency counts ---
        for level in range(1, 7):
            for prof in range(0, 4):
                key = f"HSK2_0__Level_{level}__Prof_{prof}"
                proficiency_counts[key] = 0  # default

            cursor.execute("""
                WITH prof_levels AS (
                    SELECT 0 AS prof
                    UNION ALL SELECT 1
                    UNION ALL SELECT 2
                    UNION ALL SELECT 3
                )
                SELECT pl.prof, COUNT(uwp.word_id)
                FROM prof_levels pl
                LEFT JOIN user_word_proficiency_new uwp
                    ON uwp.proficiency_level = pl.prof
                    AND uwp.user_id = ?
                    AND uwp.word_id IN (SELECT word_id FROM vocabulary WHERE level_id = ?)
                GROUP BY pl.prof
                ORDER BY pl.prof
            """, (user_id, level))

            for prof_level, count in cursor.fetchall():
                proficiency_counts[f"HSK2_0__Level_{level}__Prof_{prof_level}"] = count

        # --- HSK 3.0: total counts + PROFICIENCY COUNTS (FULL FIX) ---
        for level in range(1, 8):
            level_id = level + 6  # HSK3.0 levels start after HSK2.0

            # Total word counts
            cursor.execute("SELECT COUNT(*) FROM vocabulary WHERE level_id = ?", (level_id,))
            counts[f"HSK3_0__Level_{level}"] = cursor.fetchone()[0]

            # Initialize all proficiency levels to 0
            for prof_lv in range(0, 4):
                proficiency_counts[f"HSK3_0__Level_{level}__Prof_{prof_lv}"] = 0

            # Fetch proficiency breakdown
            cursor.execute("""
                WITH prof_levels AS (
                    SELECT 0 AS prof
                    UNION ALL SELECT 1
                    UNION ALL SELECT 2
                    UNION ALL SELECT 3
                )
                SELECT pl.prof, COUNT(uwp.word_id)
                FROM prof_levels pl
                LEFT JOIN user_word_proficiency_new uwp
                    ON uwp.proficiency_level = pl.prof
                    AND uwp.user_id = ?
                    AND uwp.word_id IN (
                        SELECT word_id FROM vocabulary WHERE level_id = ?
                    )
                GROUP BY pl.prof
                ORDER BY pl.prof
            """, (user_id, level_id))

            for prof_level, count in cursor.fetchall():
                proficiency_counts[f"HSK3_0__Level_{level}__Prof_{prof_level}"] = count

            # Expert words = Prof 3
            mastered[f"HSK3_0__Level_{level}"] = \
                proficiency_counts[f"HSK3_0__Level_{level}__Prof_3"]


    except Exception as e:
        print("⚠️ Could not fetch counts:", e)

        counts = {f"HSK2_0__Level_{i}": 0 for i in range(1, 7)}
        counts.update({f"HSK3_0__Level_{i}": 0 for i in range(1, 8)})

        mastered = {k: 0 for k in counts.keys()}

        proficiency_counts = {
            **{f"HSK2_0__Level_{i}__Prof_{p}": 0 for i in range(1, 7) for p in range(0, 4)},
            **{f"HSK3_0__Level_{i}__Prof_{p}": 0 for i in range(1, 8) for p in range(0, 4)}
        }


    finally:
        conn.close()

    return render_template(
        'home_page.html',
        user_email=email,
        savedLevels=selected_levels,
        counts=counts,
        mastered=mastered,
        prof=proficiency_counts
    )

@app.route('/signin_page')
def show_signin_page():
    return render_template('signin_page.html')

@app.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return {"success": False, "message": "Email and password are required."}, 400

    hashed_pw = hashlib.sha256(password.encode()).hexdigest()

    conn = create_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT password FROM users WHERE email = ?', (email,))
    result = cursor.fetchone()
    conn.close()

    if result and result[0] == hashed_pw:
        session['user_email'] = email
        return {"success": True}, 200
    else:
        return {"success": False, "message": "Invalid email or password."}, 401

@app.route("/test_page")
def show_test_page():
    level = request.args.get("level", 1, type=int)   # ✅ default fallback
    return render_template("test_page.html", level=level)

@app.route("/study_page")
def show_study_page():
    return render_template("study_page.html")


@app.route("/save_levels", methods=["POST"])
def save_levels():
    if 'user_email' not in session:
        return jsonify({"success": False, "message": "User not logged in"}), 401

    email = session['user_email']
    data = request.get_json() or {}
    levels = data.get('levels', [])

    try:
        conn = create_connection()
        cursor = conn.cursor()
        cursor.execute(
            'UPDATE users SET selected_levels = ? WHERE email = ?',
            (json.dumps(levels), email)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print("❌ Error saving levels:", e)
        return jsonify({"success": False, "message": str(e)}), 500

@app.route("/get_vocabulary")
def get_vocabulary():
    level = request.args.get("level", type=int)

    conn = create_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT word_id, chinese, pinyin, english, char_count, stroke_counts
        FROM vocabulary
        WHERE level_id = ?
    """, (level,))

    rows = cursor.fetchall()
    conn.close()

    data = [
        {
            "word_id": row[0],
            "chinese": row[1],
            "pinyin": row[2],
            "english": row[3],
            "charCount": row[4],
            "strokeCounts": json.loads(row[5])
        }
        for row in rows
    ]

    return jsonify(data)

@app.route("/get_progress")
def get_progress():
    if "user_email" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    level = request.args.get("level", type=int)
    if level is None:
        return jsonify({"success": False, "message": "Missing level"}), 400

    conn = create_connection()
    cursor = conn.cursor()

    # 1️⃣ Get user_id
    cursor.execute("SELECT id FROM users WHERE email = ?", (session["user_email"],))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404

    user_id = row[0]

    # 2️⃣ Query counts per proficiency from user_word_proficiency
    cursor.execute("""
        SELECT 
            proficiency_level, 
            COUNT(*) 
        FROM user_word_proficiency_new uwp
        JOIN vocabulary v ON uwp.word_id = v.word_id
        WHERE uwp.user_id = ? AND v.level_id = ?
        GROUP BY proficiency_level
    """, (user_id, level))

    rows = cursor.fetchall()
    conn.close()

    # 3️⃣ Map DB values → category names
    result = {
        "expert": 0,
        "good": 0,
        "familiar": 0,
        "noob": 0,
        "total": 0
    }

    mapping = {
        3: "expert",
        2: "good",
        1: "familiar",
        0: "noob"
    }

    for (prof_level, count) in rows:
        key = mapping.get(prof_level)
        if key:
            result[key] = count
            result["total"] += count

    return jsonify(result)


@app.route("/update_proficiency", methods=["POST"])
def update_proficiency():
    if "user_email" not in session:
        return jsonify({"success": False, "message": "Not logged in"}), 401

    data = request.get_json() or {}
    word_id = data.get("word_id")
    new_proficiency = data.get("proficiency")

    if word_id is None or new_proficiency is None:
        return jsonify({"success": False, "message": "Missing parameters"}), 400

    conn = create_connection()
    cursor = conn.cursor()

    # Get user_id
    cursor.execute("SELECT id FROM users WHERE email = ?", (session["user_email"],))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return jsonify({"success": False, "message": "User not found"}), 404
    user_id = row[0]

    try:
        # 1️⃣ Get all character data for this word
        cursor.execute("""
            SELECT times_practiced, successes, fails, last_practiced
            FROM user_word_proficiency_new
            WHERE user_id = ? AND word_id = ?
        """, (user_id, word_id))
        user_data = cursor.fetchone()
        if not user_data:
            return jsonify({"success": False, "message": "Word not found"}), 404

        times_practiced, successes, fails, last_practiced = user_data

        # 2️⃣ Get stroke data
        cursor.execute("""
            SELECT stroke_counts
            FROM vocabulary
            WHERE word_id = ?
        """, (word_id,))
        row = cursor.fetchone()
        if not row:
            return jsonify({"success": False, "message": "Vocabulary data not found"}), 404

        stroke_counts = json.loads(row[0])  # ✅ JSON → list[int]

        # 3️⃣ Time passed
        if last_practiced:
            last_practiced_dt = datetime.strptime(last_practiced, "%Y-%m-%d %H:%M:%S")
            time_passed = (datetime.now() - last_practiced_dt).total_seconds() / 86400
        else:
            time_passed = 0

        # 4️⃣ Compute recall score
        rs = recall_score(
            times_practiced,
            successes,
            fails,
            stroke_counts,
            time_passed,
            new_proficiency
        )

        # 5️⃣ Update user_word_proficiency
        is_fail = 1 if new_proficiency == 0 else 0
        is_success = 1 - is_fail

        cursor.execute("""
            UPDATE user_word_proficiency_new
            SET
                proficiency_level = ?,
                last_practiced = CURRENT_TIMESTAMP,
                times_practiced = times_practiced + 1,
                successes = successes + ?,
                fails = fails + ?,
                recall_score = ROUND(?, 2)
            WHERE user_id = ? AND word_id = ?
        """, (new_proficiency, is_success, is_fail, rs, user_id, word_id))


        conn.commit()
        return jsonify({"success": True, "recall_score": rs})

    finally:
        conn.close()

@app.route("/")
def home():
    return "HSK Hero API is running 🚀"

@app.route("/health")
def health():
    return {"status": "ok"}


@app.route("/auth/google", methods=["POST"])
def google_auth():
    data = request.get_json()
    access_token = data.get("access_token")

    if not access_token:
        return jsonify({"success": False, "message": "No token"}), 400

    import requests

    google_response = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"}
    )

    if google_response.status_code != 200:
        return jsonify({"success": False, "message": "Invalid Google token"}), 401

    user_info = google_response.json()
    email = user_info["email"]

    conn = create_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT id FROM users WHERE email = ?",
            (email,)
        )

        user = cursor.fetchone()

        if not user:
            # Create new Google user
            cursor.execute(
                """
                INSERT INTO users (email, password)
                VALUES (?, ?)
                """,
                (email, "GOOGLE_AUTH")
            )

            user_id = cursor.lastrowid

            # Initialize vocabulary progress
            initialize_user_proficiency(cursor, user_id)

            conn.commit()

        else:
            user_id = user[0]

    except Exception as e:
        print("❌ Google auth error:", e)
        conn.rollback()
        return jsonify({
            "success": False,
            "message": "Account creation failed"
        }), 500

    finally:
        conn.close()

    session["user_email"] = email

    return jsonify({"success": True})

# app.register_blueprint(ocr_bp) # Not needed for production.

@app.route("/recognize_paddle", methods=["POST"])
def recognize_paddle():

    data = request.get_json(silent=True)

    if not data or "image" not in data:
        return jsonify({
            "success": False,
            "error": "Missing image"
        }), 400

    image_data_url = data["image"]

    try:

        if "," not in image_data_url:
            return jsonify({
                "success": False,
                "error": "Invalid image data URL"
            }), 400

        _, encoded = image_data_url.split(",", 1)

        image_bytes = base64.b64decode(encoded)

        # PaddleOCR can work with image paths,
        # so write the canvas image to a temporary PNG.
        with tempfile.NamedTemporaryFile(
            suffix=".png",
            delete=False
        ) as tmp:

            tmp.write(image_bytes)
            temp_path = tmp.name

        try:

            results = paddle_ocr.predict(
                temp_path
            )

            recognized_text = ""

            for result in results:

                data_dict = result.json

                if callable(data_dict):
                    data_dict = data_dict()

                # PaddleOCR 3.x stores recognized strings
                # in rec_texts in OCR pipeline results.
                if isinstance(data_dict, dict):

                    res = data_dict.get(
                        "res",
                        data_dict
                    )

                    texts = res.get(
                        "rec_texts",
                        []
                    )

                    if texts:
                        recognized_text = "".join(texts)
                        break

            return jsonify({
                "success": True,
                "result": recognized_text.strip()
            })

        finally:

            if os.path.exists(temp_path):
                os.remove(temp_path)

    except Exception as exc:

        app.logger.exception(
            "PaddleOCR recognition failed"
        )

        return jsonify({
            "success": False,
            "error": str(exc)
        }), 500



if __name__ == '__main__':
    app.run(debug=True)
