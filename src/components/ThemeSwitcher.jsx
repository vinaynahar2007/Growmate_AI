import { Moon, Palette, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ACCENTS, useTheme } from "../hooks/useTheme.js";

/**
 * Compact theme control: light/dark toggle + accent palette popover.
 * Persists to localStorage via useTheme.
 */
export default function ThemeSwitcher({ compact = false }) {
  const { theme, accent, toggleTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={toggleTheme}
        className="btn btn-ghost btn-sm"
        style={{ padding: 8, borderRadius: 10 }}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label="Toggle theme"
      >
        <span className="relative w-4 h-4 grid place-items-center">
          <Sun size={15} className="absolute transition-all" style={{ opacity: theme === "dark" ? 1 : 0, transform: theme === "dark" ? "rotate(0)" : "rotate(90deg) scale(0.5)" }} />
          <Moon size={15} className="absolute transition-all" style={{ opacity: theme === "light" ? 1 : 0, transform: theme === "light" ? "rotate(0)" : "rotate(-90deg) scale(0.5)" }} />
        </span>
      </button>
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn btn-ghost btn-sm" style={{ padding: compact ? 8 : "8px 10px", borderRadius: 10 }} title="Accent colour" aria-label="Accent colour">
        <Palette size={15} />
        {!compact && <span className="w-3 h-3 rounded-full" style={{ background: "var(--grad)" }} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 card glow p-3 z-50 fade-up" style={{marginTop: 200, minWidth: 200, background: "var(--card-2)" }}>
          <div className="text-[11px] text-[var(--muted)] font-semibold mb-2 px-1">Accent colour</div>
          <div className="space-y-1">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAccent(a.key)}
                className={`nav-item ${accent === a.key ? "active" : ""}`}
                style={{ padding: "8px 10px", fontSize: 13 }}
              >
                <span className="swatch" style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]})`, width: 18, height: 18 }} />
                {a.label}
                {accent === a.key && <span className="ml-auto text-[10px] text-[var(--accent-text)]">Active</span>}
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 flex items-center justify-between text-[11px] text-[var(--muted)]" style={{ borderTop: "1px solid var(--border)" }}>
            <span>Mode</span>
            <button type="button" onClick={toggleTheme} className="badge badge-purple" style={{ cursor: "pointer" }}>
              {theme === "dark" ? <><Moon size={11} /> Dark</> : <><Sun size={11} /> Light</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
