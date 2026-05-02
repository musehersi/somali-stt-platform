import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 120;

// ── Gradio 5 API uses a 2-step pattern:
//    STEP 1: POST /gradio_api/upload          → uploads the file, returns a path
//    STEP 2: POST /gradio_api/call/{fn}       → starts inference, returns event_id
//    STEP 3: GET  /gradio_api/call/{fn}/{id}  → SSE stream, returns result
//
// The old /api/predict endpoint was Gradio 3/4 ONLY — it no longer exists.
//
// Set HF_SPACE_URL in Vercel environment variables to:
//   https://ooloteam-somalispeechtotext.hf.space
// (no trailing slash, no path)

const HF_BASE =
  (process.env.HF_SPACE_URL || "https://ooloteam-somalispeechtotext.hf.space")
    .replace(/\/$/, ""); // strip trailing slash if present

// ── Simple in-memory rate limiter (resets per Edge cold-start) ──────────────
const RL = new Map<string, { n: number; reset: number }>();
const MAX_RPH = 10; // requests per hour per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const e = RL.get(ip);
  if (!e || now > e.reset) { RL.set(ip, { n: 1, reset: now + 3_600_000 }); return false; }
  if (e.n >= MAX_RPH) return true;
  e.n++;
  return false;
}

// ── Parse the Gradio 5 SSE stream and return the first "complete" payload ──
async function readSSEResult(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE format: lines of "event: ...\ndata: ...\n\n"
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";           // keep incomplete last block

    for (const block of blocks) {
      const lines = block.trim().split("\n");
      const eventLine = lines.find(l => l.startsWith("event:"));
      const dataLine  = lines.find(l => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const eventType = eventLine.replace("event:", "").trim();
      const rawData   = dataLine.replace("data:", "").trim();

      if (eventType === "error") {
        throw new Error(`HuggingFace Space error: ${rawData}`);
      }

      if (eventType === "complete") {
        // data is a JSON array: [transcript_text, stats_string, file_obj_or_null]
        const payload = JSON.parse(rawData) as unknown[];
        const text = payload[0];
        if (typeof text !== "string") throw new Error("Unexpected response shape from Space.");
        return text;
      }
      // "generating" / "heartbeat" / "process_starts" — ignore, keep reading
    }
  }
  throw new Error("Stream ended without a 'complete' event.");
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit: max 10 transcriptions per hour." },
      { status: 429 }
    );
  }

  // Parse uploaded file
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
  if (file.size > 52_428_800) return NextResponse.json({ error: "File too large (max 50 MB)." }, { status: 413 });

  try {
    // ── STEP 1: Upload the file to the Gradio Space ─────────────────────────
    const uploadForm = new FormData();
    uploadForm.append("files", file, file.name);

    const uploadRes = await fetch(`${HF_BASE}/gradio_api/upload`, {
      method: "POST",
      body: uploadForm,
    });

    if (!uploadRes.ok) {
      const txt = await uploadRes.text();
      console.error("HF upload failed:", uploadRes.status, txt.slice(0, 200));

      // If the Space is sleeping, first request wakes it — tell client to retry
      if (uploadRes.status === 503 || uploadRes.status === 502) {
        return NextResponse.json(
          { error: "The transcription service is waking up. Please wait 30 seconds and try again." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "File upload to Space failed." }, { status: 502 });
    }

    // Response is an array of uploaded file paths: ["tmp/abc123/audio.mp3"]
    const uploadedPaths = await uploadRes.json() as string[];
    const uploadedPath  = uploadedPaths[0];

    if (!uploadedPath) {
      return NextResponse.json({ error: "Space returned empty upload path." }, { status: 502 });
    }

    // ── STEP 2: Call the transcription function ──────────────────────────────
    // Our function signature: transcribe_file(audio_file, mic_file, video_file)
    // We always send as audio_file (index 0), mic and video are null.
    const callRes = await fetch(`${HF_BASE}/gradio_api/call/transcribe_file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [
          // Gradio 5 file input format
          { path: uploadedPath, meta: { _type: "gradio.FileData" } },
          null,  // mic_file
          null,  // video_file
        ],
      }),
    });

    if (!callRes.ok) {
      const txt = await callRes.text();
      console.error("HF call failed:", callRes.status, txt.slice(0, 200));
      return NextResponse.json({ error: "Failed to start transcription." }, { status: 502 });
    }

    const { event_id } = await callRes.json() as { event_id: string };
    if (!event_id) {
      return NextResponse.json({ error: "No event_id returned by Space." }, { status: 502 });
    }

    // ── STEP 3: Stream the result ────────────────────────────────────────────
    const streamRes = await fetch(
      `${HF_BASE}/gradio_api/call/transcribe_file/${event_id}`
    );

    if (!streamRes.ok || !streamRes.body) {
      return NextResponse.json({ error: "Failed to read transcription stream." }, { status: 502 });
    }

    const text = await readSSEResult(streamRes.body);

    // Surface Space-level errors back to the user
    if (text.startsWith("⚠️") || text.startsWith("❌")) {
      return NextResponse.json({ error: text }, { status: 422 });
    }

    return NextResponse.json({ text: text.trim(), stats: "", duration: null });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Transcription proxy error:", msg);
    return NextResponse.json(
      { error: "Transcription service unavailable. Please try again." },
      { status: 502 }
    );
  }
}
