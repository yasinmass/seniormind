import React, { useState, useEffect, useCallback } from "react";
import {
  Sun, Moon, User, Languages, Volume2, Bell, Users, PhoneCall, HelpCircle,
  LogOut, Link2, Copy, CheckCircle2, Clock, Trash2, UserCheck, AlertCircle,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import ScreenShell from "../../components/senior/ScreenShell";
import TopBar from "../../components/senior/TopBar";
import SettingsRow from "../../components/senior/SettingsRow";
import SettingsToggleRow from "../../components/senior/SettingsToggleRow";
import VoiceEnrollment from "../../components/senior/VoiceEnrollment";
import { seniorProfile } from "../../data/seniorMockData";
import { caregiverApi } from "../caregiver/api/caregiverApi";

export default function More({ goHelp, name, onLogout, userIdentifier }) {
  const { theme, mode, toggleTheme } = useTheme();
  const [showVoiceEnrollment, setShowVoiceEnrollment] = useState(false);
  const displayName = name || seniorProfile.name;
  const uid = userIdentifier || "default_user";

  // Senior ID state
  const [seniorId, setSeniorId] = useState(null);
  const [seniorIdLoading, setSeniorIdLoading] = useState(true);
  const [seniorIdError, setSeniorIdError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Caregivers state
  const [linkedCaregivers, setLinkedCaregivers] = useState([]);
  const [pendingCaregivers, setPendingCaregivers] = useState([]);
  const [caregiversLoading, setCaregiversLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Load Senior ID from backend
  const loadSeniorId = useCallback(async () => {
    setSeniorIdLoading(true);
    setSeniorIdError(null);
    try {
      const res = await caregiverApi.getMySeniorId(uid, displayName);
      setSeniorId(res.senior_id);
    } catch (err) {
      setSeniorIdError("Could not load your Senior ID. Please try again.");
    } finally {
      setSeniorIdLoading(false);
    }
  }, [uid, displayName]);

  // Load caregivers
  const loadCaregivers = useCallback(async () => {
    setCaregiversLoading(true);
    try {
      const res = await caregiverApi.getSeniorCaregivers(uid);
      setLinkedCaregivers(res.linked_caregivers || []);
      setPendingCaregivers(res.pending_caregivers || []);
    } catch (_) {
      // non-critical, silently ignore
    } finally {
      setCaregiversLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    loadSeniorId();
    loadCaregivers();
  }, [loadSeniorId, loadCaregivers]);

  const handleCopy = async () => {
    if (!seniorId) return;
    try {
      await navigator.clipboard.writeText(seniorId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (_) {
      // fallback for browsers that block clipboard
      const el = document.createElement("textarea");
      el.value = seniorId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCaregiverAction = async (linkId, action) => {
    setActionLoadingId(linkId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await caregiverApi.manageCaregiverAction(linkId, action, uid);
      setActionSuccess(
        action === "APPROVE"
          ? "Caretaker approved! They can now view your dashboard."
          : action === "REJECT"
          ? "Request rejected."
          : "Caretaker access revoked."
      );
      await loadCaregivers();
    } catch (err) {
      setActionError(err.message || "Action failed. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const card = (children, extra = {}) => ({
    background: theme.lightBlue || "#EEF4FF",
    borderRadius: 18,
    padding: "16px 18px",
    marginBottom: 16,
    ...extra,
  });

  return (
    <ScreenShell bottomPad>
      <TopBar title="More" />
      <div style={{ padding: "6px 20px" }}>

        {/* Profile header */}
        <div style={card({ display: "flex", alignItems: "center", gap: 16 })}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            background: theme.primary, color: theme.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, fontWeight: 700, flexShrink: 0,
          }}>
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 22, fontWeight: 700, color: theme.text, margin: 0 }}>{displayName}</p>
            <p style={{ fontSize: 17, color: theme.primaryDark, margin: "4px 0 0" }}>View profile</p>
          </div>
        </div>

        {/* ── MY SENIOR ID ─────────────────────────────────────── */}
        <div style={{
          background: "#FFFFFF",
          border: "1.5px solid #C7D2FE",
          borderRadius: 18,
          padding: "18px 18px 14px",
          marginBottom: 16,
          boxShadow: "0 2px 10px rgba(79,70,229,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Link2 size={18} color="#4F46E5" />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#1E1B4B" }}>My Senior ID</span>
          </div>

          {seniorIdLoading ? (
            <p style={{ fontSize: 13, color: "#94A3B8", margin: 0 }}>Loading your ID…</p>
          ) : seniorIdError ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#B91C1C", fontSize: 12 }}>
              <AlertCircle size={14} />
              <span>{seniorIdError}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 20,
                  fontWeight: 800,
                  letterSpacing: "0.12em",
                  color: "#4F46E5",
                  background: "#EEF2FF",
                  borderRadius: 10,
                  padding: "6px 14px",
                  flexShrink: 0,
                }}>
                  {seniorId}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    background: copied ? "#D1FAE5" : "#F1F5F9",
                    color: copied ? "#065F46" : "#334155",
                    border: "none", borderRadius: 8,
                    padding: "7px 12px", fontSize: 12, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#64748B", margin: 0, lineHeight: 1.5 }}>
                Share this code with your caretaker. They enter it during login to link to your account.
              </p>
            </>
          )}
        </div>

        {/* ── PENDING CARETAKER REQUESTS ──────────────────────── */}
        {pendingCaregivers.length > 0 && (
          <div style={{
            background: "#FFFBEB",
            border: "1.5px solid #FDE68A",
            borderRadius: 18,
            padding: "14px 16px",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Clock size={16} color="#D97706" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>
                Pending Requests ({pendingCaregivers.length})
              </span>
            </div>
            {pendingCaregivers.map((cg) => (
              <div key={cg.id} style={{
                background: "#FFFFFF",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 8,
                border: "1px solid #FDE68A",
              }}>
                <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                  {cg.name || "Caretaker"}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: 12, color: "#64748B" }}>{cg.phone}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={actionLoadingId === cg.id}
                    onClick={() => handleCaregiverAction(cg.id, "APPROVE")}
                    style={{
                      flex: 1, padding: "7px", borderRadius: 8, border: "none",
                      background: "#4F46E5", color: "#FFFFFF",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {actionLoadingId === cg.id ? "…" : "Approve"}
                  </button>
                  <button
                    disabled={actionLoadingId === cg.id}
                    onClick={() => handleCaregiverAction(cg.id, "REJECT")}
                    style={{
                      flex: 1, padding: "7px", borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      background: "#F8FAFC", color: "#475569",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONNECTED CAREGIVERS ────────────────────────────── */}
        {linkedCaregivers.length > 0 && (
          <div style={{
            background: "#F0FDF4",
            border: "1.5px solid #BBF7D0",
            borderRadius: 18,
            padding: "14px 16px",
            marginBottom: 16,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <UserCheck size={16} color="#16A34A" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#14532D" }}>
                Connected Caregivers ({linkedCaregivers.length})
              </span>
            </div>
            {linkedCaregivers.map((cg) => (
              <div key={cg.id} style={{
                background: "#FFFFFF",
                borderRadius: 12,
                padding: "10px 14px",
                marginBottom: 8,
                border: "1px solid #BBF7D0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                    {cg.name || "Caretaker"}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#64748B" }}>{cg.phone}</p>
                </div>
                <button
                  disabled={actionLoadingId === cg.id}
                  onClick={() => handleCaregiverAction(cg.id, "REVOKE")}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid #FCA5A5",
                    background: "#FEF2F2", color: "#B91C1C",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Trash2 size={12} />
                  {actionLoadingId === cg.id ? "…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Action feedback */}
        {actionSuccess && (
          <div style={{
            background: "#D1FAE5", borderRadius: 10, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 8,
            color: "#065F46", fontSize: 13, marginBottom: 12,
          }}>
            <CheckCircle2 size={16} />
            {actionSuccess}
          </div>
        )}
        {actionError && (
          <div style={{
            background: "#FEF2F2", borderRadius: 10, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 8,
            color: "#B91C1C", fontSize: 13, marginBottom: 12,
          }}>
            <AlertCircle size={16} />
            {actionError}
          </div>
        )}

        {/* ── STANDARD SETTINGS ROWS ──────────────────────────── */}
        <SettingsRow icon={User}      label="My Profile" />
        <SettingsRow icon={Languages} label="Language"         value="English" />
        <SettingsRow
          icon={Volume2}
          label="Personalized Voice"
          value={showVoiceEnrollment ? "Hide Settings" : "Configure"}
          onClick={() => setShowVoiceEnrollment((prev) => !prev)}
        />
        {showVoiceEnrollment && (
          <div style={{ marginBottom: 20 }}>
            <VoiceEnrollment userIdentifier={uid} />
          </div>
        )}
        <SettingsRow icon={Bell}      label="Notifications"    value="On" />
        <SettingsToggleRow icon={mode === "dark" ? Moon : Sun} label="Dark Mode" checked={mode === "dark"} onChange={toggleTheme} />
        <SettingsRow icon={Users}     label="My Family" />
        <SettingsRow icon={PhoneCall} label="Emergency Contact" />
        <SettingsRow icon={HelpCircle} label="Help" onClick={goHelp} />
        <SettingsRow icon={LogOut}     label="Log Out" value="Sign Out" onClick={onLogout} />
      </div>
    </ScreenShell>
  );
}
