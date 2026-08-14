import { Pill, Footprints, Droplet } from "lucide-react";

export const seniorProfile = {
  name: "Raman",
  language: "English",
  voice: "Warm & Gentle",
};

export const reminders = [
  { icon: Pill,       title: "Blood pressure medicine", time: "8:00 AM",       taken: true  },
  { icon: Pill,       title: "Evening medicine",        time: "8:00 PM",       taken: false },
  { icon: Footprints, title: "Evening walk",            time: "6:00 PM",       taken: false },
  { icon: Droplet,    title: "Drink water",             time: "Every 2 hours", taken: true  },
];

export const nextReminder = {
  title: "Evening medicine",
  time: "8:00 PM",
  status: "upcoming",
};

export const onboardingLanguages = ["தமிழ்", "हिन्दी", "English"];

export const onboardingInterests = [
  ["Music",     "🎵"],
  ["Gardening", "🌱"],
  ["Cricket",   "🏏"],
  ["Movies",    "🎬"],
  ["Reading",   "📖"],
];

export const onboardingVoices = [
  "Warm & Gentle",
  "Clear & Simple",
  "Friendly & Cheerful",
];

export const voiceTranscripts = {
  idle:      "Tap the microphone whenever you'd like to talk.",
  listening: "\u201cGood morning Bhavi, how are you?\u201d",
  thinking:  "Bhavi is thinking about what you said...",
  speaking:  "\u201cGood morning! I'm doing well, thank you for asking.\u201d",
};
