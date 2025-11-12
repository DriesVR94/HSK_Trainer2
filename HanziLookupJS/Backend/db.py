from flask import Flask, request, redirect, render_template, session, jsonify, url_for
import sqlite3, hashlib, os, json

app = Flask(__name__)
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

        # 2️⃣ Fetch all word IDs from 'words'
        cursor.execute('SELECT word_id FROM words')
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

        # --- Fetch total word counts per level + user mastery counts ---
    counts = {}
    mastered = {}

    try:
        # 🟩 Get user_id from email
        cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
        user_row = cursor.fetchone()
        user_id = user_row[0] if user_row else None

        # 🟩 HSK 2.0: total counts
        for i in range(1, 7):
            cursor.execute("SELECT COUNT(*) FROM words WHERE level_id = ?", (i,))
            counts[f"HSK2_0__Level_{i}"] = cursor.fetchone()[0]

        # 🟩 HSK 2.0: mastered counts
        for i in range(1, 7):
            cursor.execute("""
                SELECT COUNT(*) 
                FROM user_word_proficiency
                JOIN words ON user_word_proficiency.word_id = words.word_id
                WHERE user_word_proficiency.user_id = ? AND user_word_proficiency.proficiency_level = 3 AND words.level_id = ?
            """, (user_id, i))
            mastered[f"HSK2_0__Level_{i}"] = cursor.fetchone()[0]

        # 🟦 HSK 3.0: total counts
        for i in range(1, 8):
            cursor.execute("SELECT COUNT(*) FROM words WHERE level_id = ?", (i + 6,))
            counts[f"HSK3_0__Level_{i}"] = cursor.fetchone()[0]

        # 🟦 HSK 3.0: mastered counts
        for i in range(1, 8):
            cursor.execute("""
                SELECT COUNT(*) 
                FROM user_word_proficiency
                JOIN words ON user_word_proficiency.word_id = words.word_id
                WHERE user_word_proficiency.user_id = ? AND user_word_proficiency.proficiency_level = 3 AND words.level_id = ?
            """, (user_id, i + 6))
            mastered[f"HSK3_0__Level_{i}"] = cursor.fetchone()[0]

    except sqlite3.OperationalError as e:
        print("⚠️ Could not fetch counts:", e)
        counts = {f"HSK2_0__Level_{i}": 0 for i in range(1, 7)}
        counts.update({f"HSK3_0__Level_{i}": 0 for i in range(1, 8)})
        mastered = {k: 0 for k in counts.keys()}

    except sqlite3.OperationalError as e:
        print("⚠️ Could not fetch HSK level counts from words:", e)
        counts = {f"HSK2_0__Level_{i}": 0 for i in range(1, 7)}
        counts.update({f"HSK3_0__Level_{i}": 0 for i in range(1, 8)})

    conn.close()

    return render_template(
    'home_page.html',
    user_email=email,
    savedLevels=selected_levels,
    counts=counts,
    mastered=mastered
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


if __name__ == '__main__':
    app.run(debug=True)
