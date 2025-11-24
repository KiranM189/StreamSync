import React, { useState, useRef, useEffect } from "react";
import OffsetSaver from "./OffsetSaver";

export default function StreamSyncUpload() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [offsetMs, setOffsetMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const playTimer = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(playTimer.current);
      if (audioRef.current) audioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
    };
  }, []);

  function validateFile(f) {
    const maxSize = 1 * 1024 * 1024 * 1024;
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
    if (!allowed.includes(f.type)) return "Unsupported file type.";
    if (f.size > maxSize) return "File too large (max 1GB).";
    return "";
  }

  function handleFileInput(e) {
    const f = e.target.files[0];
    if (!f) return;
    const v = validateFile(f);
    if (v) return setError(v);
    setError("");
    setFile(f);
    prepareMedia(f);
  }

  function prepareMedia(f) {
    const url = URL.createObjectURL(f);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
      videoRef.current.muted = true;
    }
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.load();
    }
  }

  function handlePlayPreview() {
    if (!file) return;
    clearTimeout(playTimer.current);
    videoRef.current.pause();
    audioRef.current.pause();
    videoRef.current.currentTime = 0;
    audioRef.current.currentTime = 0;

    const delay = Number(offsetMs) || 0;
    if (delay >= 0) {
      videoRef.current.play();
      playTimer.current = setTimeout(() => audioRef.current.play(), delay);
    } else {
      audioRef.current.play();
      playTimer.current = setTimeout(() => videoRef.current.play(), -delay);
    }
  }

  function handleStopPreview() {
    clearTimeout(playTimer.current);
    videoRef.current.pause();
    audioRef.current.pause();
  }

  async function handleUpload() {
    if (!file) return setError("Please choose a file first.");
    setUploading(true);
    setProgress(0);

    const fd = new FormData();
    fd.append("video", file);
    fd.append("offset_ms", offsetMs);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage("Upload successful.");
      } else setError("Upload failed.");
    };
    xhr.onerror = () => {
      setUploading(false);
      setError("Network error.");
    };
    xhr.send(fd);
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center items-center">
      <div className="max-w-5xl w-full bg-white shadow-lg p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h1 className="text-2xl font-semibold">StreamSync — Upload Video</h1>
          <p className="mt-2 text-sm text-slate-600">Upload and preview audio offset before analysis.</p>

          <input type="file" accept="video/*" onChange={handleFileInput} className="mt-4" />
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}

          <label className="block mt-4 text-sm font-medium">Offset (ms)</label>
          <input type="range" min={-2000} max={2000} step={10} value={offsetMs} onChange={(e) => setOffsetMs(Number(e.target.value))} className="w-full" />

          <div className="flex gap-2 mt-3">
            <button onClick={handlePlayPreview} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Preview</button>
            <button onClick={handleStopPreview} className="px-4 py-2 border rounded-lg">Stop</button>
            <button onClick={handleUpload} disabled={!file || uploading} className="px-4 py-2 bg-green-600 text-white rounded-lg ml-auto">{uploading ? "Uploading..." : "Upload"}</button>
          </div>

          {uploading && <div className="mt-3 w-full bg-slate-200 h-3 rounded-full"><div className="h-3 bg-green-600 rounded-full" style={{ width: `${progress}%` }} /></div>}
          {message && <div className="mt-2 text-green-700 text-sm">{message}</div>}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-100 p-4 rounded-xl">
            <h2 className="text-sm font-medium">Preview</h2>
            <video ref={videoRef} controls className="w-full bg-black rounded-md mt-2" />
            <audio ref={audioRef} className="hidden" />
          </div>

          {/* Offset Saver UI */}
          <div className="bg-white p-4 rounded-xl border border-slate-200">
            <h2 className="text-lg font-semibold mb-2">Save Corrected Video (Client-side)</h2>
            <OffsetSaver initialFile={file} />
          </div>
        </div>
      </div>
    </div>
  );
}
