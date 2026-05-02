import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | Somali Speech-to-Text",
  description:
    "Learn about the wav2vec2-somali model, the research behind it, and the mission to make Somali language technology accessible to everyone.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--dark)" }}>
      {/* Nav */}
      <nav
        className="border-b border-slate-800/60 backdrop-blur-sm sticky top-0 z-40"
        style={{ background: "rgba(10,15,30,0.9)" }}
      >
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-white text-lg">
            <span className="text-2xl">🎙️</span> SomaliSTT
          </Link>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/api-docs" className="hover:text-white transition-colors">API</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">About SomaliSTT</h1>
          <p className="text-xl text-slate-400 leading-relaxed">
            The first free, community-facing automatic speech recognition platform for the Somali language.
          </p>
        </div>

        {/* Mission */}
        <section className="panel p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">🌍 Mission</h2>
          <p className="text-slate-400 leading-relaxed mb-4">
            Somali is spoken by over 25 million people worldwide — in the Horn of Africa, across the Gulf,
            and in diaspora communities in Europe and North America. Despite this, Somali remains one of the
            most underserved languages in modern AI and speech technology.
          </p>
          <p className="text-slate-400 leading-relaxed">
            SomaliSTT exists to change that. By wrapping the best available open-source Somali ASR model
            in a simple, free web interface, we make powerful speech technology accessible to journalists,
            researchers, educators, and everyday Somali speakers — no coding required.
          </p>
        </section>

        {/* Model stats */}
        <section className="panel p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">📊 Model Performance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Word Error Rate", value: "0.20", note: "Best in class for Somali" },
              { label: "Parameters", value: "315M", note: "Full wav2vec2-large" },
              { label: "Architecture", value: "wav2vec2", note: "Facebook AI Research" },
              { label: "Downloads", value: "636+", note: "HuggingFace downloads" },
            ].map((s) => (
              <div key={s.label} className="text-center p-4 rounded-xl" style={{ background: "#0a1628", border: "1px solid #1e293b" }}>
                <div className="text-2xl font-bold mb-1" style={{ color: "#0d7377" }}>{s.value}</div>
                <div className="text-xs font-medium text-white mb-1">{s.label}</div>
                <div className="text-xs text-slate-600">{s.note}</div>
              </div>
            ))}
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            The <strong className="text-white">wav2vec2-somali</strong> model achieves a Word Error Rate
            of 0.20 — meaning it transcribes Somali speech with 80% word-level accuracy, far exceeding
            any general-purpose ASR system on Somali audio. This was achieved by fine-tuning
            Facebook AI Research's wav2vec2-large architecture on a curated Somali speech dataset.
          </p>
        </section>

        {/* Research */}
        <section className="panel p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">🔬 Research Background</h2>
          <p className="text-slate-400 leading-relaxed mb-4">
            This model was developed as part of research into NLP and AI for low-resource Somali language.
            The work builds on a foundation of toxic speech detection on Somali social media — applying
            modern transformer architectures to a language that has historically lacked sufficient
            annotated training data.
          </p>
          <p className="text-slate-400 leading-relaxed">
            The underlying research demonstrates that state-of-the-art results are achievable for Somali
            with targeted data collection and fine-tuning strategies, even without the massive datasets
            available for high-resource languages like English, Arabic, or Mandarin.
          </p>
        </section>

        {/* Use cases */}
        <section className="panel p-8 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">🎯 Who Is This For?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: "📰", title: "Journalists", desc: "Transcribe interviews and field recordings from Somali sources in minutes instead of hours." },
              { icon: "🎓", title: "Researchers", desc: "Process large Somali audio datasets for linguistic, social, or political research." },
              { icon: "🎬", title: "Content Creators", desc: "Generate subtitles for Somali-language videos and podcasts automatically." },
              { icon: "🏛️", title: "NGOs & Government", desc: "Digitise Somali audio archives and make spoken records searchable and accessible." },
              { icon: "🏫", title: "Educators", desc: "Create transcripts of Somali educational audio for learning materials." },
              { icon: "👨‍💻", title: "Developers", desc: "Access the transcription capability via REST API to build your own Somali NLP applications." },
            ].map((u) => (
              <div key={u.title} className="flex gap-4 p-4 rounded-xl" style={{ background: "#0a1628", border: "1px solid #1e293b" }}>
                <span className="text-2xl">{u.icon}</span>
                <div>
                  <h3 className="font-semibold text-white mb-1">{u.title}</h3>
                  <p className="text-sm text-slate-500">{u.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Open source */}
        <section className="panel p-8">
          <h2 className="text-2xl font-bold text-white mb-4">🤝 Open Source & Community</h2>
          <p className="text-slate-400 leading-relaxed mb-4">
            SomaliSTT is fully open source. The model is available on HuggingFace under an Apache 2.0
            licence, and the web platform source code is on GitHub. Contributions, bug reports, and
            community feedback are welcome.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="https://huggingface.co/ooloteam/wav2vec2-somali" target="_blank"
              className="px-5 py-2.5 rounded-xl font-medium text-sm text-white transition-all"
              style={{ background: "linear-gradient(135deg, #0d7377, #14a085)" }}>
              🤗 Model on HuggingFace →
            </a>
            <a href="https://github.com/ooloteam/somali-stt-platform" target="_blank"
              className="px-5 py-2.5 rounded-xl font-medium text-sm transition-all"
              style={{ background: "#1e293b", border: "1px solid #334155", color: "#94a3b8" }}>
              📦 GitHub Repository →
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
