import sqlite3
import json

# Load your JSON file
with open('Frontend\dist\HSK3_0__Level_5.json', 'r', encoding='utf-8') as f:
    json_data = json.load(f)

# Connect to SQLite database
conn = sqlite3.connect('users.db')
cursor = conn.cursor()

# Ensure foreign keys are enforced
cursor.execute("PRAGMA foreign_keys = ON;")

# Insert each entry in order
for entry in json_data:
    chinese = entry['chinese']
    cursor.execute("INSERT INTO words (chinese, level_id) VALUES (?, ?)", (chinese, 11))

# Commit and close
conn.commit()
conn.close()
