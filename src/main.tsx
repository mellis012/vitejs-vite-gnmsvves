import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import Dashboard from "./Dashboard.tsx";

function AppRouter() {
  const [page, setPage] = useState(() =>
    window.location.hash === "#/dashboard" ? "dashboard" : "form"
  );

  useEffect(() => {
    const onHash = () =>
      setPage(window.location.hash === "#/dashboard" ? "dashboard" : "form");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return page === "dashboard" ? <Dashboard /> : <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>
);
