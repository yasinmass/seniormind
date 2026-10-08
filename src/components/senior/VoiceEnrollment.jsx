/**
 * VoiceEnrollment.jsx
 *
 * Stage 11 Phase 3 — Personalized Voice Enrollment UI (updated for OpenVoice)
 *
 * Allows an elderly user (or their carer) to:
 *   1. Check current voice configuration
 *   2. Choose between:
 *        a. FREE local OpenVoice V2 (record mic → stored locally, no cloud)
 *        b. ElevenLabs cloud voice cloning (requires API key on backend)
 *   3. Record a ~20–30 s voice sample using the microphone
 *   4. Confirm legal consent
 *   5. Submit to the chosen provider
 *   6. Disable personalized voice and revert to Piper
 *
 * Security rules:
 *   - API keys are NEVER passed to or seen by this component
 *   - Filesystem paths are NEVER shown to the user
 *   - Recording data is sent directly to the Django backend and never cached locally
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, CheckCircle, XCircle, Loader, Volume2, Trash2, Cpu, Cloud } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const API_BASE = "http://localhost:8000/api";

const CONSENT_TEXT =
  "I confirm that I own this voice or have permission from the voice owner to create and use this voice.";

// Enrollment provider options
const PROVIDER = {
  OPENVOICE: "openvoice",
  ELEVENLABS: "elevenlabs",
};

// Enroll step states
const STEP = {
  IDLE:       "idle",       // nothing started
  RECORDING:  "recording",  // mic active
  REVIEW:     "review",     // recording done, awaiting consent + submit
  UPLOADING:  "uploading",  // POST in flight
  SUCCESS:    "success",    // enrolled
  ERROR:      "error",      // something failed
};

// Minimum recording before warning (seconds) — soft hint only, server enforces
const MIN_RECORD_SECS = 20;

export default function VoiceEnrollment({ userIdentifier = "default_user" }) {
  const { theme } = useTheme();

  // ── Status of existing preference ──────────────────────────────────────────
  const [voiceStatus, setVoiceStatus] = useState(null); // null = loading
  const [statusError, setStatusError]  = useState(null);

  // ── Provider selection ───────────────────────────────────────────────────────
  const [selectedProvider, setSelectedProvider] = useState(PROVIDER.OPENVOICE);

  // ── Enrollment flow ─────────────────────────────────────────────────────────
  const [step, setStep]           = useState(STEP.IDLE);
  const [recordingBlob, setRecordingBlob] = useState(null);
  const [recordingSecs, setRecordingSecs] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [voiceName, setVoiceName] = useState("");
  const [errorMsg, setErrorMsg]   = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // MediaRecorder refs
  const mediaRecorderRef  = useRef(null);
  const streamRef         = useRef(null);
  const chunksRef         = useRef([]);
  const timerRef          = useRef(null);

  // ── Fetch existing status on mount ─────────────────────────────────────────
  const fetchStatus = useCallback(() => {
    setStatusError(null);
    fetch(`${API_BASE}/voice/personalized/status/?user_identifier=${encodeURIComponent(userIdentifier)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "ok") {
          setVoiceStatus(data);
        } else {
          setStatusError(data.error || "Could not load voice status.");
        }
      })
      .catch(() => setStatusError("Could not reach server."));
  }, [userIdentifier]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Recording helpers ───────────────────────────────────────────────────────
  const stopMic = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) {
      try { streamRef.current.getTracks().forEach((t) => t.stop()); } catch (_) {}
      streamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setRecordingBlob(null);
    setRecordingSecs(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordingBlob(blob);
        setStep(STEP.REVIEW);
      };

      recorder.start();
      setStep(STEP.RECORDING);

      // Count seconds
      timerRef.current = setInterval(() => {
        setRecordingSecs((s) => s + 1);
      }, 1000);
    } catch (err) {
      setErrorMsg("Microphone access was denied. Please allow microphone access and try again.");
      setStep(STEP.ERROR);
    }
  }, []);

  const stopRecording = useCallback(() => {
    stopMic();
    // onstop will fire and set REVIEW state
  }, [stopMic]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopMic(); };
  }, [stopMic]);

  // ── Compute the enrollment endpoint from the selected provider ───────────
  const enrollEndpoint = selectedProvider === PROVIDER.OPENVOICE
    ? `${API_BASE}/voice/personalized/openvoice/`
    : `${API_BASE}/voice/personalized/`;

  // ── Submit enrollment ────────────────────────────────────────────────────────
  const handleEnroll = useCallback(async () => {
    if (!recordingBlob) return;
    if (!consentChecked) {
      setErrorMsg("You must confirm the consent statement before enrolling.");
      return;
    }

    setStep(STEP.UPLOADING);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("audio", recordingBlob, "voice_sample.webm");
      formData.append("user_identifier", userIdentifier);
      formData.append("consent", CONSENT_TEXT);
      if (voiceName.trim()) {
        formData.append("voice_name", voiceName.trim());
      }

      const resp = await fetch(enrollEndpoint, {
        method: "POST",
        body: formData,
      });

      const data = await resp.json();

      if (data.status === "ok") {
        setSuccessMsg(data.message || "Personalized voice enrolled!");
        setStep(STEP.SUCCESS);
        fetchStatus(); // refresh the status banner
      } else {
        setErrorMsg(data.error || "Enrollment failed. Please try again.");
        setStep(STEP.ERROR);
      }
    } catch (netErr) {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStep(STEP.ERROR);
    }
  }, [recordingBlob, consentChecked, userIdentifier, voiceName, fetchStatus, enrollEndpoint]);

  // ── Disable personalized voice ───────────────────────────────────────────────
  const handleDisable = useCallback(async () => {
    setErrorMsg("");
    try {
      const resp = await fetch(`${API_BASE}/voice/personalized/disable/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_identifier: userIdentifier }),
      });
      const data = await resp.json();
      if (data.status === "ok") {
        setStep(STEP.IDLE);
        setRecordingBlob(null);
        setConsentChecked(false);
        fetchStatus();
      } else {
        setErrorMsg(data.error || "Could not disable. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Could not reach server.");
    }
  }, [userIdentifier, fetchStatus]);

  // ── Reset to start over ──────────────────────────────────────────────────────
  const handleReset = () => {
    stopMic();
    setStep(STEP.IDLE);
    setRecordingBlob(null);
    setConsentChecked(false);
    setRecordingSecs(0);
    setErrorMsg("");
    setSuccessMsg("");
  };

  // ── Colours & helpers ────────────────────────────────────────────────────────
  const card = {
    background: theme.card,
    border: `1.5px solid ${theme.border}`,
    borderRadius: 20,
    padding: "20px 22px",
    marginBottom: 16,
  };

  const btn = (bg, color = theme.white) => ({
    background: bg,
    color,
    border: "none",
    borderRadius: 14,
    padding: "12px 22px",
    fontSize: 17,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
    transition: "opacity 0.15s",
  });

  const formatSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const providerLabel = (p) =>
    p === PROVIDER.OPENVOICE ? "OpenVoice (Local / Free)" : "ElevenLabs (Cloud)";

  const isActivePersonalized = voiceStatus?.enabled || voiceStatus?.personalized_voice_active;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Current Status Banner ── */}
      <div style={{ ...card, background: theme.lightBlue }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Volume2 size={26} color={theme.primary} />
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: theme.text }}>
              Bhavi's Voice
            </p>
            {voiceStatus === null && !statusError && (
              <p style={{ margin: "4px 0 0", fontSize: 15, color: theme.textSoft }}>
                Checking voice configuration…
              </p>
            )}
            {statusError && (
              <p style={{ margin: "4px 0 0", fontSize: 15, color: theme.danger }}>
                {statusError}
              </p>
            )}
            {voiceStatus && (
              <p style={{ margin: "4px 0 0", fontSize: 15, color: theme.textSoft }}>
                {isActivePersonalized
                  ? voiceStatus.provider === "openvoice"
                    ? "✅ Custom voice active — OpenVoice (local, free)"
                    : `✅ Custom voice active — ElevenLabs (ID: ${voiceStatus.voice_id_prefix || "..."})`
                  : "🔊 Using default Bhavi voice (Piper)"}
              </p>
            )}
          </div>
        </div>

        {/* Disable button — only shown when personalized voice is active */}
        {isActivePersonalized && (
          <button
            id="voice-disable-btn"
            onClick={handleDisable}
            style={{ ...btn(theme.dangerBg, theme.danger), marginTop: 14, fontSize: 15 }}
          >
            <Trash2 size={18} /> Disable custom voice (return to Piper)
          </button>
        )}
      </div>

      {/* ── Provider Selection ── */}
      {step === STEP.IDLE && (
        <div style={{ ...card }}>
          <p style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: theme.text }}>
            Choose Voice Provider
          </p>

          {/* OpenVoice option */}
          <button
            id="voice-provider-openvoice-btn"
            onClick={() => setSelectedProvider(PROVIDER.OPENVOICE)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              width: "100%",
              background: selectedProvider === PROVIDER.OPENVOICE ? theme.lightBlue : theme.bg,
              border: `2px solid ${selectedProvider === PROVIDER.OPENVOICE ? theme.primary : theme.border}`,
              borderRadius: 14,
              padding: "14px 16px",
              marginBottom: 10,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <Cpu size={28} color={theme.primary} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: theme.text }}>
                Use My Voice — Free &amp; Local
              </p>
              <p style={{ margin: 0, fontSize: 14, color: theme.textSoft, lineHeight: 1.5 }}>
                Record 20–30 seconds of clear speech. Your voice is processed locally on this
                device using OpenVoice V2. No cloud. No monthly fee. No data leaves your home.
              </p>
            </div>
          </button>

          {/* ElevenLabs option */}
          <button
            id="voice-provider-elevenlabs-btn"
            onClick={() => setSelectedProvider(PROVIDER.ELEVENLABS)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              width: "100%",
              background: selectedProvider === PROVIDER.ELEVENLABS ? theme.lightBlue : theme.bg,
              border: `2px solid ${selectedProvider === PROVIDER.ELEVENLABS ? theme.primary : theme.border}`,
              borderRadius: 14,
              padding: "14px 16px",
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.15s",
            }}
          >
            <Cloud size={28} color={theme.primary} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: theme.text }}>
                ElevenLabs — Cloud Voice Cloning
              </p>
              <p style={{ margin: 0, fontSize: 14, color: theme.textSoft, lineHeight: 1.5 }}>
                Uses ElevenLabs' cloud API to clone your voice. Requires an ElevenLabs account
                and API key configured on the server.
              </p>
            </div>
          </button>
        </div>
      )}

      {/* ── Enrollment Card ── */}
      <div style={card}>
        <p style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700, color: theme.text }}>
          Record Your Voice
          {step === STEP.IDLE && (
            <span style={{
              marginLeft: 10,
              fontSize: 13,
              fontWeight: 600,
              background: theme.lightBlue,
              color: theme.primary,
              borderRadius: 8,
              padding: "2px 9px",
              verticalAlign: "middle",
            }}>
              {providerLabel(selectedProvider)}
            </span>
          )}
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 15, color: theme.textSoft, lineHeight: 1.5 }}>
          {selectedProvider === PROVIDER.OPENVOICE
            ? "Record 20–30 seconds of natural speech. Speak clearly, as if talking to Bhavi. Your voice is processed locally — it never leaves your device."
            : "Record at least 30 seconds of natural speech. Speak clearly, as if talking to Bhavi. Your voice will be cloned via ElevenLabs."}
        </p>

        {/* IDLE — start recording */}
        {step === STEP.IDLE && (
          <button id="voice-record-start-btn" style={btn(theme.primary)} onClick={startRecording}>
            <Mic size={22} /> Start Recording
          </button>
        )}

        {/* RECORDING — live timer + stop */}
        {step === STEP.RECORDING && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <span
                style={{
                  width: 14, height: 14, borderRadius: "50%",
                  background: theme.danger,
                  animation: "pulseRing 1.2s ease-out infinite",
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 20, fontWeight: 700, color: theme.text, fontVariantNumeric: "tabular-nums" }}>
                Recording… {formatSecs(recordingSecs)}
              </span>
              {recordingSecs < MIN_RECORD_SECS && (
                <span style={{ fontSize: 14, color: theme.textSoft }}>
                  (aim for {MIN_RECORD_SECS}s minimum)
                </span>
              )}
            </div>
            <button id="voice-record-stop-btn" style={btn(theme.danger)} onClick={stopRecording}>
              <MicOff size={22} /> Stop Recording
            </button>
          </div>
        )}

        {/* REVIEW — consent + submit */}
        {step === STEP.REVIEW && (
          <div>
            <div style={{
              background: theme.successBg,
              border: `1px solid ${theme.success}`,
              borderRadius: 12,
              padding: "10px 14px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <CheckCircle size={20} color={theme.success} />
              <span style={{ fontSize: 15, color: theme.success, fontWeight: 600 }}>
                Recording complete ({formatSecs(recordingSecs)})
                {recordingSecs < MIN_RECORD_SECS && (
                  <span style={{ fontWeight: 400, color: theme.textSoft, marginLeft: 8 }}>
                    — try to record at least {MIN_RECORD_SECS} seconds for best results
                  </span>
                )}
              </span>
            </div>

            {/* Optional voice name */}
            <label htmlFor="voice-name-input" style={{ display: "block", fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
              Voice name (optional)
            </label>
            <input
              id="voice-name-input"
              type="text"
              placeholder="e.g. Grandpa's Voice"
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              maxLength={60}
              style={{
                width: "100%",
                padding: "10px 14px",
                fontSize: 16,
                borderRadius: 12,
                border: `1.5px solid ${theme.border}`,
                background: theme.bg,
                color: theme.text,
                marginBottom: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />

            {/* Consent checkbox */}
            <label
              htmlFor="voice-consent-checkbox"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              <input
                id="voice-consent-checkbox"
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                style={{ marginTop: 3, width: 20, height: 20, flexShrink: 0, cursor: "pointer" }}
              />
              <span style={{ fontSize: 14, color: theme.text, lineHeight: 1.55 }}>
                {CONSENT_TEXT}
              </span>
            </label>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                id="voice-enroll-submit-btn"
                style={{
                  ...btn(consentChecked ? theme.primary : theme.border, consentChecked ? theme.white : theme.textSoft),
                  opacity: consentChecked ? 1 : 0.6,
                }}
                onClick={handleEnroll}
                disabled={!consentChecked}
              >
                <CheckCircle size={20} /> Confirm &amp; Enroll
              </button>
              <button id="voice-record-again-btn" style={btn(theme.lightBlue, theme.primary)} onClick={handleReset}>
                Record again
              </button>
            </div>
          </div>
        )}

        {/* UPLOADING */}
        {step === STEP.UPLOADING && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0" }}>
            <Loader size={24} color={theme.primary} style={{ animation: "spinSoft 1s linear infinite" }} />
            <span style={{ fontSize: 17, color: theme.primary, fontWeight: 600 }}>
              {selectedProvider === PROVIDER.OPENVOICE
                ? "Saving voice reference… this may take a moment"
                : "Cloning voice… this may take up to 30 seconds"}
            </span>
          </div>
        )}

        {/* SUCCESS */}
        {step === STEP.SUCCESS && (
          <div>
            <div style={{
              background: theme.successBg,
              border: `1px solid ${theme.success}`,
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <CheckCircle size={24} color={theme.success} />
              <span style={{ fontSize: 16, fontWeight: 600, color: theme.success }}>
                {successMsg}
              </span>
            </div>
            <button id="voice-enroll-again-btn" style={btn(theme.lightBlue, theme.primary)} onClick={handleReset}>
              Enroll a different voice
            </button>
          </div>
        )}

        {/* ERROR */}
        {step === STEP.ERROR && (
          <div>
            <div style={{
              background: theme.dangerBg,
              border: `1px solid ${theme.danger}`,
              borderRadius: 14,
              padding: "14px 18px",
              marginBottom: 14,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}>
              <XCircle size={22} color={theme.danger} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 15, color: theme.danger }}>{errorMsg}</span>
            </div>
            <button id="voice-error-retry-btn" style={btn(theme.primary)} onClick={handleReset}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
