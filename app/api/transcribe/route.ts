import { NextRequest, NextResponse } from "next/server";
import { Client } from "@gradio/client";

// ── Use Node.js runtime — edge runtime blocks @gradio/client ──────────────
export const runtime = "nodejs";
export const maxDuration = 120;

// ── Rate limiter ──────────────────────────────────────────────────────────
const RL = new Map<string, { n: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const e = RL.get(ip);
  if (!e || now > e.reset) {
    RL.set(ip, { n: 1, reset: now + 3_600_000 });
    return false;
  }
  if (e.n >= 10) return true;
  e.n++;
  return false;
}

export async function POST(req: NextRequest) {
  // Rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit: max 10 transcriptions per hour." },
      { status: 429 }
    );
  }

  // Parse form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  // Convert File → Blob (what @gradio/client expects, same as HF's example code)
  const arrayBuffer = await file.arrayBuffer();
  const blob = new Blob([arrayBuffer], { type: file.type || "audio/wav" });

  try {
    // Connect to the Space — exactly as HuggingFace's "Use via API" page shows
    const client = await Client.connect("ooloteam/SomaliSpeechToText");

    // Call the transcription endpoint with the correct parameter names
    // from HuggingFace's API page: audio_file, mic_file, video_file
    const result = await client.predict("/transcribe_file", {
      audio_file: blob,   // ← our uploaded file goes here
      mic_file: null,     // ← not used
      video_file: null,   // ← not used
    });

    // result.data is [transcript_text, stats_string, file_obj_or_null]
    const data = result.data as unknown[];
    const text = data[0] as string;
    const stats = data[1] as string ?? "";

    if (!text || text.startsWith("⚠️") || text.startsWith("❌")) {
      return NextResponse.json({ error: text || "Transcription failed." }, { status: 422 });
    }

    return NextResponse.json({ text: text.trim(), stats, duration: null });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Transcription error:", msg);

    // Give a user-friendly message for the "Space is sleeping" case
    if (msg.includes("503") || msg.includes("502") || msg.includes("sleeping")) {
      return NextResponse.json(
        { error: "The transcription service is waking up. Please wait 30 seconds and try again." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Transcription service unavailable. Please try again." },
      { status: 502 }
    );
  }
}
