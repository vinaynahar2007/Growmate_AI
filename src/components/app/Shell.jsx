import { ArrowLeft, BarChart3, BookOpen, Bot, Command, LayoutDashboard, Menu, Package, ShoppingCart, Sparkles, Users, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, API_URL, subscribeStatus } from "../../lib/api.js";
import ThemeSwitcher from "../ThemeSwitcher.jsx";
import { ToastProvider, useToast } from "../Toast.jsx";
import Analytics from "./Analytics.jsx";
import { CopilotProvider } from "./CopilotContext.jsx";
import Copilot from "./Copilot.jsx";
import Customers from "./Customers.jsx";
import Dashboard from "./Dashboard.jsx";
import Inventory from "./Inventory.jsx";
import Khata from "./Khata.jsx";
import Sales from "./Sales.jsx";

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard, "1"],
  ["customers", "Customers", Users, "2"],
  ["khata", "Khata", BookOpen, "3"],
  ["inventory", "Inventory", Package, "4"],
  ["sales", "Sales", ShoppingCart, "5"],
  ["analytics", "Analytics", BarChart3, "6"],
  ["copilot", "AI Copilot", Bot, "7"],
];

export default function Shell(props) {
  return (
    <ToastProvider>
      <ShellInner {...props} />
    </ToastProvider>
  );
}

function ShellInner({ onExit }) {
  const [page, setPage] = useState("dashboard");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState({ backend: "checking", aiMode: "demo" });
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();
  const prevBackend = useRef(null);

  useEffect(() => subscribeStatus(setStatus), []);
  useEffect(() => {
    api.health();
    const t = setInterval(() => api.health(), 30000);
    return () => clearInterval(t);
  }, []);

  // connection toasts
  useEffect(() => {
    if (status.backend === "checking") return;
    if (prevBackend.current && prevBackend.current !== status.backend) {
      if (status.backend === "online") toast(`Connected to FastAPI · ${status.aiMode === "openai" ? "OpenAI agent" : "Demo AI mode"}`, { type: "success", title: "Backend online" });
      else toast("Using in-browser demo data until the backend is reachable.", { type: "info", title: "Backend offline" });
    }
    prevBackend.current = status.backend;
  }, [status.backend, status.aiMode, toast]);

  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);
  const onAiChange = useCallback(
    (tool) => {
      bump();
      toast(tool === "create_or_update_customer_khata" ? "Customer khata updated by the AI." : "Transaction recorded — balances and stock updated.", { type: "success", title: "Shop data changed" });
    },
    [bump, toast]
  );

  const navigate = useCallback((p) => { setPage(p); setMenuOpen(false); window.scrollTo({ top: 0 }); }, []);
  const openKhata = (id) => { setSelectedCustomer(id); navigate("khata"); };

  // keyboard shortcuts: Ctrl/Cmd+K focuses copilot; Alt+1..7 switches pages
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        navigate("copilot");
        setTimeout(() => document.querySelector("[data-copilot-input]")?.focus(), 50);
      }
      if (e.altKey && /^[1-7]$/.test(e.key)) {
        e.preventDefault();
        navigate(NAV[Number(e.key) - 1][0]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const owner = status.shop?.owner || "Rajesh";

  return (
    <CopilotProvider onDataChanged={onAiChange}>
      <div className="min-h-screen flex">
        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-0 h-screen w-[250px] shrink-0 flex flex-col p-4 z-40 transition-transform ${menuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`} style={{ background: "var(--card)", borderRight: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-6 px-1">
            <button onClick={onExit} className="flex items-center gap-2.5 text-left" title="Back to landing page">
              <span className="icon-tile icon-tile-solid" style={{ width: 34, height: 34, borderRadius: 10 }}><Sparkles size={16} /></span>
              <span className="font-bold text-[15px] font-display">GrowMate AI</span>
            </button>
            <button className="lg:hidden text-[var(--muted)]" onClick={() => setMenuOpen(false)}><X size={18} /></button>
          </div>

          <nav className="space-y-1 flex-1">
            {NAV.map(([key, label, Icon, k]) => (
              <button key={key} className={`nav-item ${page === key ? "active" : ""}`} onClick={() => navigate(key)} title={`Alt+${k}`}>
                <Icon size={17} /> {label}
                <span className="ml-auto text-[10px] text-[var(--muted-2)] opacity-0 group-hover:opacity-100">{k}</span>
              </button>
            ))}
          </nav>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-[var(--muted)] font-medium">Appearance</span>
              <ThemeSwitcher />
            </div>
            <div className="card-2 p-3 flex items-center gap-3">
              <span className="icon-tile" style={{ width: 34, height: 34 }}><Bot size={15} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">AI Copilot</div>
                <div className="text-[11px] text-[var(--muted)] truncate">{status.aiMode === "openai" ? `OpenAI · ${status.model || "agent"}` : "Demo AI mode"}</div>
              </div>
              <span className={status.backend === "online" ? "dot-pulse" : "w-2 h-2 rounded-full"} style={status.backend !== "online" ? { background: status.backend === "offline" ? "var(--amber)" : "var(--muted-2)" } : undefined} />
            </div>
            <div className="text-[10.5px] text-[var(--muted-2)] px-1 leading-relaxed">
              {status.backend === "online" && <>Connected to FastAPI · {status.repository}</>}
              {status.backend === "offline" && <>Backend offline · using browser demo data</>}
              {status.backend === "checking" && <>Connecting to {API_URL}…</>}
            </div>
            <button onClick={onExit} className="nav-item" style={{ fontSize: 13 }}><ArrowLeft size={15} /> Back to website</button>
          </div>
        </aside>
        {menuOpen && <div className="fixed inset-0 z-30 lg:hidden" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setMenuOpen(false)} />}

        {/* Main */}
        <main className="flex-1 min-w-0">
          <div className="lg:hidden flex items-center justify-between px-4 py-3 sticky top-0 z-20" style={{ background: "var(--glass)", backdropFilter: "blur(10px)", borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => setMenuOpen(true)} className="btn btn-ghost btn-sm"><Menu size={16} /></button>
            <span className="font-bold font-display">GrowMate AI</span>
            <div className="flex items-center gap-2">
              <ThemeSwitcher compact />
              <span className={`badge ${status.aiMode === "openai" ? "badge-purple" : "badge-amber"}`}>{status.aiMode === "openai" ? "OpenAI" : "Demo"}</span>
            </div>
          </div>

          {status.backend === "offline" && (
            <div className="mx-4 lg:mx-8 mt-4 flex items-center gap-3 text-xs rounded-xl px-4 py-2.5" style={{ background: "color-mix(in srgb, var(--amber) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)", color: "var(--amber)" }}>
              <WifiOff size={14} />
              <span className="flex-1">Python backend not reachable at <code>{API_URL}</code>. Running on in-browser demo data. Start it with <code>uvicorn main:app --reload --port 8000</code>.</span>
              <button className="btn btn-ghost btn-sm" onClick={() => api.health()}>Retry</button>
            </div>
          )}

          <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
            {page === "dashboard" && <Dashboard refreshKey={refreshKey} onNavigate={navigate} owner={owner} />}
            {page === "customers" && <Customers refreshKey={refreshKey} onOpenKhata={openKhata} onDataChanged={() => { bump(); toast("Customer added.", { title: "Saved" }); }} />}
            {page === "khata" && <Khata refreshKey={refreshKey} selectedId={selectedCustomer} onSelect={setSelectedCustomer} onDataChanged={() => { bump(); toast("Khata updated.", { title: "Saved" }); }} />}
            {page === "inventory" && <Inventory refreshKey={refreshKey} />}
            {page === "sales" && <Sales refreshKey={refreshKey} onDataChanged={() => { bump(); toast("Sale recorded — stock updated.", { title: "Saved" }); }} />}
            {page === "analytics" && <Analytics refreshKey={refreshKey} onOpenKhata={openKhata} />}
            {page === "copilot" && <Copilot aiMode={status.aiMode} />}
          </div>

          <button
            onClick={() => navigate("copilot")}
            className="fixed bottom-5 left-5 lg:hidden btn btn-primary"
            style={{ borderRadius: 999, padding: 12 }}
            aria-label="Open AI Copilot"
          >
            <Command size={16} />
          </button>
        </main>
      </div>
    </CopilotProvider>
  );
}
