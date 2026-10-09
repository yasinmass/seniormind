import React, { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Info,
  ChevronRight,
  ListChecks,
  Activity,
  Heart,
} from "lucide-react";
import { caregiverApi } from "../api/caregiverApi";

export default function CaregiverReports({ elderId, elderName, caregiverRole, onRefreshOverview }) {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await caregiverApi.getElderReports(elderId);
      const list = res.reports || [];
      setReports(list);
      if (list.length > 0 && !selectedReport) {
        setSelectedReport(list[0]);
      }
    } catch (err) {
      setError(err.message || "Failed to load wellbeing reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (elderId) {
      fetchReports();
    }
  }, [elderId]);

  const handleGenerateToday = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await caregiverApi.generateDailyReport(elderId, { force: true });
      if (res.report) {
        setSelectedReport(res.report);
      }
      fetchReports();
      if (onRefreshOverview) onRefreshOverview();
    } catch (err) {
      setError(err.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  const formatReportDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const [year, month, day] = dateStr.split("-");
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    } catch (_) {
      return dateStr;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 800, color: "#FFFFFF" }}>
            Daily Wellbeing Reports
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "#94A3B8" }}>
            Synthesized daily reports derived from Bhavi voice conversations and safety events for <strong>{elderName}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateToday}
          disabled={generating}
          style={{
            padding: "10px 18px",
            background: generating ? "#475569" : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            cursor: generating ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
          }}
        >
          <Sparkles size={16} />
          {generating ? "Synthesizing Report..." : "Generate Today's Report"}
        </button>
      </div>

      {error && (
        <div style={{
          background: "rgba(239, 68, 68, 0.15)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          color: "#FCA5A5",
          borderRadius: 14,
          padding: "14px 18px",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <div>{error}</div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
          Loading reports history...
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          background: "#1E293B",
          borderRadius: 20,
          padding: "48px 24px",
          textAlign: "center",
          border: "1px solid #334155",
        }}>
          <Calendar size={48} color="#60A5FA" style={{ marginBottom: 16 }} />
          <h3 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 700, color: "#FFFFFF" }}>
            No Wellbeing Reports Generated Yet
          </h3>
          <p style={{ margin: "0 auto 24px auto", maxWidth: 460, fontSize: 14, color: "#94A3B8", lineHeight: 1.5 }}>
            Daily reports synthesize the elder's conversations, routine updates, and safety events. Click the button below to generate today's initial report.
          </p>
          <button
            type="button"
            onClick={handleGenerateToday}
            disabled={generating}
            style={{
              padding: "12px 24px",
              background: "#2563EB",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {generating ? "Generating..." : "Generate First Report"}
          </button>
        </div>
      ) : (
        /* Reports Grid Layout (Sidebar List + Detail Pane) */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 20,
          alignItems: "start",
        }}>
          {/* Left Column: Report Dates List */}
          <div style={{
            background: "#1E293B",
            borderRadius: 20,
            padding: "20px",
            border: "1px solid #334155",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", marginBottom: 6 }}>
              Report History ({reports.length})
            </div>

            {reports.map((rep) => {
              const isSelected = selectedReport && selectedReport.id === rep.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 14,
                    background: isSelected ? "rgba(37, 99, 235, 0.15)" : "#0F172A",
                    border: isSelected ? "1px solid #3B82F6" : "1px solid #334155",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: isSelected ? "#2563EB" : "#1E293B",
                      color: isSelected ? "#FFFFFF" : "#94A3B8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF" }}>
                        {formatReportDate(rep.report_date)}
                      </div>
                      <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                        Completeness: {rep.data_completeness}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} color={isSelected ? "#60A5FA" : "#64748B"} />
                </div>
              );
            })}
          </div>

          {/* Right Column: Detailed Report View */}
          {selectedReport && (
            <div style={{
              background: "#1E293B",
              borderRadius: 20,
              padding: "24px",
              border: "1px solid #334155",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}>
              {/* Header */}
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 16,
                borderBottom: "1px solid #334155",
              }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#60A5FA", textTransform: "uppercase" }}>
                    Daily Wellbeing Summary
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: 20, fontWeight: 800, color: "#FFFFFF" }}>
                    {formatReportDate(selectedReport.report_date)}
                  </h3>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    background: selectedReport.data_completeness === "FULL" ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                    color: selectedReport.data_completeness === "FULL" ? "#4ADE80" : "#FACC15",
                    border: selectedReport.data_completeness === "FULL" ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(234, 179, 8, 0.3)",
                  }}>
                    {selectedReport.data_completeness_display || selectedReport.data_completeness}
                  </span>
                </div>
              </div>

              {/* Factual Integrity Notice */}
              <div style={{
                background: "rgba(15, 23, 42, 0.7)",
                border: "1px solid #334155",
                borderRadius: 14,
                padding: "12px 16px",
                fontSize: 12,
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}>
                <Info size={16} color="#60A5FA" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Medical Disclaimer:</strong> This summary is generated from stored voice interactions and safety detection records. It does not replace clinical evaluation.
                </div>
              </div>

              {/* Executive Summary */}
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>
                  Daily Overview & Insights
                </h4>
                <div style={{
                  background: "#0F172A",
                  borderRadius: 14,
                  padding: "16px",
                  border: "1px solid #334155",
                  fontSize: 14,
                  color: "#E2E8F0",
                  lineHeight: 1.6,
                }}>
                  {selectedReport.summary}
                </div>
              </div>

              {/* Factual Metrics Indicators */}
              {selectedReport.wellbeing_indicators && (
                <div>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>
                    Factual Indicators Recorded
                  </h4>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 12,
                  }}>
                    <div style={{ background: "#0F172A", padding: "12px", borderRadius: 12, border: "1px solid #334155" }}>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>Safety Events</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF", marginTop: 4 }}>
                        {selectedReport.wellbeing_indicators.total_safety_events || 0}
                      </div>
                    </div>
                    <div style={{ background: "#0F172A", padding: "12px", borderRadius: 12, border: "1px solid #334155" }}>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>Critical Risks</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#EF4444", marginTop: 4 }}>
                        {selectedReport.wellbeing_indicators.critical_events || 0}
                      </div>
                    </div>
                    <div style={{ background: "#0F172A", padding: "12px", borderRadius: 12, border: "1px solid #334155" }}>
                      <div style={{ fontSize: 11, color: "#94A3B8" }}>Memory Updates</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#A855F7", marginTop: 4 }}>
                        {selectedReport.wellbeing_indicators.memories_updated || 0}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Follow-up Items */}
              {selectedReport.follow_up_items && selectedReport.follow_up_items.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 15, fontWeight: 700, color: "#FFFFFF" }}>
                    Action Items for Family / Caregiver
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedReport.follow_up_items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#0F172A",
                          borderRadius: 12,
                          padding: "12px 16px",
                          border: "1px solid #334155",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          fontSize: 13,
                          color: "#F1F5F9",
                        }}
                      >
                        <ListChecks size={18} color="#60A5FA" style={{ flexShrink: 0 }} />
                        <span>{item.action || item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
