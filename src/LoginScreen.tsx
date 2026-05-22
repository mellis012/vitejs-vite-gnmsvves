import { useState } from "react";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Barlow+Condensed:wght@400;600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;700&display=swap');
  :root {
    --bg:#0d1117;--card:#161b22;--border:#30363d;
    --text:#e6edf3;--muted:#7d8590;--accent:#f0b429;--input-bg:#0d1117;
    --font-display:'Oswald','Impact',sans-serif;
    --font-label:'Barlow Condensed','Arial Narrow',sans-serif;
    --font-body:'Barlow','Segoe UI',sans-serif;
    --font-mono:'JetBrains Mono','Courier New',monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 2px rgba(240,180,41,.15); outline: none; }
`;

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(false);
  const [shaking, setShaking]   = useState(false);

  const handleSubmit = () => {
    const correct = import.meta.env.VITE_APP_PASSWORD;
    if (password === correct) {
      onSuccess();
    } else {
      setError(true);
      setShaking(true);
      setPassword("");
      setTimeout(() => setShaking(false), 500);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .shake { animation: shake 0.4s ease; }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#0d1117 0%,#161b22 100%)", borderBottom: "3px solid var(--accent)", padding: "28px 32px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.2em", color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>Electrical Contractor</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "0.04em", lineHeight: 1 }}>CREW FORECAST</div>
          <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", marginTop: 4, letterSpacing: "0.06em" }}>Weekly Manpower Projection — Submitted by Project Manager</div>
        </div>
      </div>

      {/* Login card */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div
          className={shaking ? "shake" : ""}
          style={{ background: "var(--card)", border: `1px solid ${error ? "#f85149" : "var(--border)"}`, borderRadius: 2, padding: "36px 40px", width: "100%", maxWidth: 380, transition: "border-color 0.2s" }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "0.06em", marginBottom: 6 }}>
            RESTRICTED ACCESS
          </div>
          <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "var(--muted)", letterSpacing: "0.04em", marginBottom: 28 }}>
            Enter your password to continue
          </div>

          <label style={{ display: "block", fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false); }}
            onKeyDown={handleKey}
            autoFocus
            placeholder="••••••••"
            style={{ width: "100%", background: "var(--input-bg)", border: `1px solid ${error ? "#f85149" : "var(--border)"}`, borderRadius: 2, color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 15, padding: "10px 12px", marginBottom: 8, transition: "border-color 0.2s" }}
          />

          {error && (
            <div style={{ fontFamily: "var(--font-label)", fontSize: 12, color: "#ff7b72", letterSpacing: "0.04em", marginBottom: 16 }}>
              Incorrect password. Please try again.
            </div>
          )}
          {!error && <div style={{ marginBottom: 16 }} />}

          <button
            onClick={handleSubmit}
            style={{ width: "100%", background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 2, padding: "11px 0", fontFamily: "var(--font-label)", fontWeight: 700, fontSize: 14, letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase" }}
          >
            Enter →
          </button>
        </div>
      </div>
    </div>
  );
}
