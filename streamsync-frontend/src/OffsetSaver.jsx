import React, { useState, useEffect, useRef } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";

export default function OffsetSaver({ initialFile }) {
  const [file, setFile] = useState(initialFile || null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState(null);
  const [error, setError] = useState(null);

  const ffmpegRef = useRef(null);

  useEffect(() => {
    ffmpegRef.current = new FFmpeg();
  }, []);

  async function loadFFmpeg() {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      await ffmpeg.load({
        coreURL: "/ffmpeg-core.js"   // Vite will serve it
      });
    }
    return ffmpeg;
  }

  async function handleSave() {
    try {
      if (!file) {
        setError("Select a file first");
        return;
      }

      setProcessing(true);
      setError("");
      setProgress(0);

      const ffmpeg = await loadFFmpeg();

      ffmpeg.on("progress", (e) => {
        setProgress(Math.round(e.progress * 100));
      });

      // Load file
      await ffmpeg.writeFile(
        "input.mp4",
        new Uint8Array(await file.arrayBuffer())
      );

      const offsetSec = offsetMs / 1000;

      let args = [];

      if (offsetMs >= 0) {
        // audio delayed
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
        // audio ahead
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
      const url = URL.createObjectURL(
        new Blob([data.buffer], { type: "video/mp4" })
      );

      setResultUrl(url);
    } catch (err) {
      console.error(err);
      setError(String(err));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h2 className="text-lg font-semibold mb-2">Save Video with Offset</h2>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files[0])}
        className="mb-2"
      />

      <input
        type="range"
        min={-2000}
        max={2000}
        value={offsetMs}
        onChange={(e) => setOffsetMs(Number(e.target.value))}
        className="w-full"
      />

      <div className="text-sm mb-3">{offsetMs} ms</div>

      <button
        onClick={handleSave}
        disabled={processing}
        className="px-4 py-2 rounded bg-indigo-600 text-white"
      >
        {processing ? "Processing..." : "Save with Offset"}
      </button>

      {processing && (
        <div className="mt-2 text-sm text-gray-600">
          Processing: {progress}%
        </div>
      )}

      {error && <div className="text-red-600 mt-2">{error}</div>}

      {resultUrl && (
        <div className="mt-3">
          <a
            href={resultUrl}
            download="corrected.mp4"
            className="px-4 py-2 bg-green-600 text-white rounded"
          >
            Download Corrected Video
          </a>

          <video
            src={resultUrl}
            controls
            className="w-full mt-2 rounded"
          />
        </div>
      )}
    </div>
  );
}
