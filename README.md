# SeniorMind 🧠

> A voice-first AI companion designed to make technology simpler and more accessible for senior citizens.

SeniorMind is a mobile-first product built around a simple idea:

**Seniors should be able to interact with technology as naturally as they talk to another person.**

Instead of complicated navigation and typing, SeniorMind focuses on a simple voice-first experience with **Bhavi**, an AI companion.

---

## 🎯 Vision

SeniorMind aims to help seniors:

- 🗣️ Communicate naturally through voice
- ❤️ Reduce loneliness through conversation
- 🔔 Manage daily reminders
- 👨‍👩‍👧 Stay connected with family and caregivers
- 🤖 Receive a simple, friendly AI companion experience

The senior should not need to understand how the technology works.

They should simply be able to **open the app and talk**.

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
Talk with Bhavi
      ↓
AI processes the conversation
      ↓
Bhavi responds naturally
```

The interface is designed with:

- Large touch targets
- Simple navigation
- Large readable text
- High contrast
- Minimal screens
- Voice-first interaction

---

## 🤖 Bhavi

**Bhavi** is the AI companion inside SeniorMind.

The goal is not to create a traditional chatbot where the senior needs to type messages.

Instead:

```text
Senior speaks
     ↓
Speech-to-Text
     ↓
Conversation Intelligence
     ↓
AI Response
     ↓
Text-to-Speech
     ↓
Bhavi speaks
```

The voice and AI layer will be integrated incrementally as development continues.

---

## 🔔 Reminders

SeniorMind provides a simple reminder experience for everyday activities.

Potential examples include:

- Medication reminders
- Appointments
- Daily activities
- Important events

The interface is designed so seniors can understand reminders without navigating complicated screens.

---

## 👨‍👩‍👧 Caregiver & Family Support

A future version of SeniorMind will allow authorized caregivers or family members to receive useful information from senior interactions.

Rather than overwhelming them with complete conversations, the system can be designed to provide relevant summaries such as:

- Mood
- Medication-related information
- Important events
- Changes in behavior
- Concerns mentioned by the senior

The goal is to provide **useful information instead of unnecessary raw conversation data**.

---

## 👨‍⚕️ Healthcare Professional Support

A future healthcare portal can provide authorized professionals with summarized wellbeing and behavioral information.

Potential capabilities include:

- Conversation summaries
- Mood trends
- Behavioral observations
- Important events
- Historical trends

SeniorMind is intended to support professional care, not replace medical judgment.

---

# 🏗️ Current Architecture

The current version focuses on the senior mobile UI/UX.

```text
SeniorMind Mobile App
        │
        ├── Onboarding
        ├── Home
        ├── Bhavi
        ├── Reminders
        ├── More
        └── Help
```

The project uses reusable React components instead of keeping the entire application in one large component.

---

# 📁 Project Structure

```text
senior AI/
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── README.md
│
├── public/
│   └── favicon.svg
│
└── src/
    │
    ├── main.jsx
    ├── SeniorApp.jsx
    │
    ├── context/
    │   └── ThemeContext.jsx
    │
    ├── data/
    │   └── seniorMockData.js
    │
    ├── components/
    │   └── senior/
    │       ├── BhaviAvatar.jsx
    │       ├── BigButton.jsx
    │       ├── BottomNav.jsx
    │       ├── ReminderCard.jsx
    │       ├── ScreenShell.jsx
    │       ├── SeniorHeader.jsx
    │       ├── SettingsRow.jsx
    │       ├── SettingsToggleRow.jsx
    │       ├── ToggleSwitch.jsx
    │       ├── TopBar.jsx
    │       ├── VoiceButton.jsx
    │       └── VoiceState.jsx
    │
    └── pages/
        └── senior/
            ├── Bhavi.jsx
            ├── Help.jsx
            ├── Home.jsx
            ├── More.jsx
            ├── Onboarding.jsx
            └── Reminders.jsx
```

---

# 🛠️ Tech Stack

### Current

- React
- JavaScript / JSX
- Vite
- CSS
- Git
- GitHub

### Planned AI / Backend Architecture

```text
Voice Input
     ↓
Speech-to-Text
     ↓
Conversation / LLM Layer
     ↓
Response Generation
     ↓
Text-to-Speech
     ↓
Voice Output
```

The production AI stack will be selected based on quality, latency, cost, privacy, and reliability.

---

# 🚀 Getting Started

## 1. Clone the repository

```bash
git clone https://github.com/yasinmass/seniormind.git
```

## 2. Enter the project

```bash
cd seniormind
```

## 3. Install dependencies

```bash
npm install
```

## 4. Start the development server

```bash
npm run dev
```

The application will normally be available at:

```text
http://localhost:5173
```

---

# 📱 Development Status

### Completed

- [x] Senior mobile UI/UX
- [x] Senior onboarding
- [x] Personalized home screen
- [x] Large microphone interaction
- [x] Bhavi conversation UI
- [x] Voice interaction states
- [x] Reminder UI
- [x] More/settings UI
- [x] Help screen
- [x] Senior navigation
- [x] Reusable React components
- [x] Project code organization
- [x] GitHub repository

### In Development

- [ ] Real microphone input
- [ ] Speech-to-Text
- [ ] Bhavi AI conversation engine
- [ ] Text-to-Speech
- [ ] Conversation storage
- [ ] Conversation analysis
- [ ] Caregiver/family portal
- [ ] Healthcare professional portal
- [ ] Authentication
- [ ] Production deployment

---

# 🔮 Planned Product Architecture

```text
                       SENIOR
                          │
                          ▼
                  SeniorMind App
                          │
                    🎤 Voice Input
                          │
                          ▼
                   Speech-to-Text
                          │
                          ▼
                 Conversation Engine
                     │          │
                     │          └──────────────┐
                     ▼                         ▼
                 Bhavi AI               Conversation
                  Response                Analysis
                     │                         │
                     ▼                         ▼
                Text-to-Speech          Structured Data
                     │                         │
                     ▼                         ▼
               🔊 Senior               Caregiver / Family
                                               │
                                               ▼
                                           Doctor
```

---

# 🔐 Privacy & Safety

SeniorMind is being designed with privacy and responsible AI as important principles.

The product should:

- Minimize unnecessary data collection
- Protect personal conversations
- Use authenticated access
- Restrict caregiver and professional access to authorized users
- Avoid exposing unnecessary raw conversations
- Clearly distinguish AI-generated information from professional medical decisions

SeniorMind is intended to **support** seniors, caregivers, and healthcare professionals — not replace medical professionals.

---

# 🎯 Product Goal

The goal of SeniorMind is simple:

> **Make technology feel less like technology for seniors.**

A senior should be able to open the application, tap one button, and simply talk.

Everything complicated should happen behind the scenes.

---

## 📌 Project Status

**SeniorMind is actively under development.**

The current repository contains the senior-facing mobile UI/UX and its component architecture. Voice processing, AI conversation, intelligent conversation analysis, caregiver features, and production infrastructure will be developed incrementally.

---

## 👨‍💻 Repository

GitHub: https://github.com/yasinmass/seniormind

