import sqlite3
import json

# Connect to your SQLite database
conn = sqlite3.connect('users.db')
cur = conn.cursor()

# Load your JSON file
with open('Backend/static/dist/HSK3_0__Level_7-9.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Example: assign level_id yourself (e.g., 1 for beginner)
level_id_to_assign = 13

# Insert each word into the database
for entry in data:
    cur.execute("""
        INSERT INTO vocabulary (chinese, level_id, pinyin, english, char_count, stroke_counts)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        entry["chinese"],
        level_id_to_assign,           # <-- your custom level_id
        entry["pinyin"],
        entry["english"],
        entry["charCount"],
        json.dumps(entry["strokeCounts"])  # convert list to JSON string
    ))

# Commit and close
conn.commit()
conn.close()
