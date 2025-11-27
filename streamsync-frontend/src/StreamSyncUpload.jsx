import React, { useState, useRef, useEffect } from "react";

// StreamSyncUpload.jsx
// Single-file React component (default export) for a StreamSync upload page.
// Uses Tailwind CSS for styling. Assumes Tailwind is already configured in the project.
// Features:
// - Drag & drop or file input for a single video file
// - File validation (type & size)
// - Video preview (visual) and separate audio playback for AV offset preview
// - Slider to adjust audio offset (in milliseconds) to preview sync
// - Upload button that sends the file and the chosen offset to /api/upload
// - Upload progress bar and basic error handling

export default function StreamSyncUpload() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [offsetMs, setOffsetMs] = useState(0); // audio delay in ms (positive = audio delayed)
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const playTimer = useRef(null);

  useEffect(() => {
    // cleanup when component unmounts
    return () => {
      clearTimeout(playTimer.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, []);

  function validateFile(f) {
    const maxSizeBytes = 1024 * 1024 * 1024 * 1; // 1 GB limit (adjustable)
    const allowed = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
    if (!allowed.includes(f.type)) {
      return "Unsupported file type. Use MP4, WebM, MOV or MKV.";
    }
    if (f.size > maxSizeBytes) {
      return "File is too large. Maximum 1 GB allowed.";
    }
    return "";
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const v = validateFile(f);
    if (v) {
      setError(v);
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
    prepareMedia(f);
  }

  function handleFileInput(e) {
    const f = e.target.files[0];
    if (!f) return;
    const v = validateFile(f);
    if (v) {
      setError(v);
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
    prepareMedia(f);
  }

  function prepareMedia(f) {
    // Create object URLs for previewing
    const url = URL.createObjectURL(f);
    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
      videoRef.current.muted = true; // visual track muted; audio played separately
    }
    if (audioRef.current) {
      // audio element can play the audio track pulled from the same file URL
      audioRef.current.src = url;
      audioRef.current.load();
    }
  }

  function handlePlayPreview() {
    if (!file) return;
    setMessage("");
    clearTimeout(playTimer.current);
    // Pause and reset
    videoRef.current.currentTime = 0;
    audioRef.current.currentTime = 0;
    videoRef.current.pause();
    audioRef.current.pause();

    const delay = Number(offsetMs) || 0;
    // Positive delay: audio plays after video by delay ms
    // Negative delay: audio plays before video by |delay| ms
    if (delay >= 0) {
      videoRef.current.play().catch((e) => console.warn("video play failed", e));
      playTimer.current = setTimeout(() => {
        audioRef.current.play().catch((e) => console.warn("audio play failed", e));
      }, delay);
    } else {
      // audio ahead
      audioRef.current.play().catch((e) => console.warn("audio play failed", e));
      playTimer.current = setTimeout(() => {
        videoRef.current.play().catch((e) => console.warn("video play failed", e));
      }, -delay);
    }
  }

  function handleStopPreview() {
    clearTimeout(playTimer.current);
    if (videoRef.current) videoRef.current.pause();
    if (audioRef.current) audioRef.current.pause();
  }

  // In your React Upload Component
const handleUpload = async () => {
    // 1. Use the 'file' state directly. Do not accept it as an argument.
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    setUploading(true);
    setMessage("Uploading and processing...");
    setProgress(10); // visual feedback

    const formData = new FormData();
    // 2. Append the actual file object from state
    formData.append("video", file);

    try {
      const response = await fetch("http://localhost:5000/api/upload", {
        method: "POST",
        body: formData,
        // Note: Do NOT set 'Content-Type' header here. 
        // fetch+FormData sets the boundary automatically.
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      console.log("Success:", data);
      setProgress(100);
      setMessage("Analysis Complete!");
      
      // 3. Show the result
      alert(`Sync Complete!\nOffset: ${data.offset_frames} frames\nConfidence: ${data.confidence}`);

    } catch (error) {
      console.error("Upload Error:", error);
      setError("Failed to connect to the server or process the video.");
      setUploading(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h1 className="text-2xl font-semibold">StreamSync — Upload your out-of-sync video</h1>
          <p className="mt-2 text-sm text-slate-600">Upload a single video file with audio/video sync problems. Preview with the offset slider and then upload for automatic correction suggestions.</p>

          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="mt-6 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-6 cursor-pointer hover:border-slate-300 transition-colors"
          >
            <input type="file" accept="video/*" className="sr-only" onChange={handleFileInput} />
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16V4m0 0L3 8m4-4 4 4m6 8v4m0 0l4-4m-4 4-4-4" />
              </svg>
              <p className="mt-2 text-sm text-slate-600">Drag & drop a video file here — or click to browse</p>
              <p className="mt-1 text-xs text-slate-400">Supported: MP4, WebM, MOV, MKV. Max 1 GB.</p>
            </div>
          </label>

          {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

          <div className="mt-6">
            <label className="block text-sm font-medium text-slate-700">Adjust audio offset (ms)</label>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={-2000}
                max={2000}
                step={10}
                value={offsetMs}
                onChange={(e) => setOffsetMs(Number(e.target.value))}
                className="w-full"
              />
              <div className="w-24 text-right text-sm text-slate-600">{offsetMs} ms</div>
            </div>
            <p className="mt-2 text-xs text-slate-500">Positive = audio delayed relative to video. Negative = audio ahead.</p>

            <div className="mt-4 flex gap-2">
              <button onClick={handlePlayPreview} className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Preview</button>
              <button onClick={handleStopPreview} className="px-4 py-2 rounded-lg border border-slate-200">Stop</button>
              <button onClick={handleUpload} disabled={!file || uploading} className="ml-auto px-4 py-2 rounded-lg bg-green-600 text-white disabled:opacity-60">{uploading ? 'Uploading...' : 'Upload & Analyze'}</button>
            </div>

            {uploading && (
              <div className="mt-4 w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div className="h-3 rounded-full bg-green-500" style={{ width: `${progress}%` }} />
              </div>
            )}

            {message && <div className="mt-4 text-sm text-green-700">{message}</div>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-100 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Preview</h2>
            </div>

            <div className="mt-4">
              <video ref={videoRef} controls className="w-full rounded-md bg-black" />
              {/* audio element is hidden but used for playback */}
              <audio ref={audioRef} className="hidden" />

              <div className="mt-3 flex items-center gap-3 text-sm text-slate-600">
                <div>File: <span className="font-medium text-slate-800">{file ? file.name : 'No file selected'}</span></div>
                <div className="ml-auto">Duration: <span className="font-medium">{file ? 'Use preview controls' : '-'}</span></div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                Tip: Use the slider to find approx sync offset, then upload — our server will return suggested corrections and a downloadable corrected file.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-100 text-sm text-slate-700">
            <h3 className="font-medium">How it works</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Upload your video file.</li>
              <li>Preview with the offset slider to locate the perceived audio/video lag.</li>
              <li>Upload for automated analysis and suggested fix (server-side process).</li>
            </ul>

            <div className="mt-3 text-xs text-slate-500">We keep your uploads private and delete temporary files after processing. For large files, a fast connection is recommended.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
