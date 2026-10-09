/**
 * src/pages/caregiver/api/caregiverApi.js
 *
 * Centralized API client for Caretaker Dashboard.
 * Connects to live Django backend at http://127.0.0.1:8000/api for:
 *   - Caregiver overview & safety status (/api/caregiver/<user_identifier>/overview/)
 *   - Live safety events and resolution (/api/safety-events/<event_id>/)
 *   - Elder memory insights
 *
 * NOTE ON AUTHENTICATION:
 * Real server-side authentication and caretaker-senior authorization models
 * are not yet implemented in the Django backend. The backend currently isolates
 * data by user_identifier (e.g. 'default_user'). Local demo accounts are strictly
 * simulated UI state and do not represent server-side authentication.
 */

const BASE_URL = "http://127.0.0.1:8000/api";

export const caregiverApi = {
  // ── Auth Token Helpers (Simulated Client-Side State) ──────────────────────
  getToken() {
    return localStorage.getItem("senior_caregiver_token") || "";
  },

  setToken(token) {
    if (token) {
      localStorage.setItem("senior_caregiver_token", token);
    } else {
      localStorage.removeItem("senior_caregiver_token");
    }
  },

  getCurrentUser() {
    try {
      const saved = localStorage.getItem("senior_caregiver_user");
      return saved ? JSON.parse(saved) : {
        username: "caregiver_anita",
        full_name: "Anita Raman",
        email: "anita@example.com",
        phone_number: "+91 98401 12233",
        role: "PRIMARY",
        notification_preferences: { in_app: true, sms_simulated: true, email_simulated: true },
      };
    } catch (_) {
      return null;
    }
  },

  setCurrentUser(user) {
    if (user) {
      localStorage.setItem("senior_caregiver_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("senior_caregiver_user");
    }
  },

  clearAuth() {
    localStorage.removeItem("senior_caregiver_token");
    localStorage.removeItem("senior_caregiver_user");
  },

  // ── Core Fetch Wrapper ──────────────────────────────────────────────────
  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.error || data.detail || `Request failed (HTTP ${res.status})`;
        const error = new Error(errorMsg);
        error.status = res.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[caregiverApi] Error ${options.method || "GET"} ${endpoint}:`, err);
      throw err;
    }
  },

  // ── Live Django Overview & Elder APIs ──────────────────────────────────
  /**
   * Fetches the real elder overview from Django:
   * GET /api/caregiver/<elderId>/overview/
   */
  async getSimpleOverview(elderId = "") {
    const uid = elderId && elderId !== "ELD-68Q5TZJR" ? elderId : "default_user";
    const data = await this.request(`/caregiver/${encodeURIComponent(uid)}/overview/`);
    return {
      ...data,
      is_live_backend: true,
    };
  },

  async getElderOverview(elderId) {
    const uid = elderId && elderId !== "ELD-68Q5TZJR" ? elderId : "default_user";
    const data = await this.request(`/caregiver/${encodeURIComponent(uid)}/overview/`);
    return {
      ...data,
      is_live_backend: true,
    };
  },

  // ── Live Safety Event Actions ──────────────────────────────────────────
  /**
   * Resolves a safety event using Django endpoint:
   * POST /api/safety-events/<alertId>/ with {"status": "RESOLVED"}
   */
  async resolveAlert(alertId) {
    // If the alert ID is a numeric backend ID
    const numericId = parseInt(alertId, 10);
    if (!isNaN(numericId)) {
      return this.request(`/safety-events/${numericId}/`, {
        method: "POST",
        body: JSON.stringify({ status: "RESOLVED" }),
      });
    }
    // Simulated demo fallback if alertId is a local string like 'alt-1'
    return { status: "ok", message: "Alert resolved in local state." };
  },

  async acknowledgeAlert(alertId, newStatus = "REVIEWED") {
    const numericId = parseInt(alertId, 10);
    if (!isNaN(numericId)) {
      return this.request(`/safety-events/${numericId}/`, {
        method: "POST",
        body: JSON.stringify({ status: newStatus }),
      });
    }
    return { status: "ok", message: "Alert acknowledged in local state." };
  },

  async confirmAlert(alertId, isConfirmed = true) {
    const numericId = parseInt(alertId, 10);
    if (!isNaN(numericId)) {
      return this.request(`/safety-events/${numericId}/`, {
        method: "POST",
        body: JSON.stringify({ status: isConfirmed ? "REVIEWED" : "RESOLVED" }),
      });
    }
    return { status: "ok", message: "Alert status updated in local state." };
  },

  async getElderAlerts(elderId, { severity = "ALL", status = "ALL" } = {}) {
    const uid = elderId && elderId !== "ELD-68Q5TZJR" ? elderId : "default_user";
    try {
      const overview = await this.request(`/caregiver/${encodeURIComponent(uid)}/overview/`);
      let list = overview.safety_events || [];
      if (severity && severity !== "ALL") {
        list = list.filter((a) => (a.risk_level || "").toUpperCase() === severity.toUpperCase());
      }
      if (status && status !== "ALL") {
        list = list.filter((a) => (a.status || "").toUpperCase() === status.toUpperCase());
      }
      return {
        status: "ok",
        alerts: list.map((ev) => ({
          id: ev.id,
          title: `${ev.category_display || ev.category} Alert`,
          severity: ev.risk_level === "CRITICAL" ? "High" : ev.risk_level === "HIGH" ? "High" : ev.risk_level === "MEDIUM" ? "Medium" : "Low",
          time: new Date(ev.created_at).toLocaleString(),
          description: ev.reason || ev.relevant_text || "Safety concern detected.",
          status: ev.status === "NEW" ? "Unverified" : ev.status === "REVIEWED" ? "Suspected" : "Resolved",
          sentTo: "Primary & Family Caregivers",
          raw_event: ev,
        })),
        is_live_backend: true,
      };
    } catch (_) {
      return { status: "ok", alerts: [], is_live_backend: false };
    }
  },

  // ── Reports & Notifications (Transparently Simulated) ─────────────────
  async getElderReports(elderId) {
    return {
      status: "ok",
      is_simulated: true,
      reports: [
        {
          id: "rep-today",
          date: new Date().toISOString().split("T")[0],
          title: "Daily Wellbeing Summary",
          overall_score: "Good (85/100)",
          summary: "Elder engaged in multiple warm conversations with Bhavi. Appetite and mood were positive.",
          routine_completed: "3 of 4 routines followed",
          medications_taken: "Pending physical verification (simulated)",
          simulated_notice: "Note: Daily automated report generation is a demo feature. Real summaries are derived from live conversation memories.",
        },
      ],
    };
  },

  async generateDailyReport(elderId, { date, force = true } = {}) {
    return {
      status: "ok",
      is_simulated: true,
      report: {
        id: `rep-${Date.now()}`,
        date: date || new Date().toISOString().split("T")[0],
        title: "Generated Wellbeing Snapshot",
        overall_score: "Stable (90/100)",
        summary: "Synthesized snapshot generated. Elder expressed feeling comfortable today.",
        routine_completed: "Active routines tracked",
        medications_taken: "Not verified by sensor (simulated)",
      },
    };
  },

  async getNotifications() {
    return {
      status: "ok",
      is_simulated: true,
      notifications: [
        {
          id: "notif-1",
          title: "Safety Monitor Active",
          message: "Bhavi risk detector is monitoring live audio turns.",
          created_at: new Date().toISOString(),
          read: false,
        },
      ],
    };
  },

  async markNotificationRead(notifId) {
    return { status: "ok" };
  },

  // ── Senior ID & Caretaker Linking (Real Backend Endpoints) ───────────

  /**
   * GET /api/senior/my-id/?user_identifier=<uid>&display_name=<name>
   * Generates or retrieves the persistent Senior ID for a senior.
   */
  async getMySeniorId(userIdentifier = "default_user", displayName = "") {
    const params = new URLSearchParams({ user_identifier: userIdentifier });
    if (displayName) params.set("display_name", displayName);
    return this.request(`/senior/my-id/?${params.toString()}`);
  },

  /**
   * GET /api/senior/caregivers/?user_identifier=<uid>
   * Returns linked (APPROVED) and pending caretakers for a senior.
   */
  async getSeniorCaregivers(userIdentifier = "default_user") {
    return this.request(`/senior/caregivers/?user_identifier=${encodeURIComponent(userIdentifier)}`);
  },

  /**
   * POST /api/senior/caregivers/<link_id>/action/
   * Senior approves, rejects, or revokes a caretaker link.
   * action: "APPROVE" | "REJECT" | "REVOKE"
   */
  async manageCaregiverAction(linkId, action, userIdentifier = "default_user") {
    return this.request(`/senior/caregivers/${linkId}/action/`, {
      method: "POST",
      body: JSON.stringify({ action, user_identifier: userIdentifier }),
    });
  },

  /**
   * POST /api/caregiver/link/
   * Caretaker submits Senior ID to create/retrieve a pending link.
   */
  async linkSenior({ senior_id, phone_number, full_name = "", caretaker_slot = "PRIMARY" }) {
    return this.request(`/caregiver/link/`, {
      method: "POST",
      body: JSON.stringify({ senior_id, phone_number, full_name, caretaker_slot }),
    });
  },

  /**
   * GET /api/caregiver/linked-senior/?senior_id=<id>&phone_number=<phone>
   * Returns authorized senior overview for the authenticated caretaker.
   * 403 if PENDING or REVOKED.
   */
  async getLinkedSeniorOverview({ senior_id, phone_number }) {
    const params = new URLSearchParams({ senior_id, phone_number });
    const res = await fetch(`${BASE_URL}/caregiver/linked-senior/?${params.toString()}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const error = new Error(data.error || `Request failed (HTTP ${res.status})`);
      error.status = res.status;
      error.data = data;
      throw error;
    }
    return data;
  },

  // ── Caregiver Account & Linking (Client-Side Demo State) ──────────────
  async register({ username, password, full_name, email, phone_number }) {
    const user = { username, full_name, email, phone_number, role: "PRIMARY" };
    const token = "demo_caregiver_token_" + Date.now();
    this.setToken(token);
    this.setCurrentUser(user);
    return { status: "ok", token, caregiver: user, is_demo_auth: true };
  },

  async login({ username, password }) {
    const user = this.getCurrentUser() || { username, full_name: "Anita Raman", role: "PRIMARY" };
    const token = "demo_caregiver_token_" + Date.now();
    this.setToken(token);
    this.setCurrentUser(user);
    return { status: "ok", token, caregiver: user, is_demo_auth: true };
  },

  async loginSimple({ elder_id, phone_number, caretaker_slot = "1", full_name = "" }) {
    // Call real backend to validate Senior ID and create/retrieve caretaker link
    const res = await this.linkSenior({
      senior_id: elder_id,
      phone_number: phone_number,
      full_name: full_name || (caretaker_slot === "1" ? "Anita Raman" : "Suresh Raman"),
      caretaker_slot,
    });
    const link = res.link || {};
    const user = {
      username: phone_number,
      full_name: link.caretaker_name || full_name || "Caregiver",
      role: caretaker_slot === "1" ? "PRIMARY" : "SECONDARY",
      elder_id: link.senior_id || elder_id,
      phone_number: phone_number,
      caretaker_slot,
      link_status: link.status,  // "PENDING" | "APPROVED"
      link_id: link.id,
    };
    this.setCurrentUser(user);
    return {
      status: "ok",
      caregiver: user,
      link,
      elder: { elder_id: link.senior_id, name: link.senior_name },
    };
  },

  async logout() {
    this.clearAuth();
    return { status: "ok" };
  },

  async getMe() {
    return { status: "ok", caregiver: this.getCurrentUser() };
  },

  async updateMe(payload) {
    const current = this.getCurrentUser() || {};
    const updated = { ...current, ...payload };
    this.setCurrentUser(updated);
    return { status: "ok", caregiver: updated };
  },

  async getLinkedElders() {
    return {
      status: "ok",
      elders: [
        {
          elder_id: "default_user",
          name: "Raj Kumar",
          age: 78,
          relationship: "Mother / Family Elder",
          role: "PRIMARY",
        },
      ],
    };
  },

  async requestLink({ elder_id, role = "PRIMARY" }) {
    return {
      status: "ok",
      is_simulated: true,
      message: `Link request for Elder ${elder_id} recorded in demo state. Server-side linking requires database models.`,
      link: { elder_id, role, status: "PENDING_APPROVAL" },
    };
  },

  async testEmergencyAlert(elderId = "") {
    return {
      status: "ok",
      is_simulated: true,
      message: "Test emergency alert simulated. No real phone call placed.",
    };
  },

  async generateTodayReport(elderId = "") {
    return this.generateDailyReport(elderId);
  },
};
