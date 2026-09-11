import { useEffect, useState } from "react";
import Landing from "./components/landing/Landing.jsx";
import Shell from "./components/app/Shell.jsx";
import { useTheme } from "./hooks/useTheme.js";

export default function App() {
  useTheme(); // applies data-theme / data-accent to <html> and keeps it in sync
  const [view, setView] = useState(() => (window.location.hash === "#app" ? "app" : "landing"));

  useEffect(() => {
    const onHash = () => setView(window.location.hash === "#app" ? "app" : "landing");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openApp = () => {
    window.location.hash = "app";
    window.scrollTo({ top: 0 });
    setView("app");
  };
  const exitApp = () => {
    history.replaceState(null, "", window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
    setView("landing");
  };

  return view === "app" ? <Shell onExit={exitApp} /> : <Landing onStart={openApp} />;
}
