import { AlertCircle, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { useCountUp, useSpotlight } from "../hooks/useInteractive.js";

export function Card({ className = "", children, hover = false, spotlight = false, tilt = false, ...rest }) {
  const sp = useSpotlight({ tilt });
  const extra = spotlight || tilt ? sp : {};
  const { className: spClass = "", ...spRest } = extra;
  return (
    <div className={`card ${hover ? "card-hover" : ""} ${spClass} ${className}`} {...spRest} {...rest}>
      {children}
    </div>
  );
}

/** Extracts a numeric value from strings like "₹2,450" or "4 products" and animates it. */
function AnimatedValue({ value }) {
  const str = String(value ?? "");
  const m = str.match(/-?[\d,]+(\.\d+)?/);
  const num = m ? Number(m[0].replace(/,/g, "")) : null;
  const [display, ref] = useCountUp(num ?? 0);
  if (num === null || Number.isNaN(num)) return <span>{str}</span>;
  const decimals = m[1] ? m[1].length - 1 : 0;
  const formatted = display.toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
  return (
    <span ref={ref} className="tabular">
      {str.slice(0, m.index)}
      {formatted}
      {str.slice(m.index + m[0].length)}
    </span>
  );
}

export function StatCard({ label, value, hint, tone = "purple", icon: Icon }) {
  const toneColor = { purple: "var(--accent-text)", green: "var(--green)", amber: "var(--amber)", red: "var(--red)", blue: "var(--blue)" }[tone];
  return (
    <Card className="p-5 card-hover" spotlight>
      <div className="flex items-start justify-between">
        <span className="text-xs text-[var(--muted)]">{label}</span>
        {Icon && (
          <span className="w-8 h-8 rounded-lg grid place-items-center icon-tile" style={{ width: 32, height: 32, color: toneColor }}>
            <Icon size={15} />
          </span>
        )}
      </div>
      <div className="mt-2 text-[26px] font-bold tracking-tight font-display">
        <AnimatedValue value={value} />
      </div>
      {hint && (
        <div className="mt-1.5 text-[11px] font-medium" style={{ color: toneColor }}>
          {hint}
        </div>
      )}
      <div className="absolute -right-10 -bottom-10 w-28 h-28 rounded-full blur-2xl opacity-20 pointer-events-none" style={{ background: toneColor }} />
    </Card>
  );
}

export function Badge({ tone = "gray", children, className = "" }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>;
}

export function StockBadge({ status }) {
  const map = { good: ["green", "Good stock"], low: ["amber", "Low stock"], out: ["red", "Out of stock"] };
  const [tone, label] = map[status] || ["gray", status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function TxnBadge({ type }) {
  const map = { credit: ["amber", "Udhaar"], cash: ["green", "Cash sale"], payment: ["blue", "Payment"] };
  const [tone, label] = map[type] || ["gray", type];
  return <Badge tone={tone}>{label}</Badge>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--muted)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center flex-wrap">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--muted)] py-10 justify-center">
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-3 text-sm rounded-xl px-4 py-3" style={{ background: "color-mix(in srgb, var(--red) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)", color: "var(--red)" }}>
      <AlertCircle size={16} />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ title, hint }) {
  return (
    <div className="text-center py-12">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="text-xs text-[var(--muted)] mt-1">{hint}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 480 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in srgb, var(--bg) 75%, transparent)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div className="card glow p-6 w-full fade-up" style={{ maxWidth: width, background: "var(--card-2)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">{title}</h3>
          <button className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)] font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="text-[11px] text-[var(--muted-2)] mt-1 block">{hint}</span>}
    </label>
  );
}

export function Avatar({ name = "", size = 36 }) {
  const ini = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return (
    <div className="rounded-full grid place-items-center font-bold text-white shrink-0" style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--grad)" }}>
      {ini || "?"}
    </div>
  );
}

/** Tiny SVG bar/line chart with hover tooltip. data: [{label, value}] */
export function TrendChart({ data = [], height = 120, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <div className="w-full">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * (height - 10));
          return (
            <g key={i} className="group">
              <rect x={i * w + w * 0.2} y={height - h} width={w * 0.6} height={h} rx="1.5" fill="url(#barGrad)" style={{ transition: "height .6s ease, y .6s ease", opacity: d.today ? 1 : 0.7 }}>
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--muted-2)] mt-1.5">
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center" style={{ color: d.today ? "var(--accent-text)" : undefined, fontWeight: d.today ? 700 : 500 }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
