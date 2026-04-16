from flask import Blueprint, request, jsonify
import base64, torch, yaml, cv2
import numpy as np
from easydict import EasyDict as edict
from io import BytesIO
from PIL import Image
from Backend.lib.utils.utils import strLabelConverter
import Backend.lib.models.crnn as crnn
import Backend.lib.config.alphabets as alphabets

ocr_bp = Blueprint("ocr", __name__)   # ✅ NO url_prefix here

# ---- LOAD MODEL ONCE ----
with open('lib/config/OWN_config.yaml', 'r') as f:
    config = yaml.load(f, Loader=yaml.FullLoader)
    config = edict(config)

config.DATASET.ALPHABETS = alphabets.alphabet
config.MODEL.NUM_CLASSES = len(config.DATASET.ALPHABETS)

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
model = crnn.get_crnn(config).to(device)
checkpoint = torch.load(
    'output/checkpoints/mixed_second_finetune_acc_97P7.pth',
    map_location=device
)
model.load_state_dict(checkpoint.get('state_dict', checkpoint))
model.eval()

converter = strLabelConverter(config.DATASET.ALPHABETS)


def preprocess_image(image_bytes):
    """Convert base64 bytes to normalized CRNN input tensor safely for small images."""
    image = Image.open(BytesIO(image_bytes)).convert('L')
    img = np.array(image)

    orig_h, orig_w = img.shape

    # --- Scale height to target ---
    target_h = config.MODEL.IMAGE_SIZE.H
    scale = target_h / orig_h
    new_w = max(int(orig_w * scale), 32)  # minimum width 32 px to avoid conv error
    img = cv2.resize(img, (new_w, target_h))

    # Optional: further width adjustment based on model's expected aspect
    w_cur = int(img.shape[1] / (config.MODEL.IMAGE_SIZE.OW / config.MODEL.IMAGE_SIZE.W))
    w_cur = max(w_cur, 32)
    img = cv2.resize(img, (w_cur, target_h))

    # --- Normalize ---
    img = img.astype(np.float32)
    img = (img / 255.0 - config.DATASET.MEAN) / config.DATASET.STD

    # --- HxW -> WxH and add batch & channel ---
    img = img.transpose([1, 0])
    img_tensor = torch.from_numpy(img).to(device).unsqueeze(0).unsqueeze(0)

    return img_tensor


@ocr_bp.route("/recognize", methods=["POST"])
def recognize():
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "Missing image"}), 400

    try:
        # Remove prefix if present
        base64_img = data["image"].split(",")[1] if "," in data["image"] else data["image"]
        img_bytes = base64.b64decode(base64_img)

        img_tensor = preprocess_image(img_bytes)

        with torch.no_grad():
            preds = model(img_tensor)
            _, preds = preds.max(2)
            preds = preds.transpose(1, 0).contiguous().view(-1)
            preds_size = torch.IntTensor([preds.size(0)])
            result = converter.decode(preds.data, preds_size.data, raw=False)

        return jsonify({"result": result})

    except Exception as e:
        print("❌ OCR ERROR:", e)
        return jsonify({"error": str(e)}), 500
