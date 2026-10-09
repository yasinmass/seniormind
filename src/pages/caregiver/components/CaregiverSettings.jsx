import React, { useState } from "react";
import {
  User,
  Phone,
  Mail,
  Bell,
  CheckCircle2,
  AlertCircle,
  Save,
  LogOut,
  ShieldCheck,
  Smartphone,
  Send,
} from "lucide-react";
import { caregiverApi } from "../api/caregiverApi";

export default function CaregiverSettings({
  currentUser,
  linkedElders = [],
  onLogout,
  onOpenLinkModal,
}) {
  const [fullName, setFullName] = useState(currentUser?.full_name || "");
  const [phone, setPhone] = useState(currentUser?.phone_number || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [smsNotif, setSmsNotif] = useState(currentUser?.notification_preferences?.sms_simulated !== false);
  const [emailNotif, setEmailNotif] = useState(currentUser?.notification_preferences?.email_simulated !== false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);

    try {
      const res = await caregiverApi.updateMe({
        full_name: fullName.trim(),
        phone_number: phone.trim(),
        notification_preferences: {
          in_app: true,
          sms_simulated: smsNotif,
          email_simulated: emailNotif,
        },
      });
      if (res.caregiver) {
        caregiverApi.setCurrentUser(res.caregiver);
      }
      setSavedMsg("Settings saved successfully.");
      setTimeout(() => setSavedMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      {/* Header */}
      <div>
        <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
          Caregiver Account & Notification Settings
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
          Manage your contact information, emergency alert dispatch preferences, and linked loved ones
        </p>
      </div>

      {savedMsg && (
        <div style={{
          background: "rgba(34, 197, 94, 0.15)",
          border: "1px solid rgba(34, 197, 94, 0.3)",
          color: "#86EFAC",
          borderRadius: 14,
          padding: "12px 16px",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <CheckCircle2 size={18} />
          <div>{savedMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div style={{
          background: "rgba(239, 68, 68, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#FCA5A5",
          borderRadius: 14,
          padding: "12px 16px",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <AlertCircle size={18} />
          <div>{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Profile Card */}
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "24px",
          border: "1px solid #334155",
        }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 700, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 8 }}>
            <User size={18} color="#60A5FA" /> Caregiver Profile Information
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#0F172A",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  color: "#FFFFFF",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                Phone Number (for SMS Alerts)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91..."
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "#0F172A",
                  border: "1px solid #334155",
                  borderRadius: 12,
                  color: "#FFFFFF",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "24px",
          border: "1px solid #334155",
        }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 700, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={18} color="#60A5FA" /> Emergency Notification Channels
          </h3>
          <p style={{ margin: "0 0 16px 0", fontSize: 12, color: "#94A3B8" }}>
            Choose how you would like to be notified when high-priority safety concerns or daily reports are generated
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "#0F172A",
              borderRadius: 12,
              border: "1px solid #334155",
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Smartphone size={18} color="#EAB308" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF" }}>
                    SMS Text Alerts (Simulated)
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Urgent SMS notifications to {phone || "your phone"} for CRITICAL and HIGH safety risks
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={smsNotif}
                onChange={(e) => setSmsNotif(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#2563EB", cursor: "pointer" }}
              />
            </label>

            <label style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "#0F172A",
              borderRadius: 12,
              border: "1px solid #334155",
              cursor: "pointer",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Mail size={18} color="#A855F7" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF" }}>
                    Email Summaries (Simulated)
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Daily Wellbeing Reports and incident audit records
                  </div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={(e) => setEmailNotif(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#2563EB", cursor: "pointer" }}
              />
            </label>
          </div>
        </div>

        {/* Linked Elders Summary Card */}
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "24px",
          border: "1px solid #334155",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#FFFFFF", display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={18} color="#34D399" /> Connected Elderly Accounts ({linkedElders.length})
            </h3>
            <button
              type="button"
              onClick={onOpenLinkModal}
              style={{
                padding: "6px 14px",
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.4)",
                color: "#60A5FA",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Connect Another Elder
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {linkedElders.map((el) => (
              <div
                key={el.elder_id}
                style={{
                  padding: "12px 16px",
                  background: "#0F172A",
                  borderRadius: 12,
                  border: "1px solid #334155",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                    {el.display_name} ({el.elder_id})
                  </div>
                  <div style={{ fontSize: 12, color: "#94A3B8" }}>
                    Role: {el.role_display} • Status: {el.status_display}
                  </div>
                </div>
                <span style={{
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                  background: el.has_access ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                  color: el.has_access ? "#4ADE80" : "#FACC15",
                }}>
                  {el.status_display}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10 }}>
          <button
            type="button"
            onClick={onLogout}
            style={{
              padding: "12px 18px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#FCA5A5",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: "12px 24px",
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Save size={16} /> {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      </form>
    </div>
  );
}
