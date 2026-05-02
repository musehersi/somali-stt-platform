import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "API Docs | Somali Speech-to-Text",
  description: "REST API documentation for the Somali Speech-to-Text transcription service.",
};

const codeBlock = (code: string) => (
  <pre className="overflow-x-auto p-5 rounded-xl text-sm leading-relaxed"
    style={{ background: "#0a1628", border: "1px solid #1e293b", color: "#e2e8f0" }}>
    <code>{code}</code>
  </pre>
);

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--dark)" }}>
      {/* Nav */}
      <nav className="border-b border-slate-800/60 backdrop-blur-sm sticky top-0 z-40"
        style={{ background: "rgba(10,15,30,0.9)" }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg">
            <span className="text-2xl">🎙️</span> SomaliSTT
          </Link>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-white mb-2">API Documentation</h1>
        <p className="text-slate-400 mb-12 text-lg">
          Integrate Somali speech-to-text into your own application via a simple REST endpoint.
        </p>

        {/* Endpoint */}
        <section className="panel p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">📡 Endpoint</h2>
          <div className="flex items-center gap-3 p-4 rounded-xl mb-4"
            style={{ background: "#0a1628", border: "1px solid #1e293b" }}>
            <span className="px-2.5 py-1 rounded text-xs font-bold" style={{ background: "rgba(13,115,119,0.3)", color: "#14a085" }}>POST</span>
            <code className="text-white font-mono">/api/transcribe</code>
          </div>
          <p className="text-slate-400 text-sm">
            Accepts a multipart form upload with an audio or video file. Returns a JSON object with the Somali transcription.
          </p>
        </section>

        {/* Request */}
        <section className="panel p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">📤 Request</h2>
          <p className="text-slate-400 text-sm mb-4"><strong className="text-white">Content-Type:</strong> multipart/form-data</p>
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 pr-4 text-slate-400 font-medium">Field</th>
                <th className="text-left py-2 pr-4 text-slate-400 font-medium">Type</th>
                <th className="text-left py-2 text-slate-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800/50">
                <td className="py-3 pr-4"><code className="text-teal-400">file</code></td>
                <td className="py-3 pr-4 text-slate-500">File</td>
                <td className="py-3 text-slate-400">Audio or video file. Max 50 MB. Max duration 10 minutes.</td>
              </tr>
            </tbody>
          </table>
          <p className="text-slate-400 text-sm mb-3"><strong className="text-white">Supported formats:</strong></p>
          <div className="flex flex-wrap gap-2">
            {["MP3","WAV","OGG","FLAC","M4A","OPUS","MP4","WebM","MKV","MOV"].map(f => (
              <span key={f} className="px-2.5 py-1 rounded text-xs font-mono"
                style={{ background: "#1e293b", color: "#94a3b8" }}>{f}</span>
            ))}
          </div>
        </section>

        {/* Response */}
        <section className="panel p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">📥 Response</h2>
          <p className="text-slate-400 text-sm mb-4"><strong className="text-white">Content-Type:</strong> application/json</p>
          {codeBlock(`{
  "text": "Waa maxay warka maanta?",   // Somali transcription
  "stats": "Transcription complete in 3.2s | Words: 4 | Characters: 22",
  "duration": 5.4                       // Audio duration in seconds
}`)}
          <p className="text-slate-400 text-sm mt-4 mb-3"><strong className="text-white">Error response:</strong></p>
          {codeBlock(`{
  "error": "Human-readable error message"
}`)}
        </section>

        {/* Examples */}
        <section className="panel p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-6">💻 Code Examples</h2>

          <h3 className="text-white font-semibold mb-3">JavaScript / Fetch</h3>
          {codeBlock(`const formData = new FormData();
formData.append('file', audioFile); // audioFile is a File object

const response = await fetch('https://your-domain.com/api/transcribe', {
  method: 'POST',
  body: formData,
});

const data = await response.json();
console.log(data.text); // "Waa maxay warka maanta?"`)}

          <h3 className="text-white font-semibold mb-3 mt-8">Python / requests</h3>
          {codeBlock(`import requests

with open('somali_audio.mp3', 'rb') as f:
    response = requests.post(
        'https://your-domain.com/api/transcribe',
        files={'file': ('audio.mp3', f, 'audio/mpeg')}
    )

data = response.json()
print(data['text'])  # "Waa maxay warka maanta?"`)}

          <h3 className="text-white font-semibold mb-3 mt-8">cURL</h3>
          {codeBlock(`curl -X POST https://your-domain.com/api/transcribe \\
  -F "file=@somali_audio.mp3" \\
  -H "Accept: application/json"`)}
        </section>

        {/* Rate limits */}
        <section className="panel p-8">
          <h2 className="text-xl font-bold text-white mb-4">⚡ Rate Limits</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Requests per hour", value: "10 / IP" },
              { label: "Max file size", value: "50 MB" },
              { label: "Max audio duration", value: "10 minutes" },
            ].map(r => (
              <div key={r.label} className="p-4 rounded-xl text-center"
                style={{ background: "#0a1628", border: "1px solid #1e293b" }}>
                <div className="text-xl font-bold mb-1" style={{ color: "#0d7377" }}>{r.value}</div>
                <div className="text-xs text-slate-500">{r.label}</div>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-sm mt-5">
            Need higher limits? The platform is open source — you can self-host your own instance
            with custom limits using the <a href="https://github.com/ooloteam/somali-stt-platform"
              target="_blank" className="hover:text-teal-400" style={{ color: "#0d7377" }}>GitHub repository</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
