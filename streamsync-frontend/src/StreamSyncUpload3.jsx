// Patched StreamSyncUpload.jsx with integrated Save-with-Offset button
import React, { useState, useRef, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";

export default function StreamSyncUpload() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [offsetMs, setOffsetMs] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [downloadUrl, setDownloadUrl] = useState(null);

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const playTimer = useRef(null);
  const ffmpegRef = useRef(null);

  useEffect(() => {
    ffmpegRef.current = new FFmpeg({ log: true });
    return () => {
      clearTimeout(playTimer.current);
      if (audioRef.current) audioRef.current.pause();
      if (videoRef.current) videoRef.current.pause();
    };
  }, []);

  async function loadFFmpeg() {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      await ffmpeg.load();
    }
    return ffmpeg;
  }

  function validateFile(f) {
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
    if (!allowed.includes(f.type)) return "Invalid video type.";
    if (f.size > 1024 * 1024 * 1024) return "Max size 1GB.";
    return "";
  }

  function handleFileInput(e) {
    const f = e.target.files[0];
    if (!f) return;
    const msg = validateFile(f);
    if (msg) return setError(msg);
    setError("");
    setFile(f);

    const url = URL.createObjectURL(f);
    videoRef.current.src = url;
    videoRef.current.muted = true;
    videoRef.current.load();
    audioRef.current.src = url;
    audioRef.current.load();
  }

  function handlePlayPreview() {
    if (!file) return;
    clearTimeout(playTimer.current);
    videoRef.current.currentTime = 0;
    audioRef.current.currentTime = 0;
    videoRef.current.pause();
    audioRef.current.pause();

    const delay = offsetMs;
    if (delay >= 0) {
      videoRef.current.play();
      playTimer.current = setTimeout(() => audioRef.current.play(), delay);
    } else {
      audioRef.current.play();
      playTimer.current = setTimeout(() => videoRef.current.play(), -delay);
    }
  }

  async function handleSaveOffset() {
    if (!file) return;
    setProcessing(true);
    setProgress(0);
    setError("");
    setDownloadUrl(null);

    try {
      const ffmpeg = await loadFFmpeg();

      ffmpeg.on("progress", ({ progress }) => {
        setProgress(Math.round(progress * 100));
      });

      await ffmpeg.writeFile("input.mp4", new Uint8Array(await file.arrayBuffer()));

      const offsetSec = offsetMs / 1000;
      let args = [];

      if (offsetMs >= 0) {
        args = [
          "-i", "input.mp4",
          "-itsoffset", `${offsetSec}`,
          "-i", "input.mp4",
          "-map", "0:v",
          "-map", "1:a",
          "-c:v", "copy",
          "-c:a", "aac",
          "output.mp4",
        ];
      } else {
        const abs = Math.abs(offsetSec);
        args = [
          "-i", "input.mp4",
          "-ss", `${abs}`,
          "-i", "input.mp4",
          "-map", "0:a",
          "-map", "1:v",
          "-c:v", "copy",
          "-c:a", "aac",
          "output.mp4",
        ];
      }

      await ffmpeg.exec(args);
      const data = await ffmpeg.readFile("output.mp4");
      const url = URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
      setDownloadUrl(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 flex justify-center items-center">
      <div className="max-w-4xl w-full bg-white p-6 rounded-xl shadow grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN */}
        <div>
          <h1 className="text-2xl font-semibold">StreamSync — Upload</h1>

          <input type="file" accept="video/*" onChange={handleFileInput} className="mt-4" />
          {error && <div className="mt-2 text-red-600 text-sm">{error}</div>}

          <label className="block mt-4 text-sm font-medium">Offset (ms)</label>
          <input type="range" min={-2000} max={2000} value={offsetMs} onChange={(e) => setOffsetMs(Number(e.target.value))} className="w-full" />
          <div className="text-sm text-slate-600">{offsetMs} ms</div>

          <div className="flex gap-2 mt-4">
            <button onClick={handlePlayPreview} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Preview</button>
            <button onClick={() => { videoRef.current.pause(); audioRef.current.pause(); }} className="px-4 py-2 border rounded-lg">Stop</button>

            <button onClick={handleSaveOffset} disabled={!file || processing} className="px-4 py-2 bg-yellow-600 text-white rounded-lg">
              {processing ? `Processing ${progress}%` : "Save Offset"}
            </button>
          </div>

          {downloadUrl && (
            <a href={downloadUrl} download="corrected.mp4" className="mt-3 inline-block bg-green-600 text-white px-4 py-2 rounded-lg">Download Corrected Video</a>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          <div className="bg-slate-100 p-4 rounded-xl">
            <h2 className="text-sm font-medium">Preview</h2>
            <video ref={videoRef} controls className="w-full bg-black rounded mt-2" />
            <audio ref={audioRef} className="hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}