from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import cv2
import numpy as np
import torch
from lib.utils.utils import strLabelConverter
import lib.models.crnn as crnn
import lib.config.alphabets as alphabets
import yaml
from easydict import EasyDict as edict
from io import BytesIO
from PIL import Image

app = Flask(__name__)
CORS(app, origins=["http://localhost:8000"])

# Load model at start
with open('lib/config/OWN_config.yaml', 'r') as f:
    config = yaml.load(f, Loader=yaml.FullLoader)
    config = edict(config)

config.DATASET.ALPHABETS = alphabets.alphabet
config.MODEL.NUM_CLASSES = len(config.DATASET.ALPHABETS)

device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')
model = crnn.get_crnn(config).to(device)
checkpoint = torch.load('output/checkpoints/mixed_second_finetune_acc_97P7.pth', map_location=device)
model.load_state_dict(checkpoint['state_dict'] if 'state_dict' in checkpoint else checkpoint)
model.eval()

converter = strLabelConverter(config.DATASET.ALPHABETS)

def preprocess_image(image_bytes):
    image = Image.open(BytesIO(image_bytes)).convert('L')  # grayscale
    img = np.array(image)

    h, w = img.shape
    img = cv2.resize(img, (0, 0), fx=config.MODEL.IMAGE_SIZE.H / h, fy=config.MODEL.IMAGE_SIZE.H / h)
    h, w = img.shape
    w_cur = int(w / (config.MODEL.IMAGE_SIZE.OW / config.MODEL.IMAGE_SIZE.W))
    img = cv2.resize(img, (0, 0), fx=w_cur / w, fy=1.0)
    img = np.reshape(img, (config.MODEL.IMAGE_SIZE.H, w_cur, 1))

    img = img.astype(np.float32)
    img = (img / 255. - config.DATASET.MEAN) / config.DATASET.STD
    img = img.transpose([2, 0, 1])
    img = torch.from_numpy(img).to(device).view(1, *img.shape)

    return img

@app.route('/recognize', methods=['POST'])
def recognize():
    data = request.get_json()
    base64_img = data['image'].split(',')[1]
    img_bytes = base64.b64decode(base64_img)
    img_tensor = preprocess_image(img_bytes)
    
    with torch.no_grad():
        preds = model(img_tensor)
        _, preds = preds.max(2)
        preds = preds.transpose(1, 0).contiguous().view(-1)
        preds_size = torch.IntTensor([preds.size(0)])
        result = converter.decode(preds.data, preds_size.data, raw=False)

    return jsonify({'result': result})

if __name__ == '__main__':
    app.run(debug=True)
