import { useState, useMemo } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION — paste your Power Automate HTTP trigger URL here
// See SETUP_GUIDE.md for step-by-step instructions
// ─────────────────────────────────────────────────────────────────────────────
const POWER_AUTOMATE_URL = "https://defaultcd5a6385583c413aa28aa6c2aa18e8.f6.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/72705878a1b740c89b05cb7d249c26b4/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=db8nTmOnccgwrEYuX63Dm_gPwOB3tIrmAEoFSOG2kwQ";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ROLES = ["Foremen", "Journeymen", "Apprentices"];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function addWeeks(date, n) { return addDays(date, n * 7); }
function fmtDate(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function fmtWeekLabel(monday) { return `${fmtDate(monday)} – ${fmtDate(addDays(monday, 4))}`; }

function emptyWeekGrid() {
  const g = {};
  ROLES.forEach(r => { g[r] = {}; DAYS.forEach(d => { g[r][d] = ""; }); });
  return g;
}

// Builds the flat JSON object posted to Power Automate.
// Each key becomes a column name in your Excel table.
function buildPayload({ pmName, jobName, jobNumber, jobEndDate, notes,
                        week1, week2, week3, remainingWeeks,
                        remainingWeekDefs, thisMonday, week2Monday, week3Monday }) {
  const flatWeek = (grid, prefix) => {
    const out = {};
    ROLES.forEach(role => {
      const tag = { Foremen: "FO", Journeymen: "JO", Apprentices: "AP" }[role];
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
    Job_Name:             jobName,
    Job_Number:           jobNumber,
    Job_End_Date:         jobEndDate,
    Notes:                notes,
    W1_Dates: fmtWeekLabel(thisMonday),  ...flatWeek(week1, "W1"),
    W2_Dates: fmtWeekLabel(week2Monday), ...flatWeek(week2, "W2"),
    W3_Dates: fmtWeekLabel(week3Monday), ...flatWeek(week3, "W3"),
    Weeks_4_Plus_Count:      remainingWeekDefs.length,
    Weeks_4_Plus_Summary:    remainingSummary || "N/A",
    Weeks_4_Plus_Total_Crew: remainingWeekDefs.reduce(
      (s, wk) => s + (parseInt(remainingWeeks[`wk${wk.num}`]) || 0), 0
    ),
  };
}

function WeekGrid({ weekLabel, weekNum, data, onChange, disabled }) {
  const colTotal = day => ROLES.reduce((s, r) => s + (parseInt(data[r][day]) || 0), 0);
  const rowTotal = role => DAYS.reduce((s, d) => s + (parseInt(data[role][d]) || 0), 0);
  const grandTotal = DAYS.reduce((s, d) => s + colTotal(d), 0);

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ background: "var(--accent)", color: "var(--bg)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>{weekNum}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.85 }}>{weekLabel}</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
          <thead>
            <tr style={{ background: "var(--th-bg)" }}>
              <th style={thS("left")}>Role</th>
              {DAYS.map(d => <th key={d} style={thS("center")}>{d}</th>)}
              <th style={{ ...thS("center"), color: "var(--accent)", borderLeft: "1px solid var(--border)" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role, ri) => (
              <tr key={role} style={{ background: ri % 2 === 0 ? "var(--row-even)" : "var(--row-odd)" }}>
                <td style={{ ...tdS("left"), fontFamily: "var(--font-label)", fontWeight: 600, fontSize: 12, letterSpacing: "0.06em", color: "var(--label)", whiteSpace: "nowrap" }}>{role}</td>
                {DAYS.map(day => (
                  <td key={day} style={tdS("center")}>
                    <input type="number" min="0" max="99" value={data[role][day]} disabled={disabled}
                      onChange={e => onChange(role, day, e.target.value)}
                      style={{ ...numInput, opacity: disabled ? 0.5 : 1 }} placeholder="0" />
                  </td>
                ))}
                <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)", borderLeft: "1px solid var(--border)", background: "var(--total-col)" }}>
                  {rowTotal(role) || "–"}
                </td>
              </tr>
            ))}
            <tr style={{ background: "var(--total-row)", borderTop: "2px solid var(--border)" }}>
              <td style={{ ...tdS("left"), fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", textTransform: "uppercase" }}>Daily Total</td>
              {DAYS.map(d => (
                <td key={d} style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{colTotal(d) || "–"}</td>
              ))}
              <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 800, color: "var(--accent)", borderLeft: "1px solid var(--border)", background: "var(--total-col)" }}>
                {grandTotal || "–"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thS = align => ({ padding: "8px 12px", textAlign: align, fontFamily: "var(--font-label)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" });
const tdS = align => ({ padding: "6px 10px", textAlign: align, borderBottom: "1px solid var(--border-faint)", verticalAlign: "middle" });
const numInput = { width: 52, textAlign: "center", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 14, padding: "4px 6px", outline: "none", transition: "border-color 0.15s" };

function SectionLabel({ text, sub }) {
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

function StatusBanner({ status, errorMsg, onDismiss }) {
  if (!status) return null;
  const cfg = {
    loading: { bg: "#1c2a1c", border: "#2ea043", color: "#56d364", text: "Submitting to SharePoint Excel…", icon: "⏳" },
    success: { bg: "#1c2a1c", border: "#2ea043", color: "#56d364", text: "Crew forecast saved to your SharePoint Excel file.", icon: "✓" },
    error:   { bg: "#2a1c1c", border: "#f85149", color: "#ff7b72", text: errorMsg || "Submission failed.", icon: "✕" },
  }[status];
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 2, padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <span style={{ fontSize: 18, lineHeight: 1.2 }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-label)", fontSize: 13, color: cfg.color, letterSpacing: "0.04em" }}>{cfg.text}</div>
        {status === "error" && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
            Verify POWER_AUTOMATE_URL is set in the source file and the Power Automate flow is active. See SETUP_GUIDE.md.
          </div>
        )}
      </div>
      {status !== "loading" && (
        <button onClick={onDismiss} style={{ background: "none", border: "none", color: cfg.color, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
      )}
    </div>
  );
}

export default function CrewForm() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMonday  = getMonday(today);
  const week2Monday = addWeeks(thisMonday, 1);
  const week3Monday = addWeeks(thisMonday, 2);
  const week4Monday = addWeeks(thisMonday, 3);

  const [pmName,     setPmName]     = useState("");
  const [jobName,    setJobName]    = useState("");
  const [jobNumber,  setJobNumber]  = useState("");
  const [jobEndDate, setJobEndDate] = useState("");
  const [notes,      setNotes]      = useState("");
  const [week1,      setWeek1]      = useState(emptyWeekGrid);
  const [week2,      setWeek2]      = useState(emptyWeekGrid);
  const [week3,      setWeek3]      = useState(emptyWeekGrid);
  const [remainingWeeks,  setRemainingWeeks]  = useState({});
  const [submitStatus,    setSubmitStatus]    = useState(null);
  const [errorMsg,        setErrorMsg]        = useState("");

  const remainingWeekDefs = useMemo(() => {
    if (!jobEndDate) return [];
    const endDate = new Date(jobEndDate + "T00:00:00");
    const weeks = []; let wkStart = week4Monday; let wkNum = 4;
    while (wkStart <= endDate) { weeks.push({ monday: new Date(wkStart), num: wkNum }); wkStart = addWeeks(wkStart, 1); wkNum++; }
    return weeks;
  }, [jobEndDate]);

  const handleWeekChange = setter => (role, day, val) =>
    setter(prev => ({ ...prev, [role]: { ...prev[role], [day]: val } }));

  const handleReset = () => {
    setPmName(""); setJobName(""); setJobNumber(""); setJobEndDate(""); setNotes("");
    setWeek1(emptyWeekGrid()); setWeek2(emptyWeekGrid()); setWeek3(emptyWeekGrid());
    setRemainingWeeks({}); setSubmitStatus(null);
  };

  const handleSubmit = async () => {
    if (!pmName || !jobName || !jobNumber || !jobEndDate) {
      alert("Please fill in all required fields (marked with *)."); return;
    }
    if (POWER_AUTOMATE_URL === "PASTE_YOUR_POWER_AUTOMATE_URL_HERE") {
      setErrorMsg("Power Automate URL is not configured. Open the source file and replace PASTE_YOUR_POWER_AUTOMATE_URL_HERE with your actual URL.");
      setSubmitStatus("error"); return;
    }
    setSubmitStatus("loading");
    const payload = buildPayload({ pmName, jobName, jobNumber, jobEndDate, notes, week1, week2, week3, remainingWeeks, remainingWeekDefs, thisMonday, week2Monday, week3Monday });
    try {
      const res = await fetch(POWER_AUTOMATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
      setSubmitStatus("success");
      setTimeout(() => { handleReset(); }, 4000);
    } catch (err) {
      setErrorMsg(`Could not reach Power Automate: ${err.message}`);
      setSubmitStatus("error");
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
        input:focus,textarea:focus{border-color:var(--accent)!important;box-shadow:0 0 0 2px rgba(240,180,41,.15);}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.6);cursor:pointer;}
        button:disabled{opacity:.5;cursor:not-allowed;}
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d1117 0%,#161b22 100%)", borderBottom: "3px solid var(--accent)", padding: "28px 32px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>Electrical Contractor</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em", lineHeight: 1 }}>CREW FORECAST</div>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: "0.06em" }}>Weekly Manpower Projection — Submitted by Project Manager</div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", textAlign: "right" }}>
            <div>Period Starting</div>
            <div style={{ color: "var(--text)", fontWeight: 700, fontSize: 13 }}>
              {thisMonday.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px 60px" }}>

        <StatusBanner status={submitStatus} errorMsg={errorMsg} onDismiss={() => setSubmitStatus(null)} />

        {/* Job Info */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel text="Job Information" />
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "20px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
              {[
                { label: "Project Manager Name",  val: pmName,     set: setPmName,     type: "text", ph: "Full name" },
                { label: "Job Name",               val: jobName,    set: setJobName,    type: "text", ph: "e.g. Eastbank Substation" },
                { label: "Job Number",             val: jobNumber,  set: setJobNumber,  type: "text", ph: "e.g. 2026-047" },
                { label: "Updated Job End Date ★", val: jobEndDate, set: setJobEndDate, type: "date", ph: "" },
              ].map(({ label, val, set, type, ph }) => (
                <div key={label}>
                  <label style={{ display: "block", fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
                    {label} <span style={{ color: "var(--accent)" }}>*</span>
                  </label>
                  <input type={type} value={val} placeholder={ph} disabled={busy}
                    onChange={e => set(e.target.value)}
                    style={{ ...numInput, width: "100%", padding: "8px 10px", fontSize: 14, textAlign: "left", fontFamily: type === "date" ? "var(--font-mono)" : "var(--font-body)" }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Week grids */}
        <section style={{ marginBottom: 8 }}>
          <SectionLabel text="Three-Week Daily Crew Breakdown" sub="Enter the number of each crew type needed per day" />
          <WeekGrid weekLabel={fmtWeekLabel(thisMonday)}  weekNum="Current Week"            data={week1} onChange={handleWeekChange(setWeek1)} disabled={busy} />
          <WeekGrid weekLabel={fmtWeekLabel(week2Monday)} weekNum="Week 2 — Following Week" data={week2} onChange={handleWeekChange(setWeek2)} disabled={busy} />
          <WeekGrid weekLabel={fmtWeekLabel(week3Monday)} weekNum="Week 3 — Third Week"     data={week3} onChange={handleWeekChange(setWeek3)} disabled={busy} />
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
            <div style={{ background: "var(--card)", border: "1px dashed var(--border)", borderRadius: 2, padding: "32px 24px", textAlign: "center", fontFamily: "var(--font-label)", fontSize: 13, color: "var(--muted)", letterSpacing: "0.06em" }}>
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
                        <td style={{ ...tdS("left"), fontFamily: "var(--font-label)", fontSize: 12, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em", whiteSpace: "nowrap", width: 80 }}>WK {wk.num}</td>
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

        {/* Notes */}
        <section style={{ marginBottom: 32 }}>
          <SectionLabel text="Additional Notes" sub="Optional" />
          <textarea value={notes} onChange={e => setNotes(e.target.value)} disabled={busy}
            placeholder="Scheduling concerns, access restrictions, material delivery windows, inspection holds, etc."
            style={{ width: "100%", minHeight: 88, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)", fontFamily: "var(--font-body)", fontSize: 14, padding: "12px 14px", resize: "vertical", outline: "none", lineHeight: 1.6, opacity: busy ? 0.5 : 1 }}
          />
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

const btnStyle = { background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 2, padding: "10px 24px", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" };
const pageStyle = { background: "var(--bg)", minHeight: "100vh", color: "var(--text)" };