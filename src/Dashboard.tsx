import { useState, useEffect, useMemo } from "react";
import { supabase } from "./lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────
type Payload = Record<string, string | number>;

type Report = {
  id: string;
  created_at: string;
  pm_name: string;
  job_number: string;
  job_end_date: string;
  payload: Payload | null;
};

// ── Config — edit as needed ────────────────────────────────────────────────
const COMPANY_CAPACITY = 100; // total field headcount available

const JOB_COLORS = [
  "#f0b429", "#3b82f6", "#10b981", "#f472b6", "#a78bfa",
  "#fb923c", "#34d399", "#60a5fa", "#f87171", "#4ade80",
  "#fbbf24", "#818cf8", "#2dd4bf", "#e879f9", "#38bdf8",
];

const CONF_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  High:   { text: "#3fb950", bg: "rgba(63,185,80,0.12)",  border: "#3fb950" },
  Medium: { text: "#f0b429", bg: "rgba(240,180,41,0.12)", border: "#f0b429" },
  Low:    { text: "#f85149", bg: "rgba(248,81,73,0.12)",  border: "#f85149" },
};

const QUAL_KEYS = [
  "Q_Background_Check", "Q_OSHA_10", "Q_OSHA_30", "Q_First_Aid_CPR",
  "Q_Aerial_Lift", "Q_Confined_Space", "Q_Arc_Flash", "Q_Forklift",
];
const QUAL_LABELS: Record<string, string> = {
  Q_Background_Check: "Background Check",
  Q_OSHA_10:          "OSHA 10",
  Q_OSHA_30:          "OSHA 30",
  Q_First_Aid_CPR:    "First Aid / CPR",
  Q_Aerial_Lift:      "Aerial Lift",
  Q_Confined_Space:   "Confined Space",
  Q_Arc_Flash:        "Arc Flash",
  Q_Forklift:         "Forklift",
};

// ── CSS ────────────────────────────────────────────────────────────────────
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
  select option { background:#161b22; color:#e6edf3; }
  select:focus  { border-color:var(--accent)!important; box-shadow:0 0 0 2px rgba(240,180,41,.15); outline:none; }
`;

const TOOLTIP_STYLE = {
  background: "#161b22",
  border: "1px solid #30363d",
  borderRadius: 2,
  fontFamily: "'Barlow','Segoe UI',sans-serif",
  fontSize: 12,
  color: "#e6edf3",
};

// ── Style helpers ──────────────────────────────────────────────────────────
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
  background: "var(--th-bg)",
});

const tdS = (align = "left"): React.CSSProperties => ({
  padding: "7px 12px",
  textAlign: align as React.CSSProperties["textAlign"],
  borderBottom: "1px solid var(--border-faint)",
  verticalAlign: "middle",
});

// ── Shared components ──────────────────────────────────────────────────────
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

function KPICard({ label, value, sub, highlight }: {
  label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "16px 20px", flex: 1, minWidth: 120 }}>
      <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: highlight ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ConfBadge({ value }: { value: string }) {
  const cfg = CONF_STYLE[value];
  if (!cfg) return <span style={{ color: "var(--muted)", fontFamily: "var(--font-label)", fontSize: 11 }}>—</span>;
  return (
    <span style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 2,
      color: cfg.text, fontFamily: "var(--font-label)", fontWeight: 700,
      fontSize: 10, letterSpacing: "0.07em", padding: "2px 7px", textTransform: "uppercase",
    }}>
      {value === "Medium" ? "MED" : value.toUpperCase().slice(0, 4)}
    </span>
  );
}

// ── Portfolio View ─────────────────────────────────────────────────────────
function PortfolioView({ latestByJob, reports }: { latestByJob: Report[]; reports: Report[] }) {
  const [sortField, setSortField] = useState("job_number");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");

  // KPIs
  const totalW1   = latestByJob.reduce((s, r) => s + (Number(r.payload?.W1_WeekTotal) || 0), 0);
  const totalW2   = latestByJob.reduce((s, r) => s + (Number(r.payload?.W2_WeekTotal) || 0), 0);
  const totalW3   = latestByJob.reduce((s, r) => s + (Number(r.payload?.W3_WeekTotal) || 0), 0);
  const utilPct   = COMPANY_CAPACITY > 0 ? Math.round((totalW1 / COMPANY_CAPACITY) * 100) : 0;

  // Job color map (stable per job_number)
  const jobColorMap = useMemo(() => {
    const m: Record<string, string> = {};
    latestByJob.forEach((r, i) => { m[r.job_number || String(r.id)] = JOB_COLORS[i % JOB_COLORS.length]; });
    return m;
  }, [latestByJob]);

  const jobKeys = latestByJob.map(r => r.job_number || String(r.id));

  // Stacked histogram: one bar per week, each job a segment
  const histData = useMemo(() => {
    return (["W1", "W2", "W3"] as const).map((w, wi) => {
      const labels = ["Week 1", "Week 2", "Week 3"];
      const entry: Record<string, string | number> = { weekLabel: labels[wi] };
      latestByJob.forEach(r => {
        const key = r.job_number || String(r.id);
        entry[key] = Number(r.payload?.[`${w}_WeekTotal`]) || 0;
      });
      return entry;
    });
  }, [latestByJob]);

  // Week-over-week labor shift (W1 → W2)
  const transferRows = useMemo(() =>
    latestByJob
      .map(r => ({
        job:   r.job_number,
        pm:    r.pm_name,
        w1:    Number(r.payload?.W1_WeekTotal) || 0,
        w2:    Number(r.payload?.W2_WeekTotal) || 0,
        delta: (Number(r.payload?.W2_WeekTotal) || 0) - (Number(r.payload?.W1_WeekTotal) || 0),
      }))
      .sort((a, b) => a.delta - b.delta),
    [latestByJob]
  );

  const releasing = transferRows.filter(r => r.delta < 0);
  const stable    = transferRows.filter(r => r.delta === 0);
  const pulling   = transferRows.filter(r => r.delta > 0);

  // Sortable health matrix
  const healthRows = useMemo(() =>
    [...latestByJob].sort((a, b) => {
      let av: string | number, bv: string | number;
      if (["W1_WeekTotal", "W2_WeekTotal", "W3_WeekTotal"].includes(sortField)) {
        av = Number(a.payload?.[sortField]) || 0;
        bv = Number(b.payload?.[sortField]) || 0;
      } else {
        av = (a as Record<string, unknown>)[sortField] as string ?? "";
        bv = (b as Record<string, unknown>)[sortField] as string ?? "";
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ?  1 : -1;
      return 0;
    }),
    [latestByJob, sortField, sortDir]
  );

  const handleSort = (f: string) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  };
  const arrow = (f: string) => sortField === f ? (sortDir === "desc" ? " ↓" : " ↑") : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

      {/* ── KPI Row ── */}
      <section>
        <SectionLabel
          text="Portfolio Snapshot"
          sub={`Based on latest submission per job · ${reports.length} total submission${reports.length !== 1 ? "s" : ""}`}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <KPICard label="Active Jobs"  value={latestByJob.length}  highlight />
          <KPICard label="Week 1 Crew"  value={totalW1}  sub="next week" />
          <KPICard label="Week 2 Crew"  value={totalW2}  sub="following week" />
          <KPICard label="Week 3 Crew"  value={totalW3}  sub="third week" />
          <KPICard
            label="Utilization"
            value={`${utilPct}%`}
            sub={`of ${COMPANY_CAPACITY} capacity`}
            highlight={utilPct > 90}
          />
        </div>
      </section>

      {/* ── Stacked Labor Allocation Histogram ── */}
      {latestByJob.length > 0 && (
        <section>
          <SectionLabel
            text="Labor Allocation by Week"
            sub="Total headcount per week — each color segment is one job · dashed line = company capacity"
          />
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "24px 16px 16px" }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={histData} margin={{ top: 8, right: 56, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fill: "#7d8590", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13 }}
                  axisLine={{ stroke: "#30363d" }} tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#7d8590", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  wrapperStyle={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, paddingTop: 12 }}
                />
                <ReferenceLine
                  y={COMPANY_CAPACITY}
                  stroke="#f0b429"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Cap ${COMPANY_CAPACITY}`,
                    fill: "#f0b429",
                    fontFamily: "'Barlow Condensed',sans-serif",
                    fontSize: 11,
                    position: "right",
                  }}
                />
                {jobKeys.map((key, i) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="a"
                    fill={jobColorMap[key] ?? JOB_COLORS[i % JOB_COLORS.length]}
                    radius={i === jobKeys.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Week-over-Week Labor Shift ── */}
      {latestByJob.length > 0 && (
        <section>
          <SectionLabel
            text="Week-over-Week Labor Shift"
            sub="Headcount change from Week 1 → Week 2 per job"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>

            {/* Releasing */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ background: "#2a1c1c", borderBottom: "1px solid var(--border)", padding: "8px 14px", fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#f85149" }}>
                ↓ Releasing Crew ({releasing.length})
              </div>
              {releasing.length === 0
                ? <div style={{ padding: "14px", fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)" }}>None</div>
                : releasing.map((r, i) => (
                  <div key={r.job} style={{ padding: "8px 14px", borderBottom: i < releasing.length - 1 ? "1px solid var(--border-faint)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{r.job}</div>
                      <div style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)" }}>{r.pm}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#f85149" }}>{r.delta}</div>
                  </div>
                ))
              }
            </div>

            {/* Stable */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ background: "var(--th-bg)", borderBottom: "1px solid var(--border)", padding: "8px 14px", fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)" }}>
                → Stable ({stable.length})
              </div>
              {stable.length === 0
                ? <div style={{ padding: "14px", fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)" }}>None</div>
                : stable.map((r, i) => (
                  <div key={r.job} style={{ padding: "8px 14px", borderBottom: i < stable.length - 1 ? "1px solid var(--border-faint)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{r.job}</div>
                      <div style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)" }}>{r.pm}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>±0</div>
                  </div>
                ))
              }
            </div>

            {/* Pulling */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ background: "#1c2a1c", borderBottom: "1px solid var(--border)", padding: "8px 14px", fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#3fb950" }}>
                ↑ Pulling Crew ({pulling.length})
              </div>
              {pulling.length === 0
                ? <div style={{ padding: "14px", fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)" }}>None</div>
                : pulling.map((r, i) => (
                  <div key={r.job} style={{ padding: "8px 14px", borderBottom: i < pulling.length - 1 ? "1px solid var(--border-faint)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{r.job}</div>
                      <div style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)" }}>{r.pm}</div>
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "#3fb950" }}>+{r.delta}</div>
                  </div>
                ))
              }
            </div>

          </div>
        </section>
      )}

      {/* ── Portfolio Health Matrix ── */}
      <section>
        <SectionLabel
          text="Portfolio Health Matrix"
          sub="One row per active job — latest submission · left border = Week 1 confidence · click headers to sort"
        />
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={thS()}         onClick={() => handleSort("job_number")}>Job #{arrow("job_number")}</th>
                <th style={thS()}         onClick={() => handleSort("pm_name")}>PM{arrow("pm_name")}</th>
                <th style={thS("center")} onClick={() => handleSort("W1_WeekTotal")}>Wk 1{arrow("W1_WeekTotal")}</th>
                <th style={thS("center")}>Conf</th>
                <th style={thS("center")} onClick={() => handleSort("W2_WeekTotal")}>Wk 2{arrow("W2_WeekTotal")}</th>
                <th style={thS("center")}>Conf</th>
                <th style={thS("center")} onClick={() => handleSort("W3_WeekTotal")}>Wk 3{arrow("W3_WeekTotal")}</th>
                <th style={thS("center")}>Conf</th>
                <th style={thS("center")}>Wk 4+</th>
                <th style={thS()}         onClick={() => handleSort("job_end_date")}>End Date{arrow("job_end_date")}</th>
              </tr>
            </thead>
            <tbody>
              {healthRows.map((r, i) => {
                const w1Conf = String(r.payload?.W1_Confidence || "");
                const confBorderColor = CONF_STYLE[w1Conf]?.border ?? "var(--border)";
                return (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "var(--row-even)" : "var(--row-odd)" }}>
                    <td style={{ ...tdS(), borderLeft: `3px solid ${confBorderColor}`, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>{r.job_number}</td>
                    <td style={{ ...tdS(), fontFamily: "var(--font-label)", fontSize: 12, color: "var(--label)" }}>{r.pm_name}</td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{Number(r.payload?.W1_WeekTotal) || "–"}</td>
                    <td style={{ ...tdS("center") }}><ConfBadge value={w1Conf} /></td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{Number(r.payload?.W2_WeekTotal) || "–"}</td>
                    <td style={{ ...tdS("center") }}><ConfBadge value={String(r.payload?.W2_Confidence || "")} /></td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>{Number(r.payload?.W3_WeekTotal) || "–"}</td>
                    <td style={{ ...tdS("center") }}><ConfBadge value={String(r.payload?.W3_Confidence || "")} /></td>
                    <td style={{ ...tdS("center"), fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>{Number(r.payload?.Weeks_4_Plus_Total_Crew) || "–"}</td>
                    <td style={{ ...tdS(), fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                      {r.job_end_date
                        ? new Date(r.job_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "–"}
                    </td>
                  </tr>
                );
              })}
              {healthRows.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ ...tdS("center"), color: "var(--muted)", fontFamily: "var(--font-label)", fontSize: 13, padding: "40px 0" }}>
                    No active jobs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}

// ── Project View ───────────────────────────────────────────────────────────
function ProjectView({ latestByJob, reports }: { latestByJob: Report[]; reports: Report[] }) {
  const [selectedJob, setSelectedJob] = useState<string>("");

  // Default to first job once data loads
  useEffect(() => {
    if (!selectedJob && latestByJob.length > 0) {
      setSelectedJob(latestByJob[0].job_number || String(latestByJob[0].id));
    }
  }, [latestByJob, selectedJob]);

  const job = useMemo(
    () => latestByJob.find(r => (r.job_number || String(r.id)) === selectedJob),
    [latestByJob, selectedJob]
  );

  const jobHistory = useMemo(
    () => reports
      .filter(r => r.job_number === selectedJob)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [reports, selectedJob]
  );

  if (latestByJob.length === 0) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", fontFamily: "var(--font-label)", fontSize: 14, color: "var(--muted)", letterSpacing: "0.06em" }}>
        No job submissions found.
      </div>
    );
  }

  const chartData = job ? [
    { week: "Week 1", Foremen: Number(job.payload?.W1_FO_Total) || 0, Journeymen: Number(job.payload?.W1_JO_Total) || 0, Apprentices: Number(job.payload?.W1_AP_Total) || 0 },
    { week: "Week 2", Foremen: Number(job.payload?.W2_FO_Total) || 0, Journeymen: Number(job.payload?.W2_JO_Total) || 0, Apprentices: Number(job.payload?.W2_AP_Total) || 0 },
    { week: "Week 3", Foremen: Number(job.payload?.W3_FO_Total) || 0, Journeymen: Number(job.payload?.W3_JO_Total) || 0, Apprentices: Number(job.payload?.W3_AP_Total) || 0 },
  ] : [];

  const activeQuals = job ? QUAL_KEYS.filter(k => Number(job.payload?.[k]) === 1) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* ── Job Selector ── */}
      <section>
        <SectionLabel text="Project View" sub="Select a job to drill down into field execution detail" />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 220, maxWidth: 380 }}>
            <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>
              Select Job
            </div>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              style={{
                width: "100%",
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                color: "var(--text)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                padding: "9px 32px 9px 12px",
                cursor: "pointer",
                appearance: "none" as React.CSSProperties["appearance"],
                backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%237d8590' d='M5 7L0 2h10z'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
            >
              {latestByJob.map(r => (
                <option key={r.id} value={r.job_number || String(r.id)}>
                  {r.job_number} — {r.pm_name}
                </option>
              ))}
            </select>
          </div>
          {job && (
            <div style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em", paddingBottom: 10 }}>
              Last submitted {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {jobHistory.length > 1 && ` · ${jobHistory.length} total submissions`}
            </div>
          )}
        </div>
      </section>

      {job && (
        <>
          {/* ── Job Summary Bar ── */}
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderLeft: `4px solid ${CONF_STYLE[String(job.payload?.W1_Confidence || "")]?.border ?? "var(--accent)"}`,
            borderRadius: 2,
            padding: "16px 24px",
            display: "flex",
            flexWrap: "wrap",
            gap: "16px 32px",
            alignItems: "center",
          }}>
            <div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>Job Number</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.04em" }}>{job.job_number}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>Project Manager</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text)" }}>{job.pm_name}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>Job End Date</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text)" }}>
                {job.job_end_date
                  ? new Date(job.job_end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 3 }}>Wk 1 Total</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{Number(job.payload?.W1_WeekTotal) || "—"}</div>
            </div>
            <div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 6 }}>Wk 1 Confidence</div>
              <ConfBadge value={String(job.payload?.W1_Confidence || "")} />
            </div>
          </div>

          {/* ── Required Qualifications ── */}
          {activeQuals.length > 0 && (
            <section>
              <SectionLabel text="Required Qualifications" sub="Certifications required for workers on this job" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {activeQuals.map(k => (
                  <span key={k} style={{
                    background: "rgba(240,180,41,0.1)",
                    border: "1px solid rgba(240,180,41,0.3)",
                    borderRadius: 2,
                    color: "var(--accent)",
                    fontFamily: "var(--font-label)",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    padding: "5px 12px",
                  }}>
                    {QUAL_LABELS[k] ?? k}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* ── Weekly Crew Breakdown Chart ── */}
          <section>
            <SectionLabel text="Weekly Crew Breakdown" sub="Foremen / Journeymen / Apprentices — grouped by week" />
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "24px 16px 16px" }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "#7d8590", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13 }}
                    axisLine={{ stroke: "#30363d" }} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#7d8590", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Legend wrapperStyle={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="Foremen"     fill="#f0b429" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Journeymen"  fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Apprentices" fill="#10b981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* ── Week Detail Cards ── */}
          <section>
            <SectionLabel text="Week Detail" sub="Crew totals, confidence level, and scheduling notes per week" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 16 }}>
              {([1, 2, 3] as const).map(wn => {
                const w      = `W${wn}`;
                const dates  = String(job.payload?.[`${w}_Dates`]      || "");
                const conf   = String(job.payload?.[`${w}_Confidence`] || "");
                const notes  = String(job.payload?.[`${w}_Notes`]      || "");
                const fo     = Number(job.payload?.[`${w}_FO_Total`])  || 0;
                const jo     = Number(job.payload?.[`${w}_JO_Total`])  || 0;
                const ap     = Number(job.payload?.[`${w}_AP_Total`])  || 0;
                const total  = fo + jo + ap;

                return (
                  <div key={wn} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, overflow: "hidden" }}>
                    {/* Card header */}
                    <div style={{ background: "var(--th-bg)", borderBottom: "1px solid var(--border)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontFamily: "var(--font-label)", fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text)" }}>Week {wn}</div>
                        {dates && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", marginTop: 3 }}>{dates}</div>}
                      </div>
                      <ConfBadge value={conf} />
                    </div>

                    {/* Crew totals */}
                    <div style={{ padding: "14px 16px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <tbody>
                          {[
                            { role: "Foremen",     color: "#f0b429", val: fo },
                            { role: "Journeymen",  color: "#3b82f6", val: jo },
                            { role: "Apprentices", color: "#10b981", val: ap },
                          ].map(row => (
                            <tr key={row.role}>
                              <td style={{ padding: "4px 0", fontFamily: "var(--font-label)", fontSize: 12, color: "var(--label)" }}>
                                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: row.color, marginRight: 7, verticalAlign: "middle" }} />
                                {row.role}
                              </td>
                              <td style={{ padding: "4px 0", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                                {row.val}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: "1px solid var(--border-faint)" }}>
                            <td style={{ padding: "6px 0 2px", fontFamily: "var(--font-label)", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</td>
                            <td style={{ padding: "6px 0 2px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 800, color: "var(--accent)" }}>{total}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Notes */}
                    <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-faint)", minHeight: 40 }}>
                      {notes
                        ? <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--label)", lineHeight: 1.55, margin: 0 }}>{notes}</p>
                        : <p style={{ fontFamily: "var(--font-label)", fontSize: 11, color: "#3d444d", margin: 0, letterSpacing: "0.03em" }}>No notes for this week</p>
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Weeks 4+ ── */}
          {Number(job.payload?.Weeks_4_Plus_Count) > 0 && (
            <section>
              <SectionLabel
                text="Weeks 4+ Summary"
                sub={`${Number(job.payload?.Weeks_4_Plus_Count)} remaining week${Number(job.payload?.Weeks_4_Plus_Count) !== 1 ? "s" : ""} beyond the 3-week detail window`}
              />
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 2, padding: "16px 20px" }}>
                <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>Total Crew (Wk 4+)</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{Number(job.payload?.Weeks_4_Plus_Total_Crew)}</div>
                  </div>
                </div>
                {job.payload?.Weeks_4_Plus_Summary && String(job.payload.Weeks_4_Plus_Summary) !== "N/A" && (
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", lineHeight: 1.8, wordBreak: "break-word" }}>
                    {String(job.payload.Weeks_4_Plus_Summary).split(" | ").map((seg, i) => (
                      <span key={i} style={{ display: "inline-block", marginRight: 12 }}>{seg}</span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

        </>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function Dashboard() {
  const [reports,   setReports]   = useState<Report[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"portfolio" | "project">("portfolio");

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

  // Most recent submission per job — skip null payloads
  const latestByJob = useMemo(() => {
    const map: Record<string, Report> = {};
    for (const r of reports) {
      if (!r.payload) continue;
      const key  = r.job_number || String(r.id);
      const ts   = String(r.payload.Submission_Timestamp || r.created_at);
      const ex   = map[key];
      const exTs = ex ? String(ex.payload?.Submission_Timestamp || ex.created_at) : "";
      if (!ex || ts > exTs) map[key] = r;
    }
    return Object.values(map).sort((a, b) => (a.job_number || "").localeCompare(b.job_number || ""));
  }, [reports]);

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
      <button onClick={fetchData} style={{ background: "#f0b429", border: "none", borderRadius: 2, padding: "8px 16px", cursor: "pointer", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, color: "#0d1117" }}>
        Retry
      </button>
    </div>
  );

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", color: "var(--text)" }}>
      <style>{CSS}</style>

      {/* ── Sticky Header ── */}
      <div style={{
        background: "linear-gradient(135deg,#0d1117 0%,#161b22 100%)",
        borderBottom: "3px solid var(--accent)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 32px 0" }}>

          {/* Title row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>Electrical Contractor</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em", lineHeight: 1 }}>CREW ANALYSIS</div>
              <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: "0.06em" }}>Manpower Forecast Dashboard — Aggregated from PM Submissions</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", paddingTop: 4 }}>
              <button
                onClick={fetchData}
                style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 2, color: "var(--muted)", cursor: "pointer", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", padding: "8px 16px" }}
              >
                ↻ Refresh
              </button>
              <a
                href="#/"
                style={{ background: "var(--accent)", color: "#0d1117", borderRadius: 2, padding: "8px 16px", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textDecoration: "none" }}
              >
                ← Submit Form
              </a>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 2 }}>
            {(["portfolio", "project"] as const).map(tab => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: active ? "var(--accent)" : "transparent",
                    border: "none",
                    borderRadius: "2px 2px 0 0",
                    color: active ? "#0d1117" : "var(--muted)",
                    cursor: "pointer",
                    fontFamily: "var(--font-label)",
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "9px 22px",
                    transition: "all 0.15s",
                  }}
                >
                  {tab === "portfolio" ? "Portfolio View" : "Project View"}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* ── Page content ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 60px" }}>
        {activeTab === "portfolio"
          ? <PortfolioView latestByJob={latestByJob} reports={reports} />
          : <ProjectView   latestByJob={latestByJob} reports={reports} />
        }
      </div>
    </div>
  );
}
