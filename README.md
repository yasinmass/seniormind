# SeniorMind 🧠

> A voice-first AI companion designed to make technology simpler and more accessible for senior citizens.

SeniorMind is a mobile-first product built around a simple idea:

**Seniors should be able to interact with technology as naturally as they talk to another person.**

Instead of complicated navigation and typing, SeniorMind focuses on a simple voice-first experience with **Bhavi**, an AI companion.

---

## 🎯 Vision

SeniorMind aims to help seniors:

- 🗣️ Communicate naturally through voice in **English**, **Hindi**, and **Tamil**
- ❤️ Reduce loneliness through conversation
- 🔔 Manage daily reminders
- 👨‍👩‍👧 Stay connected with family and caregivers
- 🤖 Receive a simple, friendly AI companion experience

The senior should not need to understand how the technology works. They should simply be able to **open the app and talk**.

---

## 👴 Senior Experience

The senior-facing application is intentionally simple.

### Main Flow

```text
Open SeniorMind
      ↓
Personalized Home Screen
      ↓
Tap the large microphone button
      ↓
Talk with Bhavi (English / Hindi / Tamil)
      ↓
AI processes the conversation with memory
      ↓
Bhavi responds naturally (Voice + Text)
```

The interface is designed with:
- Large touch targets
- Simple navigation
- Large readable text
- High contrast
- Minimal screens
- Voice-first interaction

---

## 🤖 Bhavi & Voice Pipeline Architecture

**Bhavi** is the AI companion inside SeniorMind powered by a 100% local, privacy-first voice pipeline:

```text
Senior Speaks (Browser Mic)
     ↓
Speech-to-Text (Faster-Whisper)
     ↓
Language Detection (en / hi / ta)
     ↓
Conversation Memory Layer (Short-term & Persistent)
     ↓
Ollama (llama3.2:3b) LLM Response
     ↓
Multilingual Text-to-Speech (Piper ONNX)
     ↓
Bhavi Speaks Aloud (Base64 WAV Audio)
```

---

## 🚀 How to Run the Code

> ⚠️ **You need to open 3 separate terminal windows.** Each service must run in its own terminal simultaneously.

---

### 📋 Prerequisites (First Time Only)

Make sure you have installed:
1. **Node.js** (v18+) — [nodejs.org](https://nodejs.org/)
2. **Python** (v3.12+) — [python.org](https://python.org/)
3. **Ollama** — [ollama.com](https://ollama.com/)

Then pull the AI model (run once):
```bash
ollama pull llama3.2:3b
```

---

### 🖥️ TERMINAL 1 — Ollama (AI Brain)

Open a new terminal and run:

```bash
ollama serve
```

✅ You should see: `Listening on 127.0.0.1:11434`

> Keep this terminal open. Do not close it.
>
> If you see `bind: Only one usage of each socket address` — Ollama is **already running**, which is fine. You can skip this step.

---

### 🖥️ TERMINAL 2 — Django Backend (Voice Pipeline)

Open a **second** terminal, then run these commands one by one:

**Step 1 — Go to the backend folder:**
```powershell
cd "senior AI\backend"
```

**Step 2 — Activate the Python virtual environment:**

Windows (PowerShell):
```powershell
.\venv\Scripts\Activate.ps1
```

macOS / Linux:
```bash
source venv/bin/activate
```

> You should see `(venv)` appear at the start of your terminal prompt.

**Step 3 — Apply database setup (first time only):**
```bash
python manage.py migrate
```

**Step 4 — Start the server:**
```bash
python manage.py runserver
```

✅ You should see:
```
Django version 6.1 ...
Starting development server at http://127.0.0.1:8000/
```

> Keep this terminal open. Do not close it.

---

### 🖥️ TERMINAL 3 — React Frontend (Web App)

Open a **third** terminal, then run:

**Step 1 — Go to the project root:**
```powershell
cd "senior AI"
```

**Step 2 — Install dependencies (first time only):**
```bash
npm install
```

**Step 3 — Start the frontend:**
```bash
npm run dev
```

✅ You should see:
```
VITE v5.x.x  ready in ...ms
➜  Local:   http://localhost:5173/
```

---

### ✅ Everything is Running — Open the App

Open your browser and go to:

```
http://localhost:5173/
```

1. Allow **microphone access** when the browser asks
2. Tap the **big blue microphone button**
3. Speak clearly for 2–3 seconds
4. Release the button and wait for Bhavi to respond

---

### 🔁 Every Time You Start (After First Setup)

After the first setup, you only need to run these 3 commands in 3 terminals:

| Terminal | Command |
| :--- | :--- |
| Terminal 1 | `ollama serve` |
| Terminal 2 | `cd backend` → activate venv → `python manage.py runserver` |
| Terminal 3 | `npm run dev` |

---

### ❌ Common Errors & Fixes

| Error | Cause | Fix |
| :--- | :--- | :--- |
| `503 Service Unavailable` | Ollama is not running | Run `ollama serve` in Terminal 1 |
| `503 Service Unavailable` | Django is not running | Run `python manage.py runserver` in Terminal 2 |
| `422 Unprocessable Entity` | No speech detected in audio | Speak clearly for 2–3 seconds after pressing the mic button |
| `bind: Only one usage of each socket` | Ollama is already running | This is fine — skip `ollama serve`, it's already active |
| `ModuleNotFoundError` | Virtual environment not activated | Run `.\venv\Scripts\Activate.ps1` first, then retry |
| Mic not working | Browser blocked microphone | Click the 🔒 icon in the browser address bar → Allow microphone |

---

## 🧪 Testing & Verification Commands

You can run automated test scripts from the `backend/` directory (with `venv` activated):

```bash
cd backend

# 1. System check
python manage.py check

# 2. Test Short-Term Conversation Memory (Stage 7)
python test_conversation_memory.py

# 3. Test Persistent User Memory Foundation (Stage 8.1)
python test_user_memory.py

# 4. Test Multilingual TTS (English, Hindi, Tamil)
python test_tts_languages.py

# 5. Test Full End-to-End Pipeline (STT → LLM → TTS)
python test_pipeline_multilingual.py
```

---

## 📁 Project Structure

```text
senior AI/
├── package.json
├── vite.config.js
├── index.html
├── README.md
│
├── src/                          # Frontend React Application (Vite)
│   ├── SeniorApp.jsx
│   ├── main.jsx
│   ├── components/senior/       # Reusable Senior UI Components
│   ├── context/                 # ThemeContext
│   ├── data/                    # Mock Data
│   └── pages/senior/            # Home, Bhavi, Reminders, More, Help, Onboarding
│
└── backend/                     # Django Backend (Python 3.12)
    ├── manage.py
    ├── db.sqlite3
    ├── config/                  # Django project settings & URLs
    ├── voice/                   # Voice & Memory App
    │   ├── admin.py
    │   ├── models.py            # UserMemory database model
    │   ├── urls.py
    │   ├── views.py             # Audio upload & Memory REST API
    │   └── services/
    │       ├── stt.py           # Faster-Whisper Speech-to-Text
    │       ├── llm.py           # Ollama llama3.2:3b Integration
    │       ├── tts.py           # Piper Multilingual TTS (EN, HI, TA)
    │       ├── memory.py        # Short-Term Session Memory
    │       └── memory_store.py  # Persistent User Memory Service
    │
    └── models/tts/              # Piper ONNX Voice Models
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 + Vite
- **UI & Icons:** Vanilla CSS + Lucide React
- **Audio Recording:** Browser Web MediaRecorder API

### Backend & AI Pipeline (100% Local & Free)
- **Backend:** Django 6.1 (Python 3.12)
- **STT (Speech-to-Text):** Faster-Whisper (`small` model)
- **LLM (Language Model):** Ollama (`llama3.2:3b`)
- **TTS (Text-to-Speech):** Piper TTS (ONNX)
  - English: `en_US-lessac-medium`
  - Hindi: `hi_IN-priyamvada-medium`
  - Tamil: `ta_IN-rasa_female-medium`
- **Memory Layer:** Dual-layer memory (Short-term session history + SQLite persistent user memory)

---

## 🔐 Privacy & Safety

SeniorMind is designed with privacy and safety as core principles:
- **100% Offline AI:** All STT, LLM, and TTS inference runs locally on the user's/server's machine. Zero voice data sent to cloud APIs.
- **Explicit Memory Storage:** Personal details (like names or language preferences) are stored explicitly via memory services, never scraped blindly.
- **Isolated User Memory:** Memory records are strictly scoped per user identifier.

---

## 👨‍💻 Repository & License

GitHub: [https://github.com/yasinmass/seniormind](https://github.com/yasinmass/seniormind)
