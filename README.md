# StreamSync

StreamSync is a real-time audio-video offset detection and synchronization tool built using **React**, **FFmpeg WASM**, and a **Python backend**. It allows users to upload a video and audio track, computes their alignment offset using custom logic, and provides utilities to correct the offset and download the synced output.

---

## 🚀 Features

* **Video + Audio Upload UI** (React + Vite + TypeScript)
* **FFmpeg WASM Integration** for browser-side processing
* **Real-Time Offset Detection** using Python (Flask / FastAPI)
* **Supports Multiple FPS Formats** including 25, 30, and 60 FPS
* **Sync Correction**: Apply offset and preview the corrected video
* **Download Synced Output** as MP4/WebM
* **Secure Upload API** (supports HTTPS)

---

## 🧩 Tech Stack

### Frontend

* React + Vite + TypeScript
* FFmpeg WASM (`@ffmpeg/ffmpeg`)
* Tailwind CSS (optional styling)

### Backend

* Python Flask/FastAPI
* FFmpeg (native) for server-side verification and fps extraction
---

## 📁 Project Structure

```bash
streamsync/
│── frontend/             # React + Vite + TS App
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── StreamSyncUpload.tsx
│
│── backend/              # Python Flask/FastAPI Server
│   ├── main.py
│   ├── utils.py
│   └── requirements.txt
│
└── README.md
```

---

## ⚙️ How It Works

1. User uploads a **video** file with AV Offsync problem to the Backend.
3. Backend computes:
   * FPS of the video
   * Offset between audio and video frames
4. Offset formula:
```python
offset_ms = round((offset_frames / fps) * 1000)
```
5. Frontend applies the offset using FFmpeg WASM without re-uploading.
6. User previews and downloads the corrected output.

---

## 🖥️ Running Locally

### 1️⃣ Frontend Setup

```bash
cd streamsync-frontend
npm install
npm run dev
```

### 2️⃣ Backend Setup (NOTE : GPU is required)

```bash
cd streamsync-backend
pip install -r requirements.txt
python server.py
```

### 3️⃣ Update API Endpoint

In your React app:

```ts
const API_URL = "http://localhost:5000";
```

---

## 🔎 API Endpoints

### **POST /upload**

Uploads video + audio and returns fps + offset.

```json
{
  "offset": "in frames",
  "fps":"frames per second of the uploaded video",
  "offset_ms": "in milliseconds...."
}
```

### **POST /apply-offset**

Applies offset and returns processed file.

---

## ⭐ Credits

* FFmpeg WASM
* Python FFmpeg bindings
* React + Vite
* Syncnet

---

