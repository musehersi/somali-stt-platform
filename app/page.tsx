"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, Mic, FileAudio, FileVideo, Download, Copy,
  CheckCheck, Loader2, Zap, Globe, BarChart3, X
} from "lucide-react";
import clsx from "clsx";

type Stage = "idle" | "loading" | "transcribing" | "done" | "error";

interface TranscriptResult {
  text: string;
  wordCount: number;
  charCount: number;
  duration: number;
  elapsed: number;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPT = ".mp3,.wav,.ogg,.flac,.m4a,.aac,.opus,.mp4,.webm,.mkv,.mov,.avi";

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (f.size > 52_428_800) {
      setError("File too large. Maximum size is 50 MB.");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    setStage("idle");
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  // ── Transcription ─────────────────────────────────────────────────────────
  const transcribe = async () => {
    if (!file) return;
    setStage("loading");
    setProgress(5);
    setProgressMsg("Preparing audio...");
    setError(null);

    try {
      const startTime = Date.now();
      const formData = new FormData();
      formData.append("file", file);

      setProgress(15);
      setProgressMsg("Uploading to transcription engine...");
      setStage("transcribing");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      setProgress(80);
      setProgressMsg("Processing response...");

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transcription failed");
      }

      const data = await res.json();
      const elapsed = (Date.now() - startTime) / 1000;

      setResult({
        text: data.text,
        wordCount: data.text.split(/\s+/).filter(Boolean).length,
        charCount: data.text.length,
        duration: data.duration ?? 0,
        elapsed,
      });

      setProgress(100);
      setProgressMsg("Done!");
      setStage("done");
    } catch (e: any) {
      setError(e.message ?? "An unexpected error occurred.");
      setStage("error");
    }
  };

  // ── Copy ──────────────────────────────────────────────────────────────────
  const copyText = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `somali-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setStage("idle");
    setProgress(0);
  };

  const isProcessing = stage === "loading" || stage === "transcribing";
  const fileIsVideo = file?.type?.startsWith("video/");

  return (
    <main className="min-h-screen" style={{ background: "var(--dark)" }}>
      {/* ── Nav ── */}
      <nav className="border-b border-slate-800/60 backdrop-blur-sm sticky top-0 z-40"
        style={{ background: "rgba(10,15,30,0.9)" }}>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎙️</span>
            <span className="font-bold text-white text-lg">SomaliSTT</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-1"
              style={{ background: "rgba(13,115,119,0.25)", color: "#14a085" }}>
              Beta
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="/about" className="hover:text-white transition-colors">About</a>
            <a href="/api-docs" className="hover:text-white transition-colors">API</a>
            <a href="https://huggingface.co/ooloteam/wav2vec2-somali" target="_blank"
              className="hover:text-teal-400 transition-colors flex items-center gap-1">
              <span>Model</span>
              <span className="text-xs">↗</span>
            </a>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* ── Hero ── */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6"
            style={{ background: "rgba(13,115,119,0.15)", color: "#0d7377", border: "1px solid rgba(13,115,119,0.3)" }}>
            <Zap size={14} /> Powered by wav2vec2-somali — WER 0.20
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
            Somali Speech to Text
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Transcribe Somali audio and video instantly. Free, private, and powered by
            the best open-source Somali ASR model.
          </p>

          {/* Stats */}
          <div className="flex justify-center gap-8 mt-8">
            {[
              { icon: <BarChart3 size={18} />, label: "Word Error Rate", value: "0.20" },
              { icon: <Zap size={18} />, label: "Parameters", value: "315M" },
              { icon: <Globe size={18} />, label: "Language", value: "Af Soomaali" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1.5 font-bold text-2xl text-white">
                  <span style={{ color: "#0d7377" }}>{s.icon}</span>
                  {s.value}
                </div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main Card ── */}
        <div className="panel p-8 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Upload */}
            <div>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <Upload size={18} style={{ color: "#0d7377" }} />
                Upload File
              </h2>

              {/* Drop zone */}
              <div
                className={clsx("upload-zone p-8 flex flex-col items-center justify-center cursor-pointer min-h-[200px]",
                  { "dragging": dragOver })}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input ref={fileInputRef} type="file" accept={ACCEPT}
                  onChange={onFileChange} className="hidden" />

                {file ? (
                  <div className="text-center">
                    <div className="text-4xl mb-3">{fileIsVideo ? "🎬" : "🎵"}</div>
                    <div className="font-medium text-white text-sm truncate max-w-[220px]">
                      {file.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {(file.size / 1_048_576).toFixed(1)} MB
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); reset(); }}
                      className="mt-3 text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 mx-auto">
                      <X size={12} /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex gap-3 justify-center mb-4 opacity-60">
                      <FileAudio size={28} style={{ color: "#0d7377" }} />
                      <FileVideo size={28} style={{ color: "#14a085" }} />
                    </div>
                    <p className="text-slate-300 font-medium mb-1">Drop file here or click to browse</p>
                    <p className="text-xs text-slate-500">MP3, WAV, OGG, FLAC, MP4, WebM, MKV • Max 50 MB</p>
                  </div>
                )}
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-slate-400">{progressMsg}</span>
                    <span className="text-xs text-slate-500">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1e293b" }}>
                    <div className="h-full rounded-full progress-bar transition-all duration-300"
                      style={{ width: `${progress}%`, background: "linear-gradient(90deg, #0d7377, #14a085)" }} />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 p-3 rounded-lg text-sm text-red-400"
                  style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  ⚠️ {error}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-5">
                <button onClick={transcribe}
                  disabled={!file || isProcessing}
                  className="btn-primary flex-1 py-3 px-6 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
                  {isProcessing
                    ? <><Loader2 size={18} className="animate-spin" /> Transcribing...</>
                    : <><Zap size={18} /> Transcribe</>
                  }
                </button>
                {(file || result) && (
                  <button onClick={reset}
                    className="py-3 px-4 rounded-xl font-medium text-slate-400 hover:text-white transition-colors"
                    style={{ background: "#1e293b", border: "1px solid #334155" }}>
                    <X size={18} />
                  </button>
                )}
              </div>

              {/* Mic note */}
              <p className="text-xs text-slate-600 mt-3 flex items-center gap-1">
                <Mic size={12} /> Live microphone recording coming soon
              </p>
            </div>

            {/* Right: Output */}
            <div>
              <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
                <span style={{ color: "#0d7377" }}>✦</span>
                Somali Transcript
              </h2>

              <textarea
                readOnly
                value={result?.text ?? ""}
                placeholder="Your Somali transcription will appear here..."
                className="w-full h-48 rounded-xl p-4 text-sm resize-none outline-none text-slate-300 placeholder-slate-600"
                style={{ background: "#0a1628", border: "1px solid #1e293b", lineHeight: "1.8" }}
              />

              {/* Stats */}
              {result && (
                <div className="mt-3 p-3 rounded-lg text-xs flex flex-wrap gap-4"
                  style={{ background: "rgba(13,115,119,0.08)", border: "1px solid rgba(13,115,119,0.2)" }}>
                  <span className="text-slate-400">⏱ <span className="text-teal-400 font-medium">{result.elapsed.toFixed(1)}s</span></span>
                  <span className="text-slate-400">📝 <span className="text-teal-400 font-medium">{result.wordCount}</span> words</span>
                  <span className="text-slate-400">🔤 <span className="text-teal-400 font-medium">{result.charCount}</span> chars</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-4">
                <button onClick={copyText} disabled={!result}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8" }}>
                  {copied ? <><CheckCheck size={16} className="text-green-400" /> Copied!</> : <><Copy size={16} /> Copy</>}
                </button>
                <button onClick={downloadTxt} disabled={!result}
                  className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                  style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8" }}>
                  <Download size={16} /> Download .txt
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Features ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: "🔒", title: "Private & Secure", desc: "Files are processed directly — never stored on our servers." },
            { icon: "🌍", title: "For the Community", desc: "Built specifically for Somali speakers, journalists, and researchers." },
            { icon: "⚡", title: "State-of-the-Art", desc: "0.20 WER — the best available open-source Somali ASR model." },
          ].map((f) => (
            <div key={f.title} className="panel p-5">
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800/60 mt-16 py-8 text-center text-xs text-slate-600">
        <p>
          <strong className="text-slate-500">SomaliSTT</strong> — Powered by{" "}
          <a href="https://huggingface.co/ooloteam/wav2vec2-somali"
            className="hover:text-teal-400 transition-colors" target="_blank">
            ooloteam/wav2vec2-somali
          </a>{" "}
          · Free forever for the Somali-speaking community
        </p>
      </footer>
    </main>
  );
}
