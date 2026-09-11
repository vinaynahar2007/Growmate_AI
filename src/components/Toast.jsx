import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const Ctx = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message, { type = "success", title, duration = 3800 } = {}) => {
      const id = ++idRef.current;
      setItems((list) => [...list.slice(-3), { id, message, type, title }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  const icon = { success: CheckCircle2, error: AlertTriangle, info: Info };
  const tone = { success: "var(--green)", error: "var(--red)", info: "var(--accent-text)" };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-40px))]">
        {items.map((t) => {
          const Icon = icon[t.type] || Info;
          return (
            <div key={t.id} className="toast card glow p-3.5 flex items-start gap-3" style={{ background: "var(--card-2)" }}>
              <Icon size={17} style={{ color: tone[t.type], marginTop: 1 }} />
              <div className="flex-1 min-w-0 text-sm">
                {t.title && <div className="font-semibold">{t.title}</div>}
                <div className="text-[var(--muted)] text-[13px] leading-snug">{t.message}</div>
              </div>
              <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
