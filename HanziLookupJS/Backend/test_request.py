import requests
import base64
import json

# Load and encode the image
with open("C:/Users/Dries Van Ranst/OneDrive/Bureaublad/gao.png", "rb") as f:
    img_bytes = f.read()
    base64_img = base64.b64encode(img_bytes).decode()

# Compose payload (make sure to include prefix 'data:image/png;base64,')
payload = {
    "image": "data:image/png;base64," + base64_img
}

response = requests.post("http://127.0.0.1:5000/recognize", json=payload)
print("Status code:", response.status_code)
#Option A: print with ASCII escapes (safe for all consoles)
print("Response JSON:", json.dumps(response.json(), ensure_ascii=True))

# Option B: encode/decode workaround for UTF-8 console (if your console supports it)
print("Response JSON:", json.dumps(response.json(), ensure_ascii=False).encode('utf8').decode())

