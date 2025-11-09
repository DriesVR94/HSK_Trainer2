from flask import Flask, request, redirect, render_template, session, jsonify, url_for
import sqlite3, hashlib, os, json
import hashlib
import os

app = Flask(__name__)
app.secret_key = "replace_this_with_a_strong_secret_key"


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(BASE_DIR, 'users.db')
print("Using database at:", db_path)


def create_connection():
    return sqlite3.connect(db_path)

@app.route('/register', methods=['POST'])
def register():
    #username = request.form['username']
    email = request.form['email']
    password = request.form['password']
    
    # Basic password hashing
    hashed_pw = hashlib.sha256(password.encode()).hexdigest()

    print(f"📩 Attempting to register: {email}")

    conn = create_connection()
    cursor = conn.cursor()
    try:
        #cursor.execute('INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
        cursor.execute('INSERT INTO users (email, password) VALUES (?, ?)',
                       #(username, email, hashed_pw))
                       (email, hashed_pw))
        conn.commit()
        print("✅ Insert successful.")
    except sqlite3.IntegrityError as e:
        print("⚠️ IntegrityError:", e)
        return "Username or Email already exists!"
    except Exception as e:
        print("❌ Other error during insert:", e)
        return f"An error occurred: {e}"
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
    cursor.execute('SELECT selected_levels FROM users WHERE email = ?', (email,))
    row = cursor.fetchone()
    conn.close()

    # Safely load JSON from database or default to an empty list
    selected_levels = json.loads(row[0]) if row and row[0] else []

    # ✅ Don't call json.dumps() here
    # ✅ Match variable name with template (savedLevels, not saved_levels)
    return render_template('home_page.html', user_email=email, savedLevels=selected_levels)


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
        print(f"✅ Successful login for: {email}")
        return {"success": True}, 200
    else:
        print(f"❌ Failed login attempt for: {email}")
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

        print(f"💾 Saved levels for {email}: {levels}")
        return jsonify({"success": True})
    except Exception as e:
        print("❌ Error saving levels:", e)
        return jsonify({"success": False, "message": str(e)}), 500



if __name__ == '__main__':
    app.run(debug=True)
