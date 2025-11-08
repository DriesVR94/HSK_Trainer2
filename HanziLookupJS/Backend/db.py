from flask import Flask, request, redirect, render_template
import sqlite3
import hashlib
import os

app = Flask(__name__)

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
    return render_template('home_page.html')

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
        print(f"✅ Successful login for: {email}")
        return {"success": True}, 200
    else:
        print(f"❌ Failed login attempt for: {email}")
        return {"success": False, "message": "Invalid email or password."}, 401



if __name__ == '__main__':
    app.run(debug=True)
