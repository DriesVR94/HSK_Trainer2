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


if __name__ == '__main__':
    app.run(debug=True)
