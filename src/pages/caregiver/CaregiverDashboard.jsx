import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Settings,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Heart,
  Calendar,
  AlertTriangle,
  Info,
  LogOut,
  ChevronRight,
  User,
  Shield,
  RefreshCw,
} from "lucide-react";
import { caregiverApi } from "./api/caregiverApi";

// Static local assets in the caretaker folder
import ammaAvatar from "./assets/amma_avatar.jpg";
import sarahAvatar from "./assets/sarah_avatar.jpg";
import raviAvatar from "./assets/ravi_avatar.jpg";

export default function CaregiverDashboard({ onLogout }) {

  // Navigation: 'dashboard' | 'elders' | 'alerts' | 'settings' | 'link_elder'
  const [activeTab, setActiveTab] = useState("dashboard");

  // Subtab for Elder Profile: 'overview' | 'caregivers' | 'settings'
  const [elderSubTab, setElderSubTab] = useState("overview");

  // Filter for alerts: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
  const [alertFilter, setAlertFilter] = useState("ALL");

  // Settings toggles
  const [dailyReportToggle, setDailyReportToggle] = useState(true);
  const [safetyAlertsToggle, setSafetyAlertsToggle] = useState(true);
  const [emailToggle, setEmailToggle] = useState(true);
  const [smsToggle, setSmsToggle] = useState(true);
  const [darkModeToggle, setDarkModeToggle] = useState(false);

  // Connect elder form state
  const [linkElderIdInput, setLinkElderIdInput] = useState("SM-4827");
  const [linkElderSuccess, setLinkElderSuccess] = useState(false);

  // State for live data & notifications
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  // Resolved alert IDs in local state
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState(new Set());

  // Link status: null (loading) | 'approved' | 'pending' | 'revoked' | 'no_link' | 'error'
  const [linkStatus, setLinkStatus] = useState(null);
  const [linkInfo, setLinkInfo] = useState(null); // { senior_id, senior_name }

  // Show a momentary feedback toast
  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Fetch authorized senior data using caretaker credentials from session
  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      // Get caretaker credentials from session (set during PortalLogin)
      const user = caregiverApi.getCurrentUser();
      const seniorId = user?.elder_id;
      const phoneNumber = user?.phone_number;

      if (!seniorId || !phoneNumber) {
        setLinkStatus("no_link");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await caregiverApi.getLinkedSeniorOverview({
        senior_id: seniorId,
        phone_number: phoneNumber,
      });
      setData(res);
      setLinkStatus("approved");
      setLinkInfo({ senior_id: seniorId, senior_name: res.senior_name || user.full_name });
    } catch (err) {
      const status = err?.status;
      const data = err?.data || {};
      if (status === 403 && data.approval_pending) {
        setLinkStatus("pending");
        setLinkInfo({ senior_id: data.senior_id, senior_name: data.senior_name });
      } else if (status === 403 && data.is_revoked) {
        setLinkStatus("revoked");
      } else if (status === 403) {
        setLinkStatus("no_link");
      } else {
        setLinkStatus("error");
        console.error("[CaregiverDashboard] API fetch error:", err);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle acknowledge alert
  const handleAcknowledge = async (alertId) => {
    setAcknowledgedAlertIds((prev) => new Set([...prev, alertId]));
    try {
      await caregiverApi.resolveAlert(alertId);
      showToast("Alert resolved and recorded in backend.");
      loadData(true);
    } catch (err) {
      console.error(err);
      showToast("Alert updated locally.");
    }
  };

  // Default fallback demo alerts
  const defaultAlerts = [
    {
      id: "alt-1",
      title: "Fall Risk Detected",
      severity: "High",
      time: "Today, 10:24 AM",
      description: "Unusual movement detected. Possible fall.",
      status: "Unverified",
      sentTo: "Caretaker 1 & Caretaker 2",
      isLive: false,
    },
    {
      id: "alt-2",
      title: "No Response",
      severity: "Medium",
      time: "Yesterday, 6:12 PM",
      description: "No response to voice call for 10+ minutes.",
      status: "Suspected",
      sentTo: "Caretaker 1 & Caretaker 2",
      isLive: false,
    },
    {
      id: "alt-3",
      title: "Unusual Activity",
      severity: "Low",
      time: "Apr 20, 2025, 11:03 AM",
      description: "Repeatedly asking about the same person.",
      status: "Detected",
      sentTo: "Caretaker 1 & Caretaker 2",
      isLive: false,
    },
  ];

  // Map real live safety events from Django if present
  const liveAlerts = (data?.safety_events || []).map((ev) => ({
    id: String(ev.id),
    title: `${ev.category_display || ev.category} Risk`,
    severity:
      ev.risk_level === "CRITICAL" || ev.risk_level === "HIGH"
        ? "High"
        : ev.risk_level === "MEDIUM"
        ? "Medium"
        : "Low",
    time: ev.created_at
      ? new Date(ev.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "Recent",
    description: ev.reason || ev.relevant_text || "Safety event detected during audio turn.",
    status: ev.status === "NEW" ? "Unverified" : ev.status === "REVIEWED" ? "Suspected" : "Resolved",
    sentTo: "Caretaker 1 & Caretaker 2",
    isLive: true,
  }));

  const activeAlertsList = liveAlerts.length > 0 ? liveAlerts : defaultAlerts;

  const currentAlerts = activeAlertsList.filter((a) => {
    if (alertFilter === "ALL") return true;
    return a.severity.toUpperCase() === alertFilter.toUpperCase();
  });

  const unacknowledgedCount = activeAlertsList.filter(
    (a) => !acknowledgedAlertIds.has(a.id) && a.status !== "Resolved"
  ).length;

  // ── Link Status Guard Screens ──────────────────────────────────────────
  const centeredPageStyle = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#F8FAFC",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
  };

  if (loading || linkStatus === null) {
    return (
      <div style={centeredPageStyle}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "4px solid #E2E8F0", borderTop: "4px solid #4F46E5",
            margin: "0 auto 16px",
            animation: "spin 1s linear infinite",
          }} />
          <p style={{ color: "#64748B", fontSize: 14 }}>Verifying caretaker access…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (linkStatus === "pending") {
    const user = caregiverApi.getCurrentUser();
    return (
      <div style={centeredPageStyle}>
        <div style={{
          maxWidth: 440, width: "100%", margin: "0 20px",
          background: "#FFFFFF", borderRadius: 24,
          border: "1.5px solid #FDE68A",
          padding: "44px 40px", textAlign: "center",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.08)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#FFFBEB", border: "2px solid #FDE68A",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Clock size={30} color="#D97706" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: "0 0 10px" }}>
            Approval Pending
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 20px" }}>
            Your connection request to senior{" "}
            <strong style={{ color: "#1E293B" }}>
              {linkInfo?.senior_name || "your senior"}
            </strong>{" "}
            ({linkInfo?.senior_id}) has been submitted.
          </p>
          <div style={{
            background: "#F0FDF4", border: "1px solid #BBF7D0",
            borderRadius: 14, padding: "16px 18px", textAlign: "left",
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#14532D", margin: "0 0 6px" }}>
              📱 Next step for the senior:
            </p>
            <ol style={{ fontSize: 13, color: "#166534", margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Open SeniorMind on their device</li>
              <li>Go to <strong>More → Settings</strong></li>
              <li>Under <strong>"Pending Requests"</strong>, tap <strong>Approve</strong></li>
            </ol>
          </div>
          <p style={{ fontSize: 12, color: "#94A3B8", margin: "0 0 20px" }}>
            You are logged in as: {user?.full_name || user?.username}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => loadData(true)}
              style={{
                flex: 1, padding: "11px", borderRadius: 10,
                background: "#4F46E5", color: "#FFFFFF",
                border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {refreshing ? "Checking…" : "Check Again"}
            </button>
            <button
              onClick={onLogout}
              style={{
                flex: 1, padding: "11px", borderRadius: 10,
                border: "1px solid #CBD5E1", background: "#F8FAFC",
                color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Log Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (linkStatus === "revoked" || linkStatus === "no_link") {
    const user = caregiverApi.getCurrentUser();
    return (
      <div style={centeredPageStyle}>
        <div style={{
          maxWidth: 440, width: "100%", margin: "0 20px",
          background: "#FFFFFF", borderRadius: 24,
          border: "1.5px solid #FCA5A5",
          padding: "44px 40px", textAlign: "center",
          boxShadow: "0 20px 40px -15px rgba(0,0,0,0.08)",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#FEF2F2", border: "2px solid #FCA5A5",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Shield size={30} color="#DC2626" />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1E293B", margin: "0 0 10px" }}>
            {linkStatus === "revoked" ? "Access Revoked" : "Not Connected"}
          </h2>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, margin: "0 0 24px" }}>
            {linkStatus === "revoked"
              ? "The senior has revoked your access. Please contact them to restore the connection."
              : "No active link found. Please check the Senior ID you entered or ask the senior to share their current code."}
          </p>
          <button
            onClick={onLogout}
            style={{
              width: "100%", padding: "12px", borderRadius: 10,
              background: "#4F46E5", color: "#FFFFFF",
              border: "none", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (

    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "#F8FAFC",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
        color: "#0F172A",
      }}
    >
      {/* ─── TOAST NOTIFICATION ────────────────────────────────────────── */}
      {toastMsg && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 24,
            zIndex: 9999,
            background: "#1E293B",
            color: "#FFFFFF",
            padding: "12px 20px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: 10,
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
            border: "1px solid #334155",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <CheckCircle2 size={18} color="#34D399" />
          {toastMsg}
        </div>
      )}

      {/* ─── LEFT SIDEBAR ──────────────────────────────────────────────── */}
      <aside
        style={{
          width: 250,
          background: "#FFFFFF",
          borderRight: "1px solid #E2E8F0",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Brand / Logo */}
        <div style={{ padding: "28px 24px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "#4F46E5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                boxShadow: "0 4px 10px rgba(79, 70, 229, 0.25)",
              }}
            >
              <Heart size={20} fill="#FFFFFF" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "#0F172A",
                  letterSpacing: "-0.02em",
                }}
              >
                SeniorMind
              </div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: -2 }}>
                Better Care, Brighter Days.
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav
          style={{
            padding: "8px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            flex: 1,
          }}
        >
          {/* Dashboard */}
          <button
            onClick={() => {
              setActiveTab("dashboard");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              background: activeTab === "dashboard" ? "#EEF2FF" : "transparent",
              color: activeTab === "dashboard" ? "#4F46E5" : "#64748B",
              transition: "all 0.15s ease",
            }}
          >
            <LayoutDashboard
              size={18}
              color={activeTab === "dashboard" ? "#4F46E5" : "#94A3B8"}
            />
            Dashboard
          </button>

          {/* Elders */}
          <button
            onClick={() => {
              setActiveTab("elders");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              background:
                activeTab === "elders" || activeTab === "link_elder"
                  ? "#EEF2FF"
                  : "transparent",
              color:
                activeTab === "elders" || activeTab === "link_elder"
                  ? "#4F46E5"
                  : "#64748B",
              transition: "all 0.15s ease",
            }}
          >
            <Users
              size={18}
              color={
                activeTab === "elders" || activeTab === "link_elder"
                  ? "#4F46E5"
                  : "#94A3B8"
              }
            />
            Elders
          </button>

          {/* Alerts */}
          <button
            onClick={() => {
              setActiveTab("alerts");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              background: activeTab === "alerts" ? "#EEF2FF" : "transparent",
              color: activeTab === "alerts" ? "#4F46E5" : "#64748B",
              transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Bell
                size={18}
                color={activeTab === "alerts" ? "#4F46E5" : "#94A3B8"}
              />
              Alerts
            </div>
            {unacknowledgedCount > 0 && (
              <span
                style={{
                  background: "#EF4444",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 700,
                  width: 19,
                  height: 19,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {unacknowledgedCount}
              </span>
            )}
          </button>

          {/* Settings */}
          <button
            onClick={() => {
              setActiveTab("settings");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              background: activeTab === "settings" ? "#EEF2FF" : "transparent",
              color: activeTab === "settings" ? "#4F46E5" : "#64748B",
              transition: "all 0.15s ease",
            }}
          >
            <Settings
              size={18}
              color={activeTab === "settings" ? "#4F46E5" : "#94A3B8"}
            />
            Settings
          </button>
        </nav>

        {/* User Profile Pill at Bottom of Sidebar */}
        <div
          style={{
            padding: "16px 18px",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <img
            src={sarahAvatar}
            alt="Sarah Johnson"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              objectFit: "cover",
              border: "2px solid #E0E7FF",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#0F172A",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Sarah Johnson
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#64748B",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Primary Caregiver
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Log out from Caregiver Dashboard"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: 4,
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ─── MAIN CONTENT CONTAINER ────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          background: "#F8FAFC",
        }}
      >
        {/* Top Header */}
        <header
          style={{
            padding: "24px 36px 16px",
            background: "#F8FAFC",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0F172A",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {activeTab === "dashboard" && "Caregiver Dashboard"}
              {activeTab === "elders" && "Elder Profile"}
              {activeTab === "alerts" && "Safety Alerts"}
              {activeTab === "settings" && "Settings"}
              {activeTab === "link_elder" && "Link an Elder"}
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#64748B",
                margin: "4px 0 0",
              }}
            >
              {activeTab === "dashboard" &&
                "Live health, safety alerts, and activity monitor for your elder."}
              {activeTab === "elders" &&
                "Manage profile information and connected caregivers."}
              {activeTab === "alerts" && "Important events and safety notifications"}
              {activeTab === "settings" && "Manage your account and preferences"}
              {activeTab === "link_elder" && "Enter the Elder ID to request access"}
            </p>
          </div>

          {/* Right Header: Exit button, Date & Notification Bell */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={onLogout}
              title="Log out from Caregiver Dashboard"
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#DC2626",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <LogOut size={14} /> Log Out
            </button>

            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#64748B",
              }}
            >
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <button
              onClick={() => setActiveTab("alerts")}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#64748B",
                position: "relative",
              }}
            >
              <Bell size={18} />
              {unacknowledgedCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#EF4444",
                  }}
                />
              )}
            </button>
            <button
              onClick={() => loadData(true)}
              title="Refresh Live Data"
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#64748B",
              }}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />
            </button>
          </div>
        </header>

        {/* Content Body Area */}
        <div
          style={{
            padding: "8px 36px 36px",
            flex: 1,
            overflowY: "auto",
            maxWidth: 1040,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 1: CAREGIVER DASHBOARD                                      */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "dashboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Live Backend Connection Status Banner */}
              <div
                style={{
                  background: data ? "#F0FDF4" : "#FEF3C7",
                  border: `1px solid ${data ? "#BBF7D0" : "#FDE68A"}`,
                  borderRadius: 14,
                  padding: "12px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: data ? "#22C55E" : "#F59E0B",
                      display: "inline-block",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: data ? "#166534" : "#92400E",
                      }}
                    >
                      {data
                        ? `🟢 Live SeniorMind Backend Connected — Monitoring: ${data.user_identifier || "default_user"}`
                        : "⚠️ Connecting to SeniorMind Django Backend (http://127.0.0.1:8000)..."}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: data ? "#15803D" : "#B45309",
                        marginTop: 2,
                      }}
                    >
                      Senior Status: <strong>{data?.status_label || "Stable"}</strong>
                      {" · "}
                      Active Alerts: <strong>{unacknowledgedCount}</strong>
                      {" · "}
                      Persistent Memories: <strong>{data?.summary?.total_memories ?? (data?.recent_memories?.length || 0)}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() => loadData(true)}
                    disabled={refreshing}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Syncing..." : "Sync Live Data"}
                  </button>
                </div>
              </div>

              {/* 3 Metric Stat Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 16,
                }}
              >
                {/* 1 Elder Connected */}
                <div
                  onClick={() => setActiveTab("elders")}
                  style={{
                    background: "#EEF2FF",
                    border: "1px solid #E0E7FF",
                    borderRadius: 16,
                    padding: "20px 22px",
                    cursor: "pointer",
                    transition: "transform 0.15s ease",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#E0E7FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#4F46E5",
                      marginBottom: 10,
                    }}
                  >
                    <User size={18} />
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#1E1B4B",
                      lineHeight: 1.1,
                    }}
                  >
                    1
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#4338CA",
                      marginTop: 4,
                    }}
                  >
                    Elder Connected
                  </div>
                </div>

                {/* 2 Caregivers Linked */}
                <div
                  onClick={() => {
                    setActiveTab("elders");
                    setElderSubTab("caregivers");
                  }}
                  style={{
                    background: "#ECFDF5",
                    border: "1px solid #D1FAE5",
                    borderRadius: 16,
                    padding: "20px 22px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#D1FAE5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#059669",
                      marginBottom: 10,
                    }}
                  >
                    <Users size={18} />
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#064E3B",
                      lineHeight: 1.1,
                    }}
                  >
                    2
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#047857",
                      marginTop: 4,
                    }}
                  >
                    Caregivers Linked
                  </div>
                </div>

                {/* 2 Active Alerts */}
                <div
                  onClick={() => setActiveTab("alerts")}
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FEE2E2",
                    borderRadius: 16,
                    padding: "20px 22px",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#FEE2E2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#DC2626",
                      marginBottom: 10,
                    }}
                  >
                    <Bell size={18} />
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#7F1D1D",
                      lineHeight: 1.1,
                    }}
                  >
                    {unacknowledgedCount}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#B91C1C",
                      marginTop: 4,
                    }}
                  >
                    Active Alerts
                  </div>
                </div>
              </div>

              {/* Elder Card (Amma) */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "20px 24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {/* Elder Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <img
                    src={ammaAvatar}
                    alt="Amma"
                    style={{
                      width: 58,
                      height: 58,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #E2E8F0",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 17,
                          fontWeight: 700,
                          color: "#0F172A",
                        }}
                      >
                        Amma
                      </span>
                      <span
                        style={{
                          background: "#DCFCE7",
                          color: "#166534",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                        }}
                      >
                        Active
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 2,
                      }}
                    >
                      Elder ID: SM-4827
                    </div>
                  </div>
                </div>

                {/* Linked Caregivers */}
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <img
                      src={sarahAvatar}
                      alt="Sarah"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748B",
                        }}
                      >
                        Primary Caregiver
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        You
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <img
                      src={raviAvatar}
                      alt="Ravi"
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#64748B",
                        }}
                      >
                        Secondary Caregiver
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Ravi
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Today's Overview Card */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "20px 24px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 16,
                  }}
                >
                  Today's Overview
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                  }}
                >
                  {/* Daily Report Tile */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 18px",
                      borderRadius: 12,
                      background: "#F8FAFC",
                      border: "1px solid #F1F5F9",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "#EEF2FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#4F46E5",
                      }}
                    >
                      <FileText size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Daily Report
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#10B981",
                          fontWeight: 500,
                        }}
                      >
                        Available
                      </div>
                    </div>
                  </div>

                  {/* Last Interaction Tile */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 18px",
                      borderRadius: 12,
                      background: "#F8FAFC",
                      border: "1px solid #F1F5F9",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "#FAF5FF",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#9333EA",
                      }}
                    >
                      <Clock size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Last Interaction
                      </div>
                      <div style={{ fontSize: 12, color: "#64748B" }}>
                        2 hours ago
                      </div>
                    </div>
                  </div>

                  {/* Wellbeing Tile */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "14px 18px",
                      borderRadius: 12,
                      background: "#F8FAFC",
                      border: "1px solid #F1F5F9",
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: "#ECFDF5",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#10B981",
                      }}
                    >
                      <Heart size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Wellbeing
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#10B981",
                          fontWeight: 500,
                        }}
                      >
                        Stable
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ⚠️ Alert Banner */}
              {unacknowledgedCount > 0 && (
                <div
                  onClick={() => setActiveTab("alerts")}
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: 12,
                    padding: "14px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    color: "#B91C1C",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <AlertTriangle size={18} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>
                      {unacknowledgedCount} new alert
                      {unacknowledgedCount > 1 ? "s" : ""} require your attention
                    </span>
                  </div>
                  <ArrowRight size={16} />
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 2: ELDER PROFILE                                            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "elders" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Back Button */}
              <div>
                <button
                  onClick={() => setActiveTab("dashboard")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#4F46E5",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: 0,
                  }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              </div>

              {/* Elder Profile Card */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "24px 28px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {/* Header Avatar & Info */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    paddingBottom: 24,
                    borderBottom: "1px solid #F1F5F9",
                  }}
                >
                  <img
                    src={ammaAvatar}
                    alt="Amma"
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "3px solid #E2E8F0",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <h2
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "#0F172A",
                          margin: 0,
                        }}
                      >
                        Amma
                      </h2>
                      <span
                        style={{
                          background: "#DCFCE7",
                          color: "#166534",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                        }}
                      >
                        Active
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "#64748B",
                        marginTop: 4,
                      }}
                    >
                      Elder ID: SM-4827
                    </div>
                  </div>
                </div>

                {/* Subtabs: Overview | Caregivers | Settings */}
                <div
                  style={{
                    display: "flex",
                    gap: 24,
                    borderBottom: "1px solid #F1F5F9",
                    paddingTop: 12,
                    paddingBottom: 0,
                  }}
                >
                  {["overview", "caregivers", "settings"].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setElderSubTab(tab)}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "10px 4px 14px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: elderSubTab === tab ? "#4F46E5" : "#64748B",
                        cursor: "pointer",
                        textTransform: "capitalize",
                        position: "relative",
                      }}
                    >
                      {tab}
                      {elderSubTab === tab && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 2,
                            background: "#4F46E5",
                            borderRadius: 2,
                          }}
                        />
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab Content: Overview */}
                {elderSubTab === "overview" && (
                  <div style={{ paddingTop: 20 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 24,
                      }}
                    >
                      {/* Left: Bio Info */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <User size={18} color="#64748B" />
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Age
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0F172A",
                              }}
                            >
                              72 years
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Shield size={18} color="#64748B" />
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Location
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0F172A",
                              }}
                            >
                              Chennai, Tamil Nadu
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Calendar size={18} color="#64748B" />
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Joined
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0F172A",
                              }}
                            >
                              Jan 15, 2025
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Linked Caregivers Box */}
                      <div
                        style={{
                          background: "#F8FAFC",
                          border: "1px solid #F1F5F9",
                          borderRadius: 12,
                          padding: "16px 20px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#0F172A",
                            marginBottom: 12,
                          }}
                        >
                          Linked Caregivers
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <img
                                src={sarahAvatar}
                                alt="Sarah"
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#0F172A",
                                  }}
                                >
                                  Sarah Johnson
                                </div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>
                                  Primary (+91 98401 12233)
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={16} color="#94A3B8" />
                          </div>

                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <img
                                src={raviAvatar}
                                alt="Ravi"
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: "50%",
                                  objectFit: "cover",
                                }}
                              />
                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#0F172A",
                                  }}
                                >
                                  Ravi Kumar
                                </div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>
                                  Secondary (+91 98409 98877)
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={16} color="#94A3B8" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div style={{ marginTop: 28 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#0F172A",
                          marginBottom: 12,
                        }}
                      >
                        Quick Stats
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: 14,
                        }}
                      >
                        <div
                          style={{
                            background: "#F8FAFC",
                            border: "1px solid #F1F5F9",
                            borderRadius: 10,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <FileText size={18} color="#4F46E5" />
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Daily Reports
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#0F172A",
                              }}
                            >
                              12{" "}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 400,
                                  color: "#64748B",
                                }}
                              >
                                (this month)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            background: "#F8FAFC",
                            border: "1px solid #F1F5F9",
                            borderRadius: 10,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Bell size={18} color="#EF4444" />
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Safety Alerts
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#0F172A",
                              }}
                            >
                              2{" "}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 400,
                                  color: "#64748B",
                                }}
                              >
                                (unresolved)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            background: "#F8FAFC",
                            border: "1px solid #F1F5F9",
                            borderRadius: 10,
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <Clock size={18} color="#9333EA" />
                          <div>
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              Last Active
                            </div>
                            <div
                              style={{
                                fontSize: 13,
                                fontWeight: 700,
                                color: "#0F172A",
                              }}
                            >
                              2 hours ago
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab Content: Caregivers / Settings */}
                {elderSubTab !== "overview" && (
                  <div
                    style={{
                      paddingTop: 24,
                      textAlign: "center",
                      color: "#64748B",
                      fontSize: 13,
                    }}
                  >
                    Both Caretaker 1 (Anita / Sarah) and Caretaker 2 (Ravi /
                    Suresh) are linked to Amma (ID: SM-4827).
                  </div>
                )}
              </div>

              {/* Connect another elder card link */}
              <div
                onClick={() => setActiveTab("link_elder")}
                style={{
                  background: "#FFFFFF",
                  border: "1px dashed #CBD5E1",
                  borderRadius: 12,
                  padding: "14px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: "#4F46E5",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Connect with an Elder
              </div>
            </div>
          )}



          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 4: SAFETY ALERTS                                            */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "alerts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Header filter dropdown */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ fontSize: 13, color: "#64748B" }}>
                  Dispatched to both Caretaker 1 and Caretaker 2
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["ALL", "HIGH", "MEDIUM", "LOW"].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setAlertFilter(lvl)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        border: "1px solid",
                        borderColor:
                          alertFilter === lvl ? "#4F46E5" : "#E2E8F0",
                        background:
                          alertFilter === lvl ? "#EEF2FF" : "#FFFFFF",
                        color: alertFilter === lvl ? "#4F46E5" : "#64748B",
                        cursor: "pointer",
                      }}
                    >
                      {lvl === "ALL" ? "All" : lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alerts List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {currentAlerts.map((alt) => {
                  const isHandled = acknowledgedAlertIds.has(alt.id);
                  const isHigh = alt.severity === "High";
                  const isMedium = alt.severity === "Medium";

                  const badgeColor = isHigh
                    ? { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5" }
                    : isMedium
                    ? { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A" }
                    : { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" };

                  return (
                    <div
                      key={alt.id}
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        borderRadius: 16,
                        padding: "20px 24px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                        opacity: isHandled ? 0.65 : 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: badgeColor.bg,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: badgeColor.text,
                            }}
                          >
                            <AlertTriangle size={18} />
                          </div>

                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: "#0F172A",
                                }}
                              >
                                {alt.title}
                              </span>
                              <span
                                style={{
                                  background: badgeColor.bg,
                                  color: badgeColor.text,
                                  border: `1px solid ${badgeColor.border}`,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 8px",
                                  borderRadius: 20,
                                }}
                              >
                                {alt.severity}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#64748B",
                                marginTop: 2,
                              }}
                            >
                              {alt.time}
                            </div>
                          </div>
                        </div>

                        {/* Status tag */}
                        <div
                          style={{
                            fontSize: 12,
                            color: isHandled ? "#10B981" : "#64748B",
                            fontWeight: 500,
                          }}
                        >
                          • {isHandled ? "Handled" : alt.status}
                        </div>
                      </div>

                      {/* Description */}
                      <p
                        style={{
                          margin: "10px 0 16px",
                          fontSize: 13,
                          color: "#334155",
                          lineHeight: 1.5,
                        }}
                      >
                        {alt.description}
                      </p>

                      {/* Buttons */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingTop: 12,
                          borderTop: "1px solid #F1F5F9",
                        }}
                      >
                        <div style={{ fontSize: 11, color: "#64748B" }}>
                          Dispatched: {alt.sentTo}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            onClick={() =>
                              showToast(`Viewing details for ${alt.title}`)
                            }
                            style={{
                              padding: "8px 16px",
                              borderRadius: 8,
                              background: "#FFFFFF",
                              border: "1px solid #E2E8F0",
                              color: "#334155",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            View Details
                          </button>

                          {!isHandled ? (
                            <button
                              onClick={() => handleAcknowledge(alt.id)}
                              style={{
                                padding: "8px 18px",
                                borderRadius: 8,
                                background: "#4F46E5",
                                border: "none",
                                color: "#FFFFFF",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Acknowledge
                            </button>
                          ) : (
                            <button
                              disabled
                              style={{
                                padding: "8px 18px",
                                borderRadius: 8,
                                background: "#ECFDF5",
                                border: "1px solid #D1FAE5",
                                color: "#059669",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "default",
                              }}
                            >
                              ✓ Handled
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 5: SETTINGS                                                 */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "settings" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Account Information Card */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "22px 26px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0F172A",
                    }}
                  >
                    Account Information
                  </div>
                  <button
                    onClick={() => showToast("Account edit mode")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                      color: "#4F46E5",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Edit
                  </button>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Name</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginTop: 2,
                      }}
                    >
                      Sarah Johnson
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Email</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginTop: 2,
                      }}
                    >
                      sarah@example.com
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Phone</div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                        marginTop: 2,
                      }}
                    >
                      +91 98765 43210
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Preferences Card */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "22px 26px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 16,
                  }}
                >
                  Notification Preferences
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  {/* Daily Reports (Primary Only) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Daily Reports (Primary Only)
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        Delivered each morning to Caretaker 1
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={dailyReportToggle}
                      onChange={(e) => setDailyReportToggle(e.target.checked)}
                      style={{
                        width: 20,
                        height: 20,
                        accentColor: "#4F46E5",
                        cursor: "pointer",
                      }}
                    />
                  </div>

                  {/* Safety Alerts (Both Caregivers) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Safety Alerts (Both Caregivers)
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        Emergency SMS sent to Caretaker 1 & 2
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={safetyAlertsToggle}
                      onChange={(e) => setSafetyAlertsToggle(e.target.checked)}
                      style={{
                        width: 20,
                        height: 20,
                        accentColor: "#4F46E5",
                        cursor: "pointer",
                      }}
                    />
                  </div>

                  {/* Email Notifications */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        Email Notifications
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        Weekly executive wellbeing recap
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailToggle}
                      onChange={(e) => setEmailToggle(e.target.checked)}
                      style={{
                        width: 20,
                        height: 20,
                        accentColor: "#4F46E5",
                        cursor: "pointer",
                      }}
                    />
                  </div>

                  {/* SMS Notifications (Simulated) */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#0F172A",
                        }}
                      >
                        SMS Notifications (Simulated)
                      </div>
                      <div style={{ fontSize: 11, color: "#64748B" }}>
                        Instant SMS dispatch to caretaker phone numbers
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={smsToggle}
                      onChange={(e) => setSmsToggle(e.target.checked)}
                      style={{
                        width: 20,
                        height: 20,
                        accentColor: "#4F46E5",
                        cursor: "pointer",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* App Preferences */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "22px 26px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#0F172A",
                    marginBottom: 16,
                  }}
                >
                  App Preferences
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 16,
                    borderBottom: "1px solid #F1F5F9",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      Dark Mode
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      Adjust display color scheme
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={darkModeToggle}
                    onChange={(e) => setDarkModeToggle(e.target.checked)}
                    style={{
                      width: 20,
                      height: 20,
                      accentColor: "#4F46E5",
                      cursor: "pointer",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 16,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#0F172A",
                      }}
                    >
                      Language
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      Dashboard language preference
                    </div>
                  </div>
                  <select
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #CBD5E1",
                      fontSize: 13,
                      background: "#FFFFFF",
                      color: "#0F172A",
                    }}
                  >
                    <option>English</option>
                    <option>Tamil</option>
                    <option>Hindi</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* TAB 6: LINK AN ELDER (PANEL 8 IN MOCKUP)                        */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {activeTab === "link_elder" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                paddingTop: 20,
              }}
            >
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: 16,
                  padding: "36px 32px",
                  maxWidth: 520,
                  width: "100%",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 14,
                    background: "#EEF2FF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#4F46E5",
                    margin: "0 auto 16px",
                  }}
                >
                  <Users size={24} />
                </div>

                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0F172A",
                    margin: 0,
                  }}
                >
                  Connect with an Elder
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: "#64748B",
                    margin: "6px 0 24px",
                  }}
                >
                  Enter the Elder ID provided by the elderly person
                </p>

                <div style={{ textAlign: "left", marginBottom: 20 }}>
                  <label
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#334155",
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Elder ID
                  </label>
                  <input
                    type="text"
                    value={linkElderIdInput}
                    onChange={(e) => setLinkElderIdInput(e.target.value)}
                    placeholder="e.g. SM-4827"
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid #CBD5E1",
                      fontSize: 14,
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    setLinkElderSuccess(true);
                    showToast("Link request sent to elder!");
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 10,
                    background: "#4F46E5",
                    color: "#FFFFFF",
                    fontSize: 14,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
                  }}
                >
                  Send Request
                </button>

                {/* How it works info box */}
                <div
                  style={{
                    marginTop: 28,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    padding: "18px 20px",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#0F172A",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 10,
                    }}
                  >
                    <Info size={14} color="#4F46E5" /> How it works?
                  </div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      fontSize: 12,
                      color: "#64748B",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      lineHeight: 1.4,
                    }}
                  >
                    <li>Enter the Elder ID provided by the elderly person.</li>
                    <li>Send a link request to the elder's account.</li>
                    <li>Wait for approval from the elder.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
