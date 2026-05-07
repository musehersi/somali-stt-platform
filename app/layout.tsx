import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Somali Speech-to-Text | Free Online Transcription",
  description:
    "Transcribe Somali audio and video online for free. Powered by wav2vec2-somali — the best Somali ASR model with 0.20 WER.",
  keywords: [
    "Somali speech to text",
    "Somali transcription",
    "Af Somali audio to text",
    "Somali ASR",
    "automatic speech recognition Somali",
    "transcribe Somali audio free",
  ],
  openGraph: {
    title: "Somali Speech-to-Text",
    description: "Free Somali audio and video transcription powered by AI",
    type: "website",
    locale: "so_SO",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="so">
      <body className={inter.className}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
