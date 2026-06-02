import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Dashboard from "./Dashboard.tsx";
import LoginScreen from "./LoginScreen.tsx";

function AppRouter() {
  const [authed, setAuthed] = useState(() =>
    sessionStorage.getItem("cf_authed") === "true"
  );
  const [page, setPage] = useState(() =>
    window.location.hash === "#/dashboard" ? "dashboard" : "form"
  );

  useEffect(() => {
    const onHash = () =>
      setPage(window.location.hash === "#/dashboard" ? "dashboard" : "form");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (!authed) {
    return (
      <LoginScreen
        onSuccess={() => {
          sessionStorage.setItem("cf_authed", "true");
          setAuthed(true);
        }}
      />
    );
  }

  return page === "dashboard" ? <Dashboard /> : <App />;
}

// Cache the root on the element so Vite HMR re-executions reuse it
// instead of calling createRoot twice (which causes a React warning + DOM errors).
const rootEl = document.getElementById("root")!;
const root = (rootEl as any).__reactRoot ?? createRoot(rootEl);
(rootEl as any).__reactRoot = root;

root.render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
