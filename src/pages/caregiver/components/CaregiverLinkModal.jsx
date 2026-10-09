import React, { useState } from "react";
import {
  Link2,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Info,
} from "lucide-react";
import { caregiverApi } from "../api/caregiverApi";

export default function CaregiverLinkModal({ isOpen, onClose, onLinked }) {
  const [elderId, setElderId] = useState("");
  const [role, setRole] = useState("PRIMARY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successLink, setSuccessLink] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessLink(null);

    const cleanId = elderId.trim().toUpperCase();
    if (!cleanId) {
      setError("Please enter the Elder ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await caregiverApi.requestLink({
        elder_id: cleanId,
        role,
      });

      setSuccessLink(res.link);
      if (onLinked) onLinked(res.link);
    } catch (err) {
      setError(err.message || "Failed to submit link request. Please verify the Elder ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(6px)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "16px",
    }}>
      <div style={{
        background: "#1E293B",
        borderRadius: 24,
        width: "100%",
        maxWidth: 480,
        border: "1px solid #334155",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          background: "#0F172A",
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "rgba(59, 130, 246, 0.15)",
              color: "#60A5FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Link2 size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>
                Connect an Elderly Loved One
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "#94A3B8" }}>
                Enter the non-guessable Elder ID shown in Bhavi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          {successLink ? (
            <div style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{
                width: 60,
                height: 60,
                borderRadius: "50%",
                background: "rgba(234, 179, 8, 0.15)",
                color: "#EAB308",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}>
                <Clock size={32} />
              </div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>
                Request Submitted (Pending Approval)
              </h4>
              <p style={{ margin: "0 0 16px 0", fontSize: 13, color: "#94A3B8", lineHeight: 1.5 }}>
                Your request to connect to <strong>{successLink.elder_name}</strong> as <strong>{successLink.role_display}</strong> has been submitted.
              </p>
              <div style={{
                background: "#0F172A",
                padding: "14px",
                borderRadius: 14,
                border: "1px solid #334155",
                fontSize: 13,
                color: "#CBD5E1",
                textAlign: "left",
                marginBottom: 20,
              }}>
                <div style={{ fontWeight: 700, color: "#60A5FA", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldCheck size={16} /> Privacy & Security Protection:
                </div>
                For security and privacy, possession of an Elder ID alone does not grant access. The elderly loved one must tap <strong>Approve</strong> in their Bhavi application before dashboard data is visible.
              </div>

              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "#2563EB",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {error && (
                <div style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#FCA5A5",
                  borderRadius: 12,
                  padding: "12px",
                  fontSize: 13,
                  marginBottom: 18,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <AlertCircle size={18} style={{ flexShrink: 0 }} />
                  <div>{error}</div>
                </div>
              )}

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                  Elder ID *
                </label>
                <input
                  type="text"
                  value={elderId}
                  onChange={(e) => setElderId(e.target.value)}
                  placeholder="e.g. ELD-68Q5TZJR"
                  required
                  style={{
                    width: "100%",
                    padding: "14px",
                    background: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    color: "#FFFFFF",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#94A3B8" }}>
                  Look for the Elder ID code in Bhavi's "More → Family & Caregivers" screen.
                </p>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#CBD5E1", marginBottom: 6 }}>
                  Caregiver Role
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setRole("PRIMARY")}
                    style={{
                      padding: "12px",
                      borderRadius: 12,
                      border: role === "PRIMARY" ? "2px solid #3B82F6" : "1px solid #334155",
                      background: role === "PRIMARY" ? "rgba(59, 130, 246, 0.15)" : "#0F172A",
                      color: role === "PRIMARY" ? "#60A5FA" : "#94A3B8",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Primary Caregiver
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 4 }}>
                      Daily reports & alerts
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("SECONDARY")}
                    style={{
                      padding: "12px",
                      borderRadius: 12,
                      border: role === "SECONDARY" ? "2px solid #3B82F6" : "1px solid #334155",
                      background: role === "SECONDARY" ? "rgba(59, 130, 246, 0.15)" : "#0F172A",
                      color: role === "SECONDARY" ? "#60A5FA" : "#94A3B8",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Secondary Caregiver
                    <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.8, marginTop: 4 }}>
                      Urgent safety alerts
                    </div>
                  </button>
                </div>
              </div>

              <div style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px",
                background: "rgba(15, 23, 42, 0.6)",
                borderRadius: 12,
                border: "1px solid #334155",
                fontSize: 12,
                color: "#94A3B8",
                marginBottom: 22,
              }}>
                <Info size={16} color="#60A5FA" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  Primary caregivers receive Daily Wellbeing Reports. Both primary and secondary caregivers receive instant high-priority safety alerts.
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    flex: 1,
                    padding: "12px",
                    background: "#0F172A",
                    border: "1px solid #334155",
                    borderRadius: 12,
                    color: "#94A3B8",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: "12px",
                    background: loading ? "#64748B" : "#2563EB",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? "Submitting..." : "Submit Link Request"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
