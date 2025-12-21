
from flask_cors import CORS
from ocr import ocr_bp   # ✅ IMPORT OCR MODULE
from flask import Flask, request, redirect, render_template, session, jsonify, url_for
import sqlite3, hashlib, os, json
from ocr import ocr_bp

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = "replace_this_with_a_strong_secret_key"

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(BASE_DIR, 'users.db')
print("Using database at:", db_path)


def create_connection():
    return sqlite3.connect(db_path)


@app.route('/register', methods=['POST'])
def register():
    email = request.form['email']
    password = request.form['password']
    hashed_pw = hashlib.sha256(password.encode()).hexdigest()

    conn = create_connection()
    cursor = conn.cursor()
    try:
        # 1️⃣ Insert user
        cursor.execute('INSERT INTO users (email, password) VALUES (?, ?)', (email, hashed_pw))
        user_id = cursor.lastrowid  # get the auto-incremented user ID

        # 2️⃣ Fetch all word IDs from 'vocabulary'
        cursor.execute('SELECT word_id FROM vocabulary')
        word_ids = [row[0] for row in cursor.fetchall()]

        # 3️⃣ Prepare entries for 'user_word_proficiency'
        # Each entry = (user_id, word_id, proficiency)
        entries = [(user_id, wid, 0) for wid in word_ids]

        # 4️⃣ Insert all in one batch
        cursor.executemany(
            'INSERT INTO user_word_proficiency (user_id, word_id, proficiency_level) VALUES (?, ?, ?)',
            entries
        )

        conn.commit()
    except sqlite3.IntegrityError:
        return "Email already exists!"
    except Exception as e:
        print("❌ Error registering user:", e)
        return "An error occurred while creating your account."
    finally:
        conn.close()

    return "User registered successfully!"

@app.route('/welcome_page')
def show_welcome_page():
    return render_template('welcome_page.html')


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
                LEFT JOIN user_word_proficiency uwp
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
                LEFT JOIN user_word_proficiency uwp
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

@app.route("/index")
def show_index_page():
    level = request.args.get("level", 1, type=int)   # ✅ default fallback
    return render_template("index.html", level=level)


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
        FROM user_word_proficiency uwp
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
    word_id = data.get("word_id")          # the word, may be multiple characters
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
        # 1️⃣ Get all character IDs for this word
        cursor.execute("""
            SELECT word_id, proficiency_level
            FROM user_word_proficiency
            WHERE user_id = ? AND word_id = ?
        """, (user_id, word_id))
        characters = cursor.fetchall()

        if not characters:
            return jsonify({"success": False, "message": "Word not found"}), 404

        # 2️⃣ Determine worst current proficiency among characters
        worst_current = min([c[1] for c in characters])

        # 3️⃣ Determine new proficiency for word (worst of existing vs new)
        updated_proficiency = min(worst_current, new_proficiency)

        # 4️⃣ Determine if word is "noob" (fail) or not (success)
        is_fail = 1 if updated_proficiency == 0 else 0
        is_success = 1 - is_fail

        # 5️⃣ Update all characters in the word, but only increment times_practiced once
        cursor.execute(f"""
            UPDATE user_word_proficiency
            SET
                proficiency_level = ?,
                last_practiced = CURRENT_TIMESTAMP,
                times_practiced = times_practiced + 1,
                successes = successes + ?,
                fails = fails + ?
            WHERE user_id = ? AND word_id = ?
        """, (updated_proficiency, is_success, is_fail, user_id, word_id))

        conn.commit()
        return jsonify({"success": True})

    finally:
        conn.close()

app.register_blueprint(ocr_bp)


if __name__ == '__main__':
    app.run(debug=True)
