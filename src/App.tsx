import { useState, useMemo, useEffect } from "react";
import { supabase } from "./lib/supabase";

const DAYS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ROLES = ["Foremen", "Journeymen", "Apprentices"];

// ─── Edit this list to add / remove Project Managers ──────────────────────
const PM_NAMES = [
  "Bill Ellis",
  "Mike Ellis",
  "Shawn Pichoff",
  "Keith Schexnaildre",
  "Ed Stein",
  "Matt Sutor",
  "Troy Vallotton",
];
// ──────────────────────────────────────────────────────────────────────────

const CONFIDENCE = [
  { label: "LOW",  value: "Low",    color: "#f85149" },
  { label: "MED",  value: "Medium", color: "#f0b429" },
  { label: "HIGH", value: "High",   color: "#3fb950" },
] as const;

const QUALIFICATIONS = [
  { key: "Background_Check", label: "Background Check" },
  { key: "OSHA_10",          label: "OSHA 10"          },
  { key: "OSHA_30",          label: "OSHA 30"          },
  { key: "First_Aid_CPR",    label: "First Aid / CPR"  },
  { key: "Aerial_Lift",      label: "Aerial Lift"      },
  { key: "Confined_Space",   label: "Confined Space"   },
  { key: "Arc_Flash",        label: "Arc Flash"        },
  { key: "Forklift",         label: "Forklift"         },
] as const;

type QualKey = typeof QUALIFICATIONS[number]["key"];
const emptyQuals = (): Record<QualKey, boolean> =>
  Object.fromEntries(QUALIFICATIONS.map(q => [q.key, false])) as Record<QualKey, boolean>;

// ── Utility functions ──────────────────────────────────────────────────────
function getMonday(date: Date | string): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d;
}
function addWeeks(date: Date, n: number): Date { return addDays(date, n * 7); }
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function fmtWeekLabel(monday: Date): string {
  return `${fmtDate(monday)} – ${fmtDate(addDays(monday, 6))}`;
}
function emptyWeekGrid(): Record<string, Record<string, string>> {
  const g: Record<string, Record<string, string>> = {};
  ROLES.forEach(r => { g[r] = {}; DAYS.forEach(d => { g[r][d] = ""; }); });
  return g;
}

// ── Reconstruct a week grid from a previously saved payload ───────────────
const TAG: Record<string, string> = { Foremen: "FO", Journeymen: "JO", Apprentices: "AP" };
function weekGridFromPayload(prefix: string, p: Record<string, unknown>): Record<string, Record<string, string>> {
  const grid: Record<string, Record<string, string>> = {};
  ROLES.forEach(role => {
    grid[role] = {};
    DAYS.forEach(day => {
      const v = Number(p[`${prefix}_${TAG[role]}_${day}`] ?? 0);
      grid[role][day] = v === 0 ? "" : String(v);
    });
  });
  return grid;
}

// ── Payload builder ────────────────────────────────────────────────────────
function buildPayload({
  pmName, jobNumber, jobEndDate,
  week1Notes, week2Notes, week3Notes,
  week1Confidence, week2Confidence, week3Confidence,
  qualifications,
  week1, week2, week3,
  remainingWeeks, remainingWeekDefs,
  thisMonday, week2Monday, week3Monday,
}: {
  pmName: string;
  jobNumber: string;
  jobEndDate: string;
  week1Notes: string;
  week2Notes: string;
  week3Notes: string;
  week1Confidence: string;
  week2Confidence: string;
  week3Confidence: string;
  qualifications: Record<QualKey, boolean>;
  week1: Record<string, Record<string, string>>;
  week2: Record<string, Record<string, string>>;
  week3: Record<string, Record<string, string>>;
  remainingWeeks: Record<string, string>;
  remainingWeekDefs: Array<{ monday: Date; num: number }>;
  thisMonday: Date;
  week2Monday: Date;
  week3Monday: Date;
}): Record<string, string | number> {
  const flatWeek = (grid: Record<string, Record<string, string>>, prefix: string) => {
    const out: Record<string, number> = {};
    ROLES.forEach(role => {
      const tag = { Foremen: "FO", Journeymen: "JO", Apprentices: "AP" }[role]!;
      DAYS.forEach(day => { out[`${prefix}_${tag}_${day}`] = parseInt(grid[role][day]) || 0; });
      out[`${prefix}_${tag}_Total`] = DAYS.reduce((s, d) => s + (parseInt(grid[role][d]) || 0), 0);
    });
    out[`${prefix}_WeekTotal`] = ROLES.reduce((s, r) =>
      s + DAYS.reduce((ss, d) => ss + (parseInt(grid[r][d]) || 0), 0), 0);
    return out;
  };

  const remainingSummary = remainingWeekDefs
    .map(wk => `Wk${wk.num} (${fmtWeekLabel(wk.monday)}): ${parseInt(remainingWeeks[`wk${wk.num}`]) || 0}`)
    .join(" | ");

  return {
    Submission_Date:      new Date().toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }),
    Submission_Timestamp: new Date().toISOString(),
    PM_Name:              pmName,
    Job_Number:           jobNumber,
    Job_End_Date:         jobEndDate,
    W1_Dates:       fmtWeekLabel(thisMonday),  ...flatWeek(week1, "W1"), W1_Confidence: week1Confidence, W1_Notes: week1Notes,
    W2_Dates:       fmtWeekLabel(week2Monday), ...flatWeek(week2, "W2"), W2_Confidence: week2Confidence, W2_Notes: week2Notes,
    W3_Dates:       fmtWeekLabel(week3Monday), ...flatWeek(week3, "W3"), W3_Confidence: week3Confidence, W3_Notes: week3Notes,
    Weeks_4_Plus_Count:      remainingWeekDefs.length,
    Weeks_4_Plus_Summary:    remainingSummary || "N/A",
    Weeks_4_Plus_Total_Crew: remainingWeekDefs.reduce(
      (s, wk) => s + (parseInt(remainingWeeks[`wk${wk.num}`]) || 0), 0
    ),
    ...Object.fromEntries(QUALIFICATIONS.map(q => [`Q_${q.key}`, qualifications[q.key] ? 1 : 0])),
  };
}

// ── Shared styles ──────────────────────────────────────────────────────────
const thS = (align: string): React.CSSProperties => ({
  padding: "8px 12px", textAlign: align as React.CSSProperties["textAlign"],
  fontFamily: "var(--font-label)", fontSize: 11, fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)",
});
const tdS = (align: string): React.CSSProperties => ({
  padding: "6px 10px", textAlign: align as React.CSSProperties["textAlign"],
  borderBottom: "1px solid var(--border-faint)", verticalAlign: "middle",
});
const numInput: React.CSSProperties = {
  width: 52, textAlign: "center", background: "var(--input-bg)",
  border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)",
  fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600,
  padding: "6px 8px", outline: "none", transition: "all 0.2s",
};
const fieldLabel: React.CSSProperties = {
  display: "block", fontFamily: "var(--font-label)", fontSize: 11,
  letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6,
};
const textInput: React.CSSProperties = {
  ...numInput, width: "100%", padding: "8px 10px", fontSize: 14,
  textAlign: "left", fontFamily: "var(--font-body)",
};

// ── WeekGrid ───────────────────────────────────────────────────────────────
function WeekGrid({ weekLabel, weekNum, data, onChange, disabled,
                    confidence, onConfidenceChange, notes, onNotesChange }: {
  weekLabel: string;
  weekNum: string;
  data: Record<string, Record<string, string>>;
  onChange: (role: string, day: string, value: string) => void;
  disabled: boolean;
  confidence: string;
  onConfidenceChange: (value: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  const colTotal = (day: string) => ROLES.reduce((s, r) => s + (parseInt(data[r][day]) || 0), 0);

  // Average per active (non-zero) day for a role row
  const rowAvg = (role: string): string => {
    const vals = DAYS.map(d => parseInt(data[role][d]) || 0).filter(v => v > 0);
    if (vals.length === 0) return "–";
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const r = Math.round(avg * 10) / 10;
    return r % 1 === 0 ? String(r) : r.toFixed(1);
  };

  // Average of daily totals over active (non-zero) days
  const grandAvg = (): string => {
    const dailies = DAYS.map(d => colTotal(d)).filter(v => v > 0);
    if (dailies.length === 0) return "–";
    const avg = dailies.reduce((s, v) => s + v, 0) / dailies.length;
    const r = Math.round(avg * 10) / 10;
    return r % 1 === 0 ? String(r) : r.toFixed(1);
  };

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}>

      {/* Week header bar */}
      <div style={{ background: "var(--accent)", color: "var(--bg)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>{weekNum}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.85 }}>{weekLabel}</span>
      </div>

      {/* Crew grid table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead>
            <tr style={{ background: "var(--th-bg)" }}>
              <th style={thS("left")}>Role</th>
              {DAYS.map(d => <th key={d} style={thS("center")}>{d}</th>)}
              <th style={{ ...thS("center"), color: "var(--accent)", borderLeft: "1px solid var(--border)" }}>Avg/Day</th>
              <th style={{ ...thS("center"), borderLeft: "1px solid var(--border)", minWidth: 80 }}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role, ri) => (
              <tr key={role} style={{ background: ri % 2 === 0 ? "var(--row-even)" : "var(--row-odd)" }}>
                <td style={{ ...tdS("left"), fontFamily: "var(--font-label)", fontWeight: 600, fontSize: 12, letterSpacing: "0.06em", color: "var(--label)", whiteSpace: "nowrap" }}>
                  {role}
                </td>
                {DAYS.map(day => (
                  <td key={day} style={tdS("center")}>
                    <input type="number" min="0" max="99" value={data[role][day]} disabled={disabled}
                      onChange={e => onChange(role, day, e.target.value)}
                      style={{ ...numInput, opacity: disabled ? 0.5 : 1 }} placeholder="0" />
                  </td>
                ))}
                <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", borderLeft: "1px solid var(--border)", background: "var(--total-col)" }}>
                  {rowAvg(role)}
                </td>
                {/* Confidence column — spans all 3 role rows */}
                {ri === 0 && (
                  <td rowSpan={ROLES.length} style={{ borderLeft: "1px solid var(--border)", verticalAlign: "middle", textAlign: "center", padding: "10px 8px", background: "var(--card)" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
                      {CONFIDENCE.map(cl => (
                        <button
                          key={cl.value}
                          disabled={disabled}
                          onClick={() => onConfidenceChange(confidence === cl.value ? "" : cl.value)}
                          style={{
                            background:  confidence === cl.value ? cl.color : "transparent",
                            border:      `1px solid ${confidence === cl.value ? cl.color : "var(--border)"}`,
                            borderRadius: 2,
                            color:       confidence === cl.value ? "#0d1117" : cl.color,
                            fontFamily:  "var(--font-label)",
                            fontWeight:  700,
                            fontSize:    10,
                            letterSpacing: "0.07em",
                            padding:     "4px 0",
                            cursor:      disabled ? "not-allowed" : "pointer",
                            width:       54,
                            transition:  "all 0.15s",
                          }}
                        >
                          {cl.label}
                        </button>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {/* Daily Total row */}
            <tr style={{ background: "var(--total-row)", borderTop: "2px solid var(--border)" }}>
              <td style={{ ...tdS("left"), fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>Daily Total</td>
              {DAYS.map(d => (
                <td key={d} style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                  {colTotal(d) || "–"}
                </td>
              ))}
              <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, color: "var(--accent)", borderLeft: "1px solid var(--border)", background: "var(--total-col)" }}>
                {grandAvg()}
              </td>
              {/* Placeholder to keep column count consistent */}
              <td style={{ borderLeft: "1px solid var(--border)", background: "var(--total-row)" }} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Per-week notes */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border-faint)" }}>
        <label style={fieldLabel}>
          Week Notes&nbsp;<span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, color: "var(--muted)", fontSize: 10 }}>(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          disabled={disabled}
          placeholder="Scheduling concerns, access restrictions, material delivery windows, inspection holds, etc."
          style={{ width: "100%", minHeight: 64, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 13, padding: "8px 10px", outline: "none", transition: "all 0.2s", resize: "vertical" }}
        />
      </div>
    </div>
  );
}

// ── Supporting components ──────────────────────────────────────────────────
function SectionLabel({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--text)", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-block", width: 3, height: 18, background: "var(--accent)", borderRadius: 1, flexShrink: 0 }} />
        {text}
      </div>
      {sub && <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 3, marginLeft: 13, letterSpacing: "0.04em" }}>{sub}</div>}
    </div>
  );
}

type StatusConfig = { bg: string; border: string; color: string; text: string; icon: string };

function StatusBanner({ status, errorMsg, onDismiss }: { status: string | null; errorMsg: string; onDismiss: () => void }) {
  if (!status) return null;
  const configs: Record<string, StatusConfig> = {
    loading: { bg: "#1c2a1c", border: "#2ea043", color: "#56d364", text: "Submitting manpower forecast…", icon: "⏳" },
    success: { bg: "#1c2a1c", border: "#2ea043", color: "#56d364", text: "Crew forecast saved successfully.", icon: "✓" },
    error:   { bg: "#2a1c1c", border: "#f85149", color: "#ff7b72", text: errorMsg || "Submission failed.", icon: "✕" },
  };
  const cfg = configs[status] ?? configs.error;
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 2, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ fontSize: 18, lineHeight: 1.2 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-label)", fontSize: 13, color: cfg.color, letterSpacing: "0.04em" }}>{cfg.text}</div>
      </div>
      {status !== "loading" && (
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: cfg.color, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────
export default function CrewForm() {
  const today       = new Date(); today.setHours(0, 0, 0, 0);
  // Week 1 always starts next Monday so PMs never fill in days that have already passed
  const thisMonday  = addWeeks(getMonday(today), 1);
  const week2Monday = addWeeks(thisMonday, 1);
  const week3Monday = addWeeks(thisMonday, 2);
  const week4Monday = addWeeks(thisMonday, 3);

  const [pmName,     setPmName]     = useState("");
  const [jobNumber,  setJobNumber]  = useState("");
  const [jobEndDate, setJobEndDate] = useState("");

  const [week1, setWeek1] = useState(emptyWeekGrid);
  const [week2, setWeek2] = useState(emptyWeekGrid);
  const [week3, setWeek3] = useState(emptyWeekGrid);

  const [week1Notes, setWeek1Notes] = useState("");
  const [week2Notes, setWeek2Notes] = useState("");
  const [week3Notes, setWeek3Notes] = useState("");

  const [week1Confidence, setWeek1Confidence] = useState("");
  const [week2Confidence, setWeek2Confidence] = useState("");
  const [week3Confidence, setWeek3Confidence] = useState("");

  const [qualifications, setQualifications] = useState<Record<QualKey, boolean>>(emptyQuals);
  const [remainingWeeks, setRemainingWeeks] = useState<Record<string, string>>({});
  const [submitStatus,   setSubmitStatus]   = useState<string | null>(null);
  const [errorMsg,       setErrorMsg]       = useState("");
  const [qualsLoading,   setQualsLoading]   = useState(false);

  // Auto-populate the full form when a known job number is typed
  useEffect(() => {
    if (!jobNumber || jobNumber.trim().length < 2) return;
    const timer = setTimeout(async () => {
      setQualsLoading(true);
      const { data } = await supabase
        .from("manpower_reports")
        .select("payload, job_end_date")
        .eq("job_number", jobNumber.trim())
        .order("created_at", { ascending: false })
        .limit(1);
      if (data?.[0]) {
        const row = data[0] as { payload: Record<string, unknown>; job_end_date: string | null };
        const p = row.payload;

        // Qualifications
        setQualifications(
          Object.fromEntries(
            QUALIFICATIONS.map(q => [q.key, Boolean(p[`Q_${q.key}`])])
          ) as Record<QualKey, boolean>
        );

        // Week grids — shift forward based on weeks elapsed since last submission
        const submittedAt = p.Submission_Timestamp ? String(p.Submission_Timestamp) : null;
        const prevMonday  = submittedAt ? getMonday(submittedAt) : null;
        const currMonday  = getMonday(new Date());
        const weekDiff    = prevMonday
          ? Math.round((currMonday.getTime() - prevMonday.getTime()) / (7 * 24 * 60 * 60 * 1000))
          : 0;

        if (weekDiff <= 0) {
          // Same week or future (shouldn't happen) — no shift
          setWeek1(weekGridFromPayload("W1", p));
          setWeek2(weekGridFromPayload("W2", p));
          setWeek3(weekGridFromPayload("W3", p));
          if (p.W1_Confidence) setWeek1Confidence(String(p.W1_Confidence));
          if (p.W2_Confidence) setWeek2Confidence(String(p.W2_Confidence));
          if (p.W3_Confidence) setWeek3Confidence(String(p.W3_Confidence));
          if (p.W1_Notes) setWeek1Notes(String(p.W1_Notes));
          if (p.W2_Notes) setWeek2Notes(String(p.W2_Notes));
          if (p.W3_Notes) setWeek3Notes(String(p.W3_Notes));
        } else if (weekDiff === 1) {
          // 1 week later: prev W2 → curr W1, prev W3 → curr W2, W3 = empty
          setWeek1(weekGridFromPayload("W2", p));
          setWeek2(weekGridFromPayload("W3", p));
          setWeek3(emptyWeekGrid());
          if (p.W2_Confidence) setWeek1Confidence(String(p.W2_Confidence));
          if (p.W3_Confidence) setWeek2Confidence(String(p.W3_Confidence));
          setWeek3Confidence("");
          if (p.W2_Notes) setWeek1Notes(String(p.W2_Notes));
          if (p.W3_Notes) setWeek2Notes(String(p.W3_Notes));
          setWeek3Notes("");
        } else if (weekDiff === 2) {
          // 2 weeks later: prev W3 → curr W1, W2 and W3 = empty
          setWeek1(weekGridFromPayload("W3", p));
          setWeek2(emptyWeekGrid());
          setWeek3(emptyWeekGrid());
          if (p.W3_Confidence) setWeek1Confidence(String(p.W3_Confidence));
          setWeek2Confidence(""); setWeek3Confidence("");
          if (p.W3_Notes) setWeek1Notes(String(p.W3_Notes));
          setWeek2Notes(""); setWeek3Notes("");
        } else {
          // 3+ weeks later — too stale, clear all weeks
          setWeek1(emptyWeekGrid());
          setWeek2(emptyWeekGrid());
          setWeek3(emptyWeekGrid());
          setWeek1Confidence(""); setWeek2Confidence(""); setWeek3Confidence("");
          setWeek1Notes(""); setWeek2Notes(""); setWeek3Notes("");
        }

        // Job end date
        if (row.job_end_date) setJobEndDate(row.job_end_date);
      }
      setQualsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [jobNumber]);

  const remainingWeekDefs = useMemo(() => {
    if (!jobEndDate) return [];
    const endDate = new Date(jobEndDate + "T00:00:00");
    const weeks: Array<{ monday: Date; num: number }> = [];
    let wkStart = week4Monday, wkNum = 4;
    while (wkStart <= endDate) {
      weeks.push({ monday: new Date(wkStart), num: wkNum });
      wkStart = addWeeks(wkStart, 1);
      wkNum++;
    }
    return weeks;
  }, [jobEndDate]);

  const handleWeekChange = (setter: React.Dispatch<React.SetStateAction<Record<string, Record<string, string>>>>) =>
    (role: string, day: string, val: string) =>
      setter(prev => ({ ...prev, [role]: { ...prev[role], [day]: val } }));

  const handleReset = () => {
    setPmName(""); setJobNumber(""); setJobEndDate("");
    setWeek1(emptyWeekGrid()); setWeek2(emptyWeekGrid()); setWeek3(emptyWeekGrid());
    setWeek1Notes(""); setWeek2Notes(""); setWeek3Notes("");
    setWeek1Confidence(""); setWeek2Confidence(""); setWeek3Confidence("");
    setQualifications(emptyQuals());
    setRemainingWeeks({}); setSubmitStatus(null);
  };

  const handleSubmit = async () => {
    if (!pmName || !jobNumber || !jobEndDate) {
      alert("Please fill in all required fields (marked with *).");
      return;
    }

    setSubmitStatus("loading");

    const payload = buildPayload({
      pmName, jobNumber, jobEndDate,
      week1Notes, week2Notes, week3Notes,
      week1Confidence, week2Confidence, week3Confidence,
      qualifications,
      week1, week2, week3,
      remainingWeeks, remainingWeekDefs,
      thisMonday, week2Monday, week3Monday,
    });

    try {
      const { error } = await supabase
        .from("manpower_reports")
        .insert([{ pm_name: pmName, job_number: jobNumber, job_end_date: jobEndDate, payload }]);

      if (error) throw error;

      window.scrollTo({ top: 0, behavior: "smooth" });
      setSubmitStatus("success");
      setTimeout(() => handleReset(), 4000);

    } catch (err) {
      setErrorMsg(`Supabase submission failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setSubmitStatus("error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const busy = submitStatus === "loading";

  return (
    <div style={pageStyle}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
        :root {
          --bg:#0d1117;--card:#161b22;--border:#30363d;--border-faint:#21262d;
          --text:#e6edf3;--muted:#7d8590;--label:#a5b4c3;--accent:#f0b429;--input-bg:#0d1117;
          --th-bg:#1c2128;--row-even:#161b22;--row-odd:#1a1f27;--total-row:#1c2128;--total-col:#1a1f1a;
          --font-display:'Oswald','Impact',sans-serif;
          --font-label:'Barlow Condensed','Arial Narrow',sans-serif;
          --font-body:'Barlow','Segoe UI',sans-serif;
          --font-mono:'JetBrains Mono','Courier New',monospace;
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        input[type=number]::-webkit-outer-spin-button,input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input:focus,textarea:focus,select:focus{border-color:var(--accent)!important;box-shadow:0 0 0 2px rgba(240,180,41,.15);outline:none;}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.6);cursor:pointer;}
        button:disabled{opacity:.5;cursor:not-allowed;}
        select option{background:#161b22;color:#e6edf3;}
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d1117 0%,#161b22 100%)", borderBottom: "3px solid var(--accent)", padding: "28px 32px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>Electrical Contractor</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em", lineHeight: 1 }}>CREW FORECAST</div>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: "0.06em" }}>Weekly Manpower Projection — Submitted by Project Manager</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
            <a href="#/dashboard" style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 2, color: "var(--muted)", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", padding: "7px 14px", textDecoration: "none" }}>
              View Dashboard →
            </a>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
              <div>Period Starting</div>
              <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>
                {thisMonday.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>

        <StatusBanner status={submitStatus} errorMsg={errorMsg} onDismiss={() => setSubmitStatus(null)} />

        {/* Job Information */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel text="Job Information" />
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>

              {/* PM Name — dropdown */}
              <div>
                <label style={fieldLabel}>Project Manager <span style={{ color: "var(--accent)" }}>*</span></label>
                <select
                  value={pmName}
                  onChange={e => setPmName(e.target.value)}
                  disabled={busy}
                  style={{
                    ...textInput,
                    appearance: "none" as React.CSSProperties["appearance"],
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237d8590' d='M5 7L0 2h10z'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 10px center",
                    paddingRight: 30,
                    cursor: busy ? "not-allowed" : "pointer",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <option value="">Select a PM…</option>
                  {PM_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              {/* Job Number */}
              <div>
                <label style={fieldLabel}>Job Number <span style={{ color: "var(--accent)" }}>*</span></label>
                <input
                  type="text" value={jobNumber} placeholder="e.g. 2026-047" disabled={busy}
                  onChange={e => setJobNumber(e.target.value)}
                  style={textInput}
                />
              </div>

              {/* Job End Date */}
              <div>
                <label style={fieldLabel}>Updated Job End Date <span style={{ color: "var(--accent)" }}>*</span></label>
                <input
                  type="date" value={jobEndDate} disabled={busy}
                  onChange={e => setJobEndDate(e.target.value)}
                  style={{ ...textInput, fontFamily: "var(--font-mono)" }}
                />
              </div>

            </div>

            {/* Required Worker Qualifications */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-faint)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <label style={{ ...fieldLabel, marginBottom: 0 }}>Required Worker Qualifications</label>
                {qualsLoading && (
                  <span style={{ fontFamily: "var(--font-label)", fontSize: 10, color: "var(--muted)", letterSpacing: "0.06em" }}>
                    loading…
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px 16px" }}>
                {QUALIFICATIONS.map(q => (
                  <label
                    key={q.key}
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: busy ? "not-allowed" : "pointer", userSelect: "none" }}
                  >
                    <input
                      type="checkbox"
                      checked={qualifications[q.key] ?? false}
                      onChange={e => setQualifications(prev => ({ ...prev, [q.key]: e.target.checked }))}
                      disabled={busy}
                      style={{ display: "none" }}
                    />
                    {/* Custom checkbox */}
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 16, height: 16, flexShrink: 0, borderRadius: 2, transition: "all 0.15s",
                      border: `1px solid ${qualifications[q.key] ? "var(--accent)" : "var(--border)"}`,
                      background: qualifications[q.key] ? "var(--accent)" : "transparent",
                      opacity: busy ? 0.5 : 1,
                    }}>
                      {qualifications[q.key] && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#0d1117" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--label)", letterSpacing: "0.04em" }}>
                      {q.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Week grids — confidence + notes now live inside each WeekGrid */}
        <section style={{ marginBottom: 8 }}>
          <SectionLabel text="Three-Week Daily Crew Breakdown" sub="Enter the number of each crew type needed per day" />
          <WeekGrid
            weekLabel={fmtWeekLabel(thisMonday)} weekNum="Week 1 — Next Week"
            data={week1} onChange={handleWeekChange(setWeek1)} disabled={busy}
            confidence={week1Confidence} onConfidenceChange={setWeek1Confidence}
            notes={week1Notes} onNotesChange={setWeek1Notes}
          />
          <WeekGrid
            weekLabel={fmtWeekLabel(week2Monday)} weekNum="Week 2 — Following Week"
            data={week2} onChange={handleWeekChange(setWeek2)} disabled={busy}
            confidence={week2Confidence} onConfidenceChange={setWeek2Confidence}
            notes={week2Notes} onNotesChange={setWeek2Notes}
          />
          <WeekGrid
            weekLabel={fmtWeekLabel(week3Monday)} weekNum="Week 3 — Third Week"
            data={week3} onChange={handleWeekChange(setWeek3)} disabled={busy}
            confidence={week3Confidence} onConfidenceChange={setWeek3Confidence}
            notes={week3Notes} onNotesChange={setWeek3Notes}
          />
        </section>

        {/* Remaining weeks */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel
            text="Remaining Weeks — Total Crew Per Week"
            sub={jobEndDate
              ? `Weeks 4 through job end · ${remainingWeekDefs.length} week${remainingWeekDefs.length !== 1 ? "s" : ""} remaining`
              : "Enter a job end date above to populate remaining weeks"}
          />
          {!jobEndDate ? (
            <div style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 2, padding: "32px 24px", textAlign: "center", fontFamily: "var(--font-label)", fontSize: 13, color: "var(--muted)" }}>
              ↑ Set the Updated Job End Date to populate remaining weeks
            </div>
          ) : remainingWeekDefs.length === 0 ? (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "20px 24px", textAlign: "center", fontFamily: "var(--font-label)", fontSize: 13, color: "var(--muted)" }}>
              No weeks remaining beyond Week 3 based on the entered end date.
            </div>
          ) : (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--th-bg)" }}>
                    <th style={thS("left")}>Week</th>
                    <th style={thS("left")}>Dates</th>
                    <th style={thS("center")}>Total Crew Members Needed</th>
                  </tr>
                </thead>
                <tbody>
                  {remainingWeekDefs.map((wk, i) => {
                    const key = `wk${wk.num}`;
                    return (
                      <tr key={key} style={{ background: i % 2 === 0 ? "var(--row-even)" : "var(--row-odd)", borderBottom: "1px solid var(--border-faint)" }}>
                        <td style={{ ...tdS("left"), fontFamily: "var(--font-label)", fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em", whiteSpace: "nowrap", width: 80 }}>Wk{wk.num}</td>
                        <td style={{ ...tdS("left"), fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>{fmtWeekLabel(wk.monday)}</td>
                        <td style={{ ...tdS("center"), width: 200 }}>
                          <input type="number" min="0" max="999" disabled={busy}
                            value={remainingWeeks[key] || ""}
                            onChange={e => setRemainingWeeks(p => ({ ...p, [key]: e.target.value }))}
                            placeholder="0" style={{ ...numInput, width: 80 }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={handleReset} disabled={busy}
            style={{ ...btnStyle, background: "transparent", color: "var(--muted)", border: "1px solid var(--border)" }}>
            Clear Form
          </button>
          <button onClick={handleSubmit} disabled={busy} style={{ ...btnStyle, minWidth: 210 }}>
            {busy ? "Submitting…" : "Submit Crew Forecast →"}
          </button>
        </div>

      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 2,
  padding: "10px 24px", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 13,
  letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.2s",
  boxShadow: "0 2px 8px rgba(240,180,41,.2)",
};
const pageStyle: React.CSSProperties = { background: "var(--bg)", minHeight: "100vh", color: "var(--text)" };
