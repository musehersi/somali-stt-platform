# 🎙️ Somali Speech-to-Text Platform

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ooloteam/somali-stt-platform)
[![Model on HuggingFace](https://img.shields.io/badge/🤗_Model-wav2vec2--somali-teal)](https://huggingface.co/ooloteam/wav2vec2-somali)
[![License](https://img.shields.io/badge/license-Apache_2.0-blue)](LICENSE)

**The first free, community-facing Somali automatic speech recognition web platform.**

Transcribe Somali audio and video online — powered by [`ooloteam/wav2vec2-somali`](https://huggingface.co/ooloteam/wav2vec2-somali), the best open-source Somali ASR model with **WER 0.20**.

## ✨ Features

- 🎵 **Audio** — MP3, WAV, OGG, FLAC, M4A, OPUS
- 🎬 **Video** — MP4, WebM, MKV, MOV (audio extracted automatically)
- ⬇️ **Download** transcript as `.txt`
- ⚡ **Chunked inference** — handles files up to 10 minutes
- 🔒 **Private** — files are never stored
- 🆓 **Free forever** — ad-supported, no account required

## 🏗️ Architecture

```
User Browser
    │
    ├── Next.js 14 (Vercel CDN - Free)
    │       │
    │       └── /api/transcribe  (Vercel Edge Function)
    │               │
    │               └── HuggingFace Gradio Space
    │                       │
    │                       └── ooloteam/wav2vec2-somali
    │                           (wav2vec2, 315M params, WER 0.20)
```

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/ooloteam/somali-stt-platform.git
cd somali-stt-platform
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local — set HF_SPACE_URL
```

### 3. Run Development Server

```bash
npm run dev
# Open http://localhost:3000
```

### 4. Deploy to Vercel

```bash
npx vercel --prod
```

Or click the **Deploy with Vercel** button above.

## ⚙️ Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HF_SPACE_URL` | HuggingFace Gradio Space API URL | `https://ooloteam-somalispeechtotext.hf.space/api/predict` |

## 📁 Project Structure

```
somali-stt-platform/
├── app/
│   ├── layout.tsx          # Root layout + metadata
│   ├── page.tsx            # Main transcription interface
│   ├── globals.css         # Global styles + Tailwind
│   ├── about/
│   │   └── page.tsx        # About page
│   ├── api-docs/
│   │   └── page.tsx        # API documentation page
│   └── api/
│       └── transcribe/
│           └── route.ts    # Edge function: proxies to HF Space
├── public/                 # Static assets
├── next.config.js
├── tailwind.config.ts
├── vercel.json
└── package.json
```

## 🤖 HuggingFace Space

The inference backend is a Gradio Space: [`ooloteam/SomaliSpeechToText`](https://huggingface.co/spaces/ooloteam/SomaliSpeechToText)

The Space files are in `hf-space/` (tracked separately):
- `app.py` — Gradio interface + transcription logic
- `requirements.txt` — Python dependencies
- `README.md` — Space model card

## 📡 REST API

```bash
POST /api/transcribe
Content-Type: multipart/form-data

# Field: file (audio or video, max 50MB)
```

**Response:**
```json
{
  "text": "Waa maxay warka maanta?",
  "stats": "Transcription complete in 3.2s | Words: 4",
  "duration": 5.4
}
```

See [API Docs](/api-docs) for full documentation and code examples.

## 🤝 Contributing

Contributions welcome! Please open an issue or pull request.

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

## 📜 License

Apache 2.0 — see [LICENSE](LICENSE)

## 🙏 Acknowledgements

- Model: `ooloteam/wav2vec2-somali`
- Base architecture: [facebook/wav2vec2-large](https://huggingface.co/facebook/wav2vec2-large)
- Hosting: [Vercel](https://vercel.com) + [HuggingFace Spaces](https://huggingface.co/spaces)

---

Built with ❤️ for the Somali-speaking community.
