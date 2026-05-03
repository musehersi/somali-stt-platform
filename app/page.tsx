"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Theme  = "dark" | "light";
type Tab    = "upload" | "record";
type Stage  = "idle" | "processing" | "done" | "error";
interface Result { text: string; words: number; chars: number; duration: number; elapsed: number; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s: number) => s < 60 ? `${s.toFixed(1)}s` : `${(s/60).toFixed(1)}m`;
const fmtSize = (b: number) => b > 1_048_576 ? `${(b/1_048_576).toFixed(1)} MB` : `${(b/1024).toFixed(0)} KB`;
const isVideo = (f: File) => f.type.startsWith("video/");

// ─── Direct HF call for large files (bypasses 4.5MB Vercel limit) ─────────────
async function transcribeDirect(file: File): Promise<string> {
  const { Client } = await import("@gradio/client");
  const client = await Client.connect("ooloteam/SomaliSpeechToText");
  const blob = new Blob([await file.arrayBuffer()], { type: file.type || "audio/wav" });
  const result = await client.predict("/transcribe_file", {
    audio_file: blob,
    mic_file: null,
    video_file: null,
  });
  const data = result.data as unknown[];
  return (data[0] as string) ?? "";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const [theme, setTheme]       = useState<Theme>("dark");
  const [tab, setTab]           = useState<Tab>("upload");
  const [file, setFile]         = useState<File | null>(null);
  const [mediaURL, setMediaURL] = useState<string | null>(null);
  const [stage, setStage]       = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [progMsg, setProgMsg]   = useState("");
  const [result, setResult]     = useState<Result | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [copied, setCopied]     = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [recBlob, setRecBlob]     = useState<Blob | null>(null);
  const [recURL, setRecURL]       = useState<string | null>(null);

  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Theme persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("stt-theme") as Theme | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("stt-theme", theme);
  }, [theme]);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (f.size > 52_428_800) {
      setError("File exceeds 50 MB. Please trim or compress it.");
      return;
    }
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    setFile(f);
    setMediaURL(URL.createObjectURL(f));
    setResult(null);
    setError(null);
    setStage("idle");
  }, [mediaURL]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  // ── Waveform visualiser ───────────────────────────────────────────────────
  const drawWave = useCallback(() => {
    const canvas   = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx  = canvas.getContext("2d")!;
    const buf  = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isDark = theme === "dark";
      ctx.strokeStyle = isDark ? "#00d4aa" : "#00a87d";
      ctx.lineWidth   = 2.5;
      ctx.shadowColor = isDark ? "#00d4aa88" : "#00a87d44";
      ctx.shadowBlur  = 8;
      ctx.beginPath();

      const sliceW = canvas.width / buf.length;
      let x = 0;
      for (let i = 0; i < buf.length; i++) {
        const y = (buf[i] / 128) * (canvas.height / 2);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceW;
      }
      ctx.stroke();
    };
    draw();
  }, [theme]);

  // ── Live recording ─────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio context for waveform
      const ctx     = new AudioContext();
      const source  = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawWave();

      const mr = new MediaRecorder(stream);
      mediaRecRef.current  = mr;
      recChunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const url  = URL.createObjectURL(blob);
        setRecBlob(blob);
        setRecURL(url);
        stream.getTracks().forEach(t => t.stop());
        cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
      };

      mr.start(100);
      setRecording(true);
      setRecSeconds(0);
      setRecBlob(null);
      setRecURL(null);

      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      setError("Microphone access denied. Please allow microphone in your browser.");
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    setRecording(false);
  };

  // ── Transcription ──────────────────────────────────────────────────────────
  const transcribe = async () => {
    const source = tab === "record"
      ? (recBlob ? new File([recBlob], "recording.webm", { type: "audio/webm" }) : null)
      : file;

    if (!source) {
      setError(tab === "record" ? "Please record audio first." : "Please upload a file first.");
      return;
    }

    setStage("processing");
    setProgress(5);
    setProgMsg("Preparing…");
    setError(null);

    const t0 = Date.now();
    const sizeMB = source.size / 1_048_576;

    try {
      let text = "";

      // Files ≥ 4 MB bypass Vercel and call HuggingFace directly
      if (sizeMB >= 4) {
        setProgMsg(`Large file (${fmtSize(source.size)}) — connecting directly to AI…`);
        setProgress(15);
        text = await transcribeDirect(source);
        setProgress(90);
      } else {
        setProgress(20);
        setProgMsg("Uploading…");
        const fd = new FormData();
        fd.append("file", source);

        const res = await fetch("/api/transcribe", { method: "POST", body: fd });
        setProgress(75);
        setProgMsg("Processing…");

        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? "Transcription failed.");
        }
        const j = await res.json() as { text: string };
        text = j.text;
      }

      if (!text || text.startsWith("⚠️") || text.startsWith("❌")) {
        throw new Error(text || "No speech detected.");
      }

      const words = text.trim().split(/\s+/).filter(Boolean).length;
      // Rough duration from file if available
      const durEst = source.size / (16000 * 2); // rough estimate
      setResult({
        text: text.trim(),
        words,
        chars: text.length,
        duration: durEst,
        elapsed: (Date.now() - t0) / 1000,
      });
      setProgress(100);
      setStage("done");

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.includes("503") || msg.includes("waking")
        ? "The AI is waking up (it sleeps after inactivity). Wait 30s and try again."
        : msg);
      setStage("error");
    }
  };

  const copyText = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `somali-transcript-${Date.now()}.txt`,
    });
    a.click();
  };

  const reset = () => {
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    if (recURL)   URL.revokeObjectURL(recURL);
    setFile(null); setMediaURL(null); setRecBlob(null); setRecURL(null);
    setResult(null); setError(null); setStage("idle"); setProgress(0);
  };

  const busy = stage === "processing";

  return (
    <>
      {/* ── Global styles injected into <head> via Next.js ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=Outfit:wght@300;400;500;600&display=swap');

        :root[data-theme="dark"] {
          --bg:          #050d1a;
          --bg2:         #081424;
          --surface:     #0d1f35;
          --surface2:    #112540;
          --border:      #1a3350;
          --border2:     #1e3d5c;
          --accent:      #00d4aa;
          --accent2:     #00ffcc;
          --accent-dim:  rgba(0,212,170,0.12);
          --accent-glow: rgba(0,212,170,0.3);
          --amber:       #ffb547;
          --amber-dim:   rgba(255,181,71,0.12);
          --text:        #d4eae4;
          --text2:       #7a9eb0;
          --text3:       #3d6070;
          --error:       #ff6b6b;
          --error-dim:   rgba(255,107,107,0.12);
          --success:     #00d4aa;
          --rec:         #ff4560;
          --rec-dim:     rgba(255,69,96,0.15);
          --shadow:      0 8px 32px rgba(0,0,0,0.5);
          --shadow2:     0 2px 8px rgba(0,0,0,0.3);
          --noise:       url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
        }
        :root[data-theme="light"] {
          --bg:          #f5f0e8;
          --bg2:         #ede8df;
          --surface:     #ffffff;
          --surface2:    #faf8f4;
          --border:      #e0d8cc;
          --border2:     #cec5b6;
          --accent:      #00a87d;
          --accent2:     #007a5c;
          --accent-dim:  rgba(0,168,125,0.1);
          --accent-glow: rgba(0,168,125,0.25);
          --amber:       #d4860a;
          --amber-dim:   rgba(212,134,10,0.1);
          --text:        #1a2a22;
          --text2:       #5a7060;
          --text3:       #9aaa9a;
          --error:       #cc3333;
          --error-dim:   rgba(204,51,51,0.08);
          --success:     #00a87d;
          --rec:         #cc2244;
          --rec-dim:     rgba(204,34,68,0.1);
          --shadow:      0 8px 32px rgba(0,0,0,0.12);
          --shadow2:     0 2px 8px rgba(0,0,0,0.08);
          --noise:       none;
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html { scroll-behavior: smooth; }

        body {
          font-family: 'Outfit', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          transition: background 0.4s ease, color 0.4s ease;
          background-image: var(--noise);
        }

        ::selection { background: var(--accent-dim); color: var(--accent); }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg2); }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

        /* Transitions */
        .t { transition: all 0.25s ease; }

        /* Glowing border on focus */
        input:focus, textarea:focus, button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── NAV ─────────────────────────────────────────────────────────── */}
        <nav style={{
          position: "sticky", top: 0, zIndex: 50,
          background: "rgba(5,13,26,0.7)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          padding: "0 clamp(16px, 5vw, 48px)",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", height: 60,
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>

            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10,
                background: "linear-gradient(135deg, var(--accent), #0099ff)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, boxShadow: "0 0 16px var(--accent-glow)",
              }}>🎙</div>
              <span style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 18,
                letterSpacing: "-0.5px", color: "var(--text)" }}>
                Somali<span style={{ color: "var(--accent)" }}>STT</span>
              </span>
              <span style={{
                fontSize: 10, fontFamily: "DM Mono", fontWeight: 500,
                padding: "2px 8px", borderRadius: 20,
                background: "var(--accent-dim)", color: "var(--accent)",
                border: "1px solid var(--accent-glow)", letterSpacing: "0.08em",
              }}>BETA</span>
            </div>

            {/* Nav links + theme toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {[["About", "/about"], ["API", "/api-docs"]].map(([l, h]) => (
                <a key={l} href={h} style={{
                  color: "var(--text2)", fontSize: 14, fontWeight: 500,
                  textDecoration: "none", transition: "color 0.2s",
                }} onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                   onMouseLeave={e => (e.currentTarget.style.color = "var(--text2)")}>
                  {l}
                </a>
              ))}

              {/* Theme toggle */}
              <button onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: "1px solid var(--border2)",
                  background: theme === "dark" ? "var(--surface2)" : "var(--surface)",
                  cursor: "pointer", position: "relative", transition: "all 0.3s",
                  flexShrink: 0,
                }}>
                <div style={{
                  position: "absolute", top: 3,
                  left: theme === "dark" ? 22 : 3,
                  width: 16, height: 16, borderRadius: "50%",
                  background: theme === "dark" ? "var(--accent)" : "var(--amber)",
                  transition: "left 0.3s cubic-bezier(.34,1.56,.64,1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9,
                }}>
                  {theme === "dark" ? "🌙" : "☀️"}
                </div>
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO ────────────────────────────────────────────────────────── */}
        <div style={{ textAlign: "center", padding: "60px 24px 40px",
          background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--accent-dim), transparent)",
        }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 16px", borderRadius: 20, marginBottom: 20,
            background: "var(--accent-dim)", border: "1px solid var(--accent-glow)",
          }}>
            <span style={{ color: "var(--accent)", fontSize: 12, fontFamily: "DM Mono", letterSpacing: "0.1em" }}>
              ◎ LIVE
            </span>
            <span style={{ color: "var(--text2)", fontSize: 12 }}>
              ooloteam/wav2vec2-somali · WER 0.20
            </span>
          </div>

          <h1 style={{
            fontFamily: "Syne", fontWeight: 800, fontSize: "clamp(2.4rem, 6vw, 4.2rem)",
            lineHeight: 1.05, letterSpacing: "-2px", marginBottom: 16,
            background: theme === "dark"
              ? "linear-gradient(135deg, #fff 0%, var(--accent) 60%, #0099ff 100%)"
              : "linear-gradient(135deg, var(--text) 0%, var(--accent) 60%, #0066cc 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Somali Speech<br />to Text
          </h1>

          <p style={{ color: "var(--text2)", fontSize: "clamp(1rem, 2vw, 1.2rem)",
            maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.6, fontWeight: 300 }}>
            The most accurate free Somali transcription tool. Upload audio, video,
            or record live — get text in seconds.
          </p>

          {/* Stats strip */}
          <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 8 }}>
            {[
              ["📊", "WER 0.20"],
              ["⚡", "315M Params"],
              ["🌍", "Af Soomaali"],
              ["🎬", "Audio + Video"],
              ["🎤", "Live Record"],
              ["🆓", "Always Free"],
            ].map(([icon, label]) => (
              <div key={label} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 20,
                background: "var(--surface)", border: "1px solid var(--border)",
                fontSize: 13, color: "var(--text2)", fontFamily: "DM Mono",
              }}>
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MAIN CARD ───────────────────────────────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 clamp(12px, 4vw, 32px) 80px",
          width: "100%", flex: 1 }}>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
            gap: 20, alignItems: "start",
          }}>

            {/* ── LEFT: INPUT PANEL ────────────────────────────────────────── */}
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow)",
            }}>
              {/* Tab bar */}
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                {([["upload", "📁 Upload"], ["record", "🎤 Record"]] as [Tab, string][]).map(([t, l]) => (
                  <button key={t} onClick={() => { setTab(t); setError(null); }}
                    style={{
                      flex: 1, padding: "14px 16px", border: "none", cursor: "pointer",
                      fontFamily: "Syne", fontWeight: 600, fontSize: 13,
                      letterSpacing: "0.03em",
                      background: tab === t ? "var(--accent-dim)" : "transparent",
                      color: tab === t ? "var(--accent)" : "var(--text2)",
                      borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
                      transition: "all 0.2s",
                    }}>
                    {l}
                  </button>
                ))}
              </div>

              <div style={{ padding: 24 }}>

                {/* ── UPLOAD TAB ─────────────────────────────────────────── */}
                {tab === "upload" && (
                  <>
                    {/* Drop zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      style={{
                        border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border2)"}`,
                        borderRadius: 14, padding: "32px 20px", textAlign: "center",
                        cursor: "pointer", transition: "all 0.2s",
                        background: dragOver ? "var(--accent-dim)" : "var(--surface2)",
                        marginBottom: 16,
                      }}
                    >
                      <input ref={fileInputRef} type="file" hidden
                        accept="audio/*,video/*"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                      {file ? (
                        <div>
                          <div style={{ fontSize: 36, marginBottom: 8 }}>{isVideo(file) ? "🎬" : "🎵"}</div>
                          <div style={{ fontFamily: "DM Mono", fontSize: 13, color: "var(--accent)",
                            marginBottom: 4, wordBreak: "break-all" }}>{file.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text3)" }}>{fmtSize(file.size)}</div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>⬆</div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)",
                            marginBottom: 6 }}>Drop file here or click to browse</div>
                          <div style={{ fontSize: 12, color: "var(--text3)", fontFamily: "DM Mono" }}>
                            MP3 · WAV · FLAC · OGG · M4A · MP4 · WebM · MKV — up to 50 MB
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Playback */}
                    {mediaURL && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 11, fontFamily: "DM Mono", color: "var(--text3)",
                          marginBottom: 6, letterSpacing: "0.08em" }}>▶ PREVIEW</div>
                        {file && isVideo(file) ? (
                          <video src={mediaURL} controls playsInline
                            style={{ width: "100%", borderRadius: 10, maxHeight: 160,
                              background: "#000", border: "1px solid var(--border)" }} />
                        ) : (
                          <audio src={mediaURL} controls
                            style={{ width: "100%", height: 40, filter:
                              theme === "dark" ? "invert(1) hue-rotate(160deg)" : "none",
                              borderRadius: 8 }} />
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* ── RECORD TAB ───────────────────────────────────────────── */}
                {tab === "record" && (
                  <div>
                    {/* Waveform canvas */}
                    <div style={{
                      borderRadius: 12, overflow: "hidden", marginBottom: 16,
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      height: 80, display: "flex", alignItems: "center",
                      justifyContent: recording ? "stretch" : "center",
                    }}>
                      {recording ? (
                        <canvas ref={canvasRef} width={600} height={80}
                          style={{ width: "100%", height: "100%" }} />
                      ) : (
                        <span style={{ color: "var(--text3)", fontSize: 12,
                          fontFamily: "DM Mono" }}>
                          {recURL ? "Recording ready" : "Waveform appears here while recording"}
                        </span>
                      )}
                    </div>

                    {/* Timer */}
                    {(recording || recURL) && (
                      <div style={{ textAlign: "center", marginBottom: 14,
                        fontFamily: "DM Mono", fontSize: 28, fontWeight: 300,
                        color: recording ? "var(--rec)" : "var(--accent)",
                        letterSpacing: "0.05em",
                      }}>
                        {recording && (
                          <span style={{ display: "inline-block", width: 10, height: 10,
                            borderRadius: "50%", background: "var(--rec)",
                            marginRight: 8, animation: "pulse 1s infinite",
                          }} />
                        )}
                        {Math.floor(recSeconds / 60).toString().padStart(2, "0")}:
                        {(recSeconds % 60).toString().padStart(2, "0")}
                      </div>
                    )}

                    {/* Record / Stop button */}
                    <button onClick={recording ? stopRecording : startRecording}
                      style={{
                        width: "100%", padding: "14px", borderRadius: 12, border: "none",
                        cursor: "pointer", fontFamily: "Syne", fontWeight: 700, fontSize: 14,
                        letterSpacing: "0.05em", marginBottom: 12, transition: "all 0.2s",
                        background: recording
                          ? "var(--rec-dim)"
                          : "var(--accent-dim)",
                        color: recording ? "var(--rec)" : "var(--accent)",
                        border: `1px solid ${recording ? "var(--rec)" : "var(--accent)"}`,
                        boxShadow: recording ? "0 0 20px var(--rec-dim)" : "none",
                      }}>
                      {recording ? "⏹ Stop Recording" : recURL ? "🔄 Record Again" : "🎤 Start Recording"}
                    </button>

                    {/* Playback for recorded audio */}
                    {recURL && !recording && (
                      <div>
                        <div style={{ fontSize: 11, fontFamily: "DM Mono", color: "var(--text3)",
                          marginBottom: 6, letterSpacing: "0.08em" }}>▶ PLAYBACK</div>
                        <audio src={recURL} controls
                          style={{ width: "100%", height: 40,
                            filter: theme === "dark" ? "invert(1) hue-rotate(160deg)" : "none",
                            borderRadius: 8 }} />
                      </div>
                    )}
                  </div>
                )}

                {/* ── Error ────────────────────────────────────────────────── */}
                {error && (
                  <div style={{
                    padding: "12px 14px", borderRadius: 10, marginTop: 12,
                    background: "var(--error-dim)", border: "1px solid var(--error)",
                    color: "var(--error)", fontSize: 13, lineHeight: 1.5,
                  }}>
                    ⚠ {error}
                  </div>
                )}

                {/* ── Progress bar ──────────────────────────────────────────── */}
                {busy && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between",
                      marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: "var(--text2)", fontFamily: "DM Mono" }}>{progMsg}</span>
                      <span style={{ color: "var(--accent)", fontFamily: "DM Mono" }}>{progress}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--border)",
                      overflow: "hidden" }}>
                      <div style={{
                        height: "100%", borderRadius: 2, transition: "width 0.4s ease",
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, var(--accent), #0099ff)",
                        boxShadow: "0 0 8px var(--accent-glow)",
                      }} />
                    </div>
                  </div>
                )}

                {/* ── Action buttons ────────────────────────────────────────── */}
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button onClick={transcribe} disabled={busy}
                    style={{
                      flex: 1, padding: "13px 20px", border: "none", borderRadius: 12,
                      cursor: busy ? "not-allowed" : "pointer", fontFamily: "Syne",
                      fontWeight: 700, fontSize: 14, letterSpacing: "0.04em",
                      background: busy
                        ? "var(--surface2)"
                        : "linear-gradient(135deg, var(--accent), #0099ff)",
                      color: busy ? "var(--text3)" : "#fff",
                      boxShadow: busy ? "none" : "0 4px 20px var(--accent-glow)",
                      transition: "all 0.2s",
                    }}>
                    {busy ? "⏳ Transcribing…" : "🚀 Transcribe"}
                  </button>
                  {(file || recURL || result) && (
                    <button onClick={reset}
                      style={{
                        padding: "13px 16px", borderRadius: 12,
                        border: "1px solid var(--border2)", cursor: "pointer",
                        background: "var(--surface2)", color: "var(--text2)",
                        fontSize: 16, transition: "all 0.2s",
                      }}>✕</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── RIGHT: OUTPUT PANEL ──────────────────────────────────────── */}
            <div style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 20, overflow: "hidden", boxShadow: "var(--shadow)",
            }}>
              {/* Header */}
              <div style={{
                padding: "16px 24px", borderBottom: "1px solid var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 14,
                  letterSpacing: "0.05em", color: "var(--text)" }}>
                  ✦ TRANSCRIPT
                </span>
                {result && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={copyText} style={{
                      padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border2)",
                      background: copied ? "var(--accent-dim)" : "var(--surface2)",
                      color: copied ? "var(--accent)" : "var(--text2)",
                      cursor: "pointer", fontSize: 12, fontFamily: "DM Mono",
                      transition: "all 0.2s",
                    }}>
                      {copied ? "✓ Copied" : "⎘ Copy"}
                    </button>
                    <button onClick={downloadTxt} style={{
                      padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border2)",
                      background: "var(--surface2)", color: "var(--text2)",
                      cursor: "pointer", fontSize: 12, fontFamily: "DM Mono",
                      transition: "all 0.2s",
                    }}>
                      ⬇ .txt
                    </button>
                  </div>
                )}
              </div>

              {/* Transcript area */}
              <div style={{ padding: 24, minHeight: 240 }}>
                {stage === "idle" && !result && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: 200, gap: 12, opacity: 0.5 }}>
                    <div style={{ fontSize: 48 }}>🎯</div>
                    <div style={{ color: "var(--text3)", fontSize: 14,
                      fontFamily: "DM Mono", textAlign: "center", lineHeight: 1.8 }}>
                      Upload audio or video<br />and press Transcribe
                    </div>
                  </div>
                )}

                {busy && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: 200, gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      border: "3px solid var(--border)", borderTopColor: "var(--accent)",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    <div style={{ color: "var(--text2)", fontSize: 14,
                      fontFamily: "DM Mono" }}>Processing Somali speech…</div>
                  </div>
                )}

                {result && (
                  <>
                    <textarea readOnly value={result.text}
                      style={{
                        width: "100%", minHeight: 180, background: "var(--surface2)",
                        border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px",
                        color: "var(--text)", fontSize: 15, lineHeight: 1.9, resize: "vertical",
                        fontFamily: "'Outfit', sans-serif", outline: "none",
                        transition: "border 0.2s",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "var(--accent)"}
                      onBlur={e => e.currentTarget.style.borderColor = "var(--border)"}
                    />

                    {/* Stats cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8, marginTop: 12 }}>
                      {[
                        ["⏱", fmt(result.elapsed), "time"],
                        ["📝", result.words.toLocaleString(), "words"],
                        ["🔤", result.chars.toLocaleString(), "chars"],
                        ["🏆", "0.20", "WER"],
                      ].map(([icon, val, label]) => (
                        <div key={label} style={{
                          textAlign: "center", padding: "10px 6px", borderRadius: 10,
                          background: "var(--surface2)", border: "1px solid var(--border)",
                        }}>
                          <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>
                          <div style={{ fontFamily: "DM Mono", fontWeight: 500, fontSize: 15,
                            color: "var(--accent)" }}>{val}</div>
                          <div style={{ fontSize: 10, color: "var(--text3)",
                            fontFamily: "DM Mono", letterSpacing: "0.08em",
                            textTransform: "uppercase" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {stage === "error" && !result && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", minHeight: 200, gap: 10 }}>
                    <div style={{ fontSize: 40 }}>⚡</div>
                    <div style={{ color: "var(--error)", fontSize: 14, textAlign: "center",
                      fontFamily: "DM Mono", lineHeight: 1.6 }}>
                      Check the error message on the left panel
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── FEATURE STRIP ───────────────────────────────────────────────── */}
          <div style={{ display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12, marginTop: 20 }}>
            {[
              ["🔒", "Private", "Files processed in memory — never stored anywhere"],
              ["⚡", "int8 Quantised", "2–3× faster CPU inference with minimal accuracy loss"],
              ["🎬", "Video Support", "MP4, WebM, MKV — audio extracted automatically"],
              ["🌍", "Open Source", "Apache 2.0 — use freely for research or production"],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{
                padding: "16px 18px", borderRadius: 14,
                background: "var(--surface)", border: "1px solid var(--border)",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                <div>
                  <div style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 13,
                    color: "var(--text)", marginBottom: 3 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid var(--border)", padding: "20px 24px",
          textAlign: "center", background: "var(--bg2)" }}>
          <p style={{ fontSize: 12, color: "var(--text3)", fontFamily: "DM Mono" }}>
            <strong style={{ color: "var(--text2)" }}>SomaliSTT</strong> by ooloteam · Powered by{" "}
            <a href="https://huggingface.co/ooloteam/wav2vec2-somali" target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)", textDecoration: "none" }}>
              ooloteam/wav2vec2-somali
            </a>{" "}
            · Free forever for the Somali-speaking community 🌍
          </p>
        </footer>
      </div>

      {/* ── Keyframe animations ─────────────────────────────────────────── */}
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </>
  );
}
