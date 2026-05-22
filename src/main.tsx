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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
