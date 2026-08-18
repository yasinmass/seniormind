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

Follow these step-by-step instructions to run both the **Backend AI Voice Pipeline** and the **Frontend Web App** locally.

### 📋 Prerequisites

Make sure you have installed:
1. **Node.js** (v18+)
2. **Python** (v3.12+)
3. **Ollama** (Local LLM runner — [Download Ollama](https://ollama.com/))

---

### 1️⃣ Step 1: Start Ollama (LLM Service)

Open a terminal and ensure Ollama has the `llama3.2:3b` model downloaded:

```bash
# Download model (First time only)
ollama pull llama3.2:3b

# Start Ollama server
ollama serve
```
*Keep this terminal running.*

---

### 2️⃣ Step 2: Set Up & Run Django Backend

Open a second terminal and navigate to the `backend/` directory:

```bash
cd "senior AI/backend"
```

Activate the Python virtual environment:

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**Linux / macOS:**
```bash
source venv/bin/activate
```

Apply database migrations:
```bash
python manage.py migrate
```

Start the Django development server:
```bash
python manage.py runserver 8000
```

The backend server will run at: `http://127.0.0.1:8000/api/`

---

### 3️⃣ Step 3: Set Up & Run React Frontend

Open a third terminal in the project root directory:

```bash
cd "senior AI"
```

Install frontend dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```

The frontend web app will be live at:
```text
http://localhost:5173/
```

Open `http://localhost:5173/` in your browser, allow microphone permissions, tap the big blue microphone button, and start talking to Bhavi!

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
