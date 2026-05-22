import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

type Payload = Record<string, string | number>;

type Report = {
  id: string;
  created_at: string;
  pm_name: string;
  job_name: string;
  job_number: string;
  job_end_date: string;
  notes: string;
  payload: Payload;
};

const FO_COLOR  = "#f0b429";
const JO_COLOR  = "#3b82f6";
const AP_COLOR  = "#10b981";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
  :root {
    --bg:#0d1117;--card:#161b22;--border:#30363d;--border-faint:#21262d;
    --text:#e6edf3;--muted:#7d8590;--label:#a5b4c3;--accent:#f0b429;
    --th-bg:#1c2128;--row-even:#161b22;--row-odd:#1a1f27;
    --font-display:'Oswald','Impact',sans-serif;
    --font-label:'Barlow Condensed','Arial Narrow',sans-serif;
    --font-body:'Barlow','Segoe UI',sans-serif;
    --font-mono:'JetBrains Mono','Courier New',monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
`;

const TOOLTIP_STYLE = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 2,
  fontFamily: "'Barlow','Segoe UI',sans-serif",
  fontSize: 12,
  color: "#e6edf3",
};

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "16px 20px", flex: 1, minWidth: 130 }}>
      <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>{value.toLocaleString()}</div>
      {sub && <div style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--text)", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-block", width: 3, height: 18, background: "var(--accent)", borderRadius: 1, flexShrink: 0 }} />
        {text}
      </div>
      {sub && <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 3, marginLeft: 13, letterSpacing: "0.04em" }}>{sub}</div>}
    </div>
  );
}

const thS = (align = "left"): React.CSSProperties => ({
  padding: "8px 12px",
  textAlign: align as React.CSSProperties["textAlign"],
  fontFamily: "var(--font-label)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--muted)",
  cursor: "pointer",
  userSelect: "none",
  whiteSpace: "nowrap",
});

const tdS = (align = "left"): React.CSSProperties => ({
  padding: "7px 12px",
  textAlign: align as React.CSSProperties["textAlign"],
  borderBottom: "1px solid var(--border-faint)",
  verticalAlign: "middle",
});

export default function Dashboard() {
  const [reports, setReports]   = useState<Report[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("desc");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("manpower_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setReports((data as Report[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Most recent submission per job_number
  const latestByJob = useMemo(() => {
    const map: Record<string, Report> = {};
    for (const r of reports) {
      const ts  = String(r.payload.Submission_Timestamp || r.created_at);
      const ex  = map[r.job_number];
      const exTs = ex ? String(ex.payload.Submission_Timestamp || ex.created_at) : "";
      if (!ex || ts > exTs) map[r.job_number] = r;
    }
    return Object.values(map);
  }, [reports]);

  // Aggregate crew by week across all active jobs
  const weeklyData = useMemo(() => [
    {
      week: "Wk 1 — Current",
      Foremen:     latestByJob.reduce((s, r) => s + (Number(r.payload.W1_FO_Total) || 0), 0),
      Journeymen:  latestByJob.reduce((s, r) => s + (Number(r.payload.W1_JO_Total) || 0), 0),
      Apprentices: latestByJob.reduce((s, r) => s + (Number(r.payload.W1_AP_Total) || 0), 0),
    },
    {
      week: "Wk 2",
      Foremen:     latestByJob.reduce((s, r) => s + (Number(r.payload.W2_FO_Total) || 0), 0),
      Journeymen:  latestByJob.reduce((s, r) => s + (Number(r.payload.W2_JO_Total) || 0), 0),
      Apprentices: latestByJob.reduce((s, r) => s + (Number(r.payload.W2_AP_Total) || 0), 0),
    },
    {
      week: "Wk 3",
      Foremen:     latestByJob.reduce((s, r) => s + (Number(r.payload.W3_FO_Total) || 0), 0),
      Journeymen:  latestByJob.reduce((s, r) => s + (Number(r.payload.W3_JO_Total) || 0), 0),
      Apprentices: latestByJob.reduce((s, r) => s + (Number(r.payload.W3_AP_Total) || 0), 0),
    },
  ], [latestByJob]);

  // Per-job current week breakdown for horizontal bar chart
  const jobWeekData = useMemo(() =>
    latestByJob
      .sort((a, b) => (Number(b.payload.W1_WeekTotal) || 0) - (Number(a.payload.W1_WeekTotal) || 0))
      .slice(0, 12)
      .map(r => ({
        job:         r.job_number.length > 22 ? r.job_number.slice(0, 20) + "…" : r.job_number,
        Foremen:     Number(r.payload.W1_FO_Total) || 0,
        Journeymen:  Number(r.payload.W1_JO_Total) || 0,
        Apprentices: Number(r.payload.W1_AP_Total) || 0,
      }))
      .filter(d => d.Foremen + d.Journeymen + d.Apprentices > 0),
    [latestByJob]
  );

  // Summary stats
  const totalJobs   = latestByJob.length;
  const totalW1     = latestByJob.reduce((s, r) => s + (Number(r.payload.W1_WeekTotal) || 0), 0);
  const totalW2     = latestByJob.reduce((s, r) => s + (Number(r.payload.W2_WeekTotal) || 0), 0);
  const totalW3     = latestByJob.reduce((s, r) => s + (Number(r.payload.W3_WeekTotal) || 0), 0);
  const totalW4Plus = latestByJob.reduce((s, r) => s + (Number(r.payload.Weeks_4_Plus_Total_Crew) || 0), 0);

  // Sortable submissions table
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => {
      let av: string | number;
      let bv: string | number;
      if (["W1_WeekTotal", "W2_WeekTotal", "W3_WeekTotal"].includes(sortField)) {
        av = Number(a.payload[sortField]) || 0;
        bv = Number(b.payload[sortField]) || 0;
      } else {
        av = (a as unknown as Record<string, string>)[sortField] ?? "";
        bv = (b as unknown as Record<string, string>)[sortField] ?? "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    });
  }, [reports, sortField, sortDir]);

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const sortArrow = (field: string) => sortField === field ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  if (loading) return (
    <div style={{ background: "#0d1117", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{CSS}</style>
      <span style={{ fontFamily: "var(--font-label)", fontSize: 14, color: "var(--muted)", letterSpacing: "0.08em" }}>Loading forecast data…</span>
    </div>
  );

  if (error) return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: 32 }}>
      <style>{CSS}</style>
      <div style={{ color: "#ff7b72", fontFamily: "var(--font-body)", fontSize: 14, marginBottom: 12 }}>Error: {error}</div>
      <button onClick={fetchData} style={{ background: "var(--accent)", border: "none", borderRadius: 2, padding: "8px 16px", cursor: "pointer", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, color: "#0d1117" }}>Retry</button>
    </div>
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d1117 0%,#161b22 100%)", borderBottom: "3px solid var(--accent)", padding: "28px 32px 24px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>Electrical Contractor</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em", lineHeight: 1 }}>CREW ANALYSIS</div>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: "0.06em" }}>Manpower Forecast Dashboard — Aggregated from PM Submissions</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={fetchData} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 2, color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", padding: "8px 16px" }}>
              ↻ Refresh
            </button>
            <a href="#/" style={{ background: "var(--accent)", color: "#0d1117", borderRadius: 2, padding: "8px 16px", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textDecoration: "none" }}>
              ← Submit Form
            </a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 60px" }}>

        {/* Summary Cards */}
        <section style={{ marginBottom: 36 }}>
          <SectionLabel
            text="Company Snapshot"
            sub={`Based on latest submission per job · ${reports.length} total submission${reports.length !== 1 ? "s" : ""}`}
          />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <StatCard label="Active Jobs"    value={totalJobs}   sub="latest per job" />
            <StatCard label="Week 1 Crew"    value={totalW1}     sub="current week" />
            <StatCard label="Week 2 Crew"    value={totalW2}     sub="next week" />
            <StatCard label="Week 3 Crew"    value={totalW3}     sub="week after next" />
            <StatCard label="Weeks 4+ Crew"  value={totalW4Plus} sub="combined remaining" />
          </div>
        </section>

        {/* Company crew by week — stacked by role */}
        <section style={{ marginBottom: 36 }}>
          <SectionLabel text="Company Crew by Week" sub="Aggregate across all active jobs — stacked by role" />
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "24px 16px 16px" }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={weeklyData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis dataKey="week" tick={{ fill: "#7d8590", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12 }} axisLine={{ stroke: "#30363d" }} tickLine={false} />
                <YAxis tick={{ fill: "#7d8590", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="Foremen"     stackId="a" fill={FO_COLOR} />
                <Bar dataKey="Journeymen"  stackId="a" fill={JO_COLOR} />
                <Bar dataKey="Apprentices" stackId="a" fill={AP_COLOR} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Current week crew by job */}
        {jobWeekData.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <SectionLabel text="Current Week Crew by Job" sub="Week 1 headcount per active job — stacked by role" />
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "24px 16px 16px" }}>
              <ResponsiveContainer width="100%" height={Math.max(260, jobWeekData.length * 34)}>
                <BarChart data={jobWeekData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#7d8590", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="job" tick={{ fill: "#a5b4c3", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12 }} axisLine={{ stroke: "#30363d" }} tickLine={false} width={140} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="Foremen"     stackId="a" fill={FO_COLOR} />
                  <Bar dataKey="Journeymen"  stackId="a" fill={JO_COLOR} />
                  <Bar dataKey="Apprentices" stackId="a" fill={AP_COLOR} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* All Submissions Table */}
        <section>
          <SectionLabel
            text="All Submissions"
            sub={`${reports.length} record${reports.length !== 1 ? "s" : ""} — click column headers to sort`}
          />
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 660 }}>
              <thead>
                <tr style={{ background: "var(--th-bg)" }}>
                  <th style={thS()}          onClick={() => handleSort("job_number")}>Job #{sortArrow("job_number")}</th>
                  <th style={thS()}          onClick={() => handleSort("pm_name")}>PM{sortArrow("pm_name")}</th>
                  <th style={thS("center")}  onClick={() => handleSort("W1_WeekTotal")}>Wk 1{sortArrow("W1_WeekTotal")}</th>
                  <th style={thS("center")}  onClick={() => handleSort("W2_WeekTotal")}>Wk 2{sortArrow("W2_WeekTotal")}</th>
                  <th style={thS("center")}  onClick={() => handleSort("W3_WeekTotal")}>Wk 3{sortArrow("W3_WeekTotal")}</th>
                  <th style={thS("center")}>Wk 4+</th>
                  <th style={thS()}          onClick={() => handleSort("job_end_date")}>End Date{sortArrow("job_end_date")}</th>
                  <th style={thS()}          onClick={() => handleSort("created_at")}>Submitted{sortArrow("created_at")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedReports.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "var(--row-even)" : "var(--row-odd)" }}>
                    <td style={{ ...tdS(), fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{r.job_number}</td>
                    <td style={{ ...tdS(), fontFamily: "var(--font-body)", fontSize: 12, color: "var(--label)" }}>{r.pm_name}</td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
                      {Number(r.payload.W1_WeekTotal) || "–"}
                    </td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>
                      {Number(r.payload.W2_WeekTotal) || "–"}
                    </td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>
                      {Number(r.payload.W3_WeekTotal) || "–"}
                    </td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
                      {Number(r.payload.Weeks_4_Plus_Total_Crew) || "–"}
                    </td>
                    <td style={{ ...tdS(), fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {r.job_end_date
                        ? new Date(r.job_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "–"}
                    </td>
                    <td style={{ ...tdS(), fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
                {sortedReports.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ ...tdS("center"), color: "var(--muted)", fontFamily: "var(--font-label)", fontSize: 13, padding: "40px 0" }}>
                      No submissions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
