import os
import sys
import types
import numpy as np
from PIL import Image
import subprocess
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

# ==========================================
# 1. APPLY MONKEY PATCHES (Crucial for SyncNet)
# ==========================================
def imresize(arr, size):
    img = Image.fromarray(arr)
    if isinstance(size, float):
        new_size = (int(img.width * size), int(img.height * size))
    elif isinstance(size, tuple):
        new_size = (size[1], size[0]) 
    else:
        new_size = size
    return np.array(img.resize(new_size, Image.BICUBIC))

# Inject dummy scipy.misc module
misc = types.ModuleType('scipy.misc')
misc.imresize = imresize
import scipy
scipy.misc = misc
sys.modules['scipy.misc'] = misc

# Fix numpy attribute errors
np.int = int
np.float = float
np.bool = bool

# ==========================================
# 2. FLASK SERVER SETUP
# ==========================================
app = Flask(__name__)
CORS(app) # Allow requests from your local frontend

# Configuration
UPLOAD_FOLDER = 'data'
OUTPUT_FOLDER = 'output'
# Create directories if they don't exist
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
if not os.path.exists(OUTPUT_FOLDER):
    os.makedirs(OUTPUT_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Server is running", "environment": "Conda User Space"}), 200

@app.route('/api/upload', methods=['POST'])
def process_video():
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Save the file
    filename = secure_filename(file.filename)
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)

    reference_name = f"run_{os.path.splitext(filename)[0]}"
    
    print(f"Processing {filename} with reference {reference_name}...")

    try:
        # 1. Run Pipeline (Face Detect + Audio Split)
        # We use the current python executable to ensure we stay in the conda env
        python_exe = sys.executable 
        
        pipeline_cmd = [
            python_exe, "run_pipeline.py",
            "--videofile", file_path,
            "--reference", reference_name,
            "--data_dir", os.path.join(OUTPUT_FOLDER, "temp")
        ]
        
        print("Running pipeline step...")
        subprocess.run(pipeline_cmd, check=True)

        # 2. Run SyncNet (Offset Calculation)
        syncnet_cmd = [
            python_exe, "run_syncnet.py",
            "--videofile", file_path,
            "--reference", reference_name,
            "--data_dir", os.path.join(OUTPUT_FOLDER, "temp")
        ]

        print("Running SyncNet step...")
        result = subprocess.run(syncnet_cmd, capture_output=True, text=True)
        output_log = result.stdout
        print(output_log)

        # 3. Parse the result using Regex
        offset_match = re.search(r"AV offset:\s+(-?\d+)", output_log)
        confidence_match = re.search(r"Confidence:\s+([\d\.]+)", output_log)

        offset = int(offset_match.group(1)) if offset_match else None
        confidence = float(confidence_match.group(1)) if confidence_match else None

        if offset is None:
            return jsonify({"error": "Could not calculate offset", "log": output_log}), 500

        return jsonify({
            "filename": filename,
            "offset_frames": offset,
            "confidence": confidence,
            "status": "success"
        })

    except subprocess.CalledProcessError as e:
        return jsonify({"error": "Processing script failed", "details": str(e)}), 500
    except Exception as e:
        return jsonify({"error": "Internal server error", "details": str(e)}), 500

if __name__ == '__main__':
    # Run on 0.0.0.0 so it can be accessed externally (if tunneling or firewall allows)
    app.run(host='0.0.0.0', port=5000)
