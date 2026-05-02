import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const maxDuration = 120;

const HF_SPACE_URL =
  process.env.HF_SPACE_URL ||
  "https://ooloteam-somalispeechtotext.hf.space/api/predict";

const RATE_LIMIT_MAP = new Map<string, { count: number; reset: number }>();
const MAX_REQUESTS_PER_HOUR = 10;

function getRateLimitKey(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT_MAP.get(key);
  if (!entry || now > entry.reset) {
    RATE_LIMIT_MAP.set(key, { count: 1, reset: now + 3_600_000 });
    return false;
  }
  if (entry.count >= MAX_REQUESTS_PER_HOUR) return true;
  entry.count++;
  return false;
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getRateLimitKey(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Maximum 10 transcriptions per hour per IP." },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    // Size check (50MB)
    if (file.size > 52_428_800) {
      return NextResponse.json(
        { error: "File too large. Maximum 50 MB." },
        { status: 413 }
      );
    }

    // Convert file to base64 for HF Gradio API
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // Call the HuggingFace Gradio Space
    const hfResponse = await fetch(HF_SPACE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: [dataUrl, null], // [audio_input, video_input]
      }),
    });

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      console.error("HF Space error:", errText);
      return NextResponse.json(
        { error: "Transcription service unavailable. Please try again." },
        { status: 502 }
      );
    }

    const hfData = await hfResponse.json();

    // Gradio returns { data: [text, stats, file_path] }
    const [text, stats] = hfData.data ?? [];

    if (!text || text.startsWith("⚠️") || text.startsWith("❌")) {
      return NextResponse.json(
        { error: text || "Transcription failed." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      text: text.trim(),
      stats: stats ?? "",
      duration: null,
    });
  } catch (err: any) {
    console.error("Transcription proxy error:", err);
    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}
