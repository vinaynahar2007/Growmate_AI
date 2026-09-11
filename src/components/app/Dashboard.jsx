import { AlertTriangle, IndianRupee, Package, TrendingUp, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { fmtDateTime, greeting, inr } from "../../lib/format.js";
import { Card, ErrorNote, Spinner, TxnBadge, Avatar, StatCard, TrendChart } from "../ui.jsx";
import CopilotInput from "./CopilotInput.jsx";
import ResponseCard, { UserBubble } from "./ResponseCard.jsx";
import { useCopilot } from "./CopilotContext.jsx";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard({ refreshKey, onNavigate, owner = "Rajesh" }) {
  const [data, setData] = useState(null);
  const [txns, setTxns] = useState([]);
  const [error, setError] = useState(null);
  const { messages } = useCopilot();

  const load = () => {
    setError(null);
    api.dashboard().then(setData).catch((e) => setError(e.message));
    api.transactions(200).then(setTxns).catch(() => {});
  };
  useEffect(load, [refreshKey]);

  const trend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const value = txns
        .filter((t) => ["credit", "cash"].includes(t.transaction_type))
        .filter((t) => { const td = new Date(t.date); return td >= d && td < next; })
        .reduce((s, t) => s + t.amount, 0);
      days.push({ label: i === 0 ? "Today" : DAY[d.getDay()], value, today: i === 0 });
    }
    return days;
  }, [txns]);
  const weekTotal = trend.reduce((s, d) => s + d.value, 0);

  const last = [...messages].slice(-2);

  return (
    <div className="fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="eyebrow mb-1.5">GrowMate AI</div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">
            {greeting()}, {owner} 👋
          </h1>
        </div>
        <Avatar name={owner} size={42} />
      </div>

      {error && <div className="mb-4"><ErrorNote message={error} onRetry={load} /></div>}

      {!data ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Clickable onClick={() => onNavigate("sales")}><StatCard label="Today's Sales" value={inr(data.today_sales)} hint={`${data.today_transaction_count} transactions · avg ${inr(data.today_average_sale)}`} tone="green" icon={IndianRupee} /></Clickable>
          <Clickable onClick={() => onNavigate("khata")}><StatCard label="Outstanding Khata" value={inr(data.outstanding_total)} hint={`${data.customers_with_dues} customers with dues`} tone="amber" icon={Wallet} /></Clickable>
          <Clickable onClick={() => onNavigate("customers")}><StatCard label="Customers" value={String(data.customer_count)} hint="Active khata accounts" tone="purple" icon={Users} /></Clickable>
          <Clickable onClick={() => onNavigate("inventory")}><StatCard label="Low Stock" value={`${data.low_stock_count + data.out_of_stock_count} products`} hint={`${data.out_of_stock_count} out of stock · needs attention`} tone="red" icon={AlertTriangle} /></Clickable>
        </div>
      )}

      <div className="mt-6">
        <CopilotInput compact />
      </div>

      {last.length > 0 && (
        <div className="mt-5 space-y-4">
          {last.map((m) => (m.role === "user" ? <UserBubble key={m.id} content={m.content} /> : <ResponseCard key={m.id} message={m} />))}
          {messages.length > 2 && (
            <button className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onNavigate("copilot")}>
              View full conversation →
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">
        <Card className="lg:col-span-3 p-5" spotlight>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Transactions</h3>
            <button className="text-xs text-[var(--muted)] hover:text-[var(--text)]" onClick={() => onNavigate("sales")}>
              View all →
            </button>
          </div>
          {!data ? (
            <Spinner />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {data.recent_transactions.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 py-3 fade-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <Avatar name={t.customer_name} size={34} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.customer_name}</div>
                    <div className="text-xs text-[var(--muted)] truncate">
                      {fmtDateTime(t.date)}
                      {t.items?.length ? ` · ${t.items.map((i) => i.product_name).join(", ")}` : ""}
                    </div>
                  </div>
                  <TxnBadge type={t.transaction_type} />
                  <div className="text-sm font-semibold w-20 text-right tabular" style={{ color: t.transaction_type === "payment" ? "var(--green)" : undefined }}>
                    {t.transaction_type === "payment" ? "-" : "+"}
                    {inr(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-5" spotlight>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold flex items-center gap-2"><TrendingUp size={15} className="text-accent" /> 7-day sales</h3>
                <div className="text-xs text-[var(--muted)] mt-0.5">Total {inr(weekTotal)} · hover bars for details</div>
              </div>
            </div>
            <TrendChart data={trend} height={110} format={inr} />
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-3">Quick actions</h3>
            <div className="space-y-2">
              {[
                ["Record udhaar / payment", "khata", Wallet],
                ["Add a customer", "customers", Users],
                ["Check low stock", "inventory", Package],
                ["Business insights", "analytics", AlertTriangle],
              ].map(([label, page, Icon]) => (
                <button key={page} onClick={() => onNavigate(page)} className="nav-item" style={{ border: "1px solid var(--border)", background: "var(--card-2)" }}>
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
            <div className="mt-4 p-4 rounded-xl text-xs leading-relaxed text-[var(--muted)]" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}>
              <span className="text-accent font-semibold">Tip:</span> Try saying <span className="text-[var(--text)]">"Rahul 2 kg sugar leke gaya"</span> — GrowMate records the quantity, reduces stock and updates Rahul's khata. Press <kbd className="badge badge-gray">Ctrl</kbd> + <kbd className="badge badge-gray">K</kbd> to focus the copilot.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Clickable({ onClick, children }) {
  return (
    <div onClick={onClick} className="cursor-pointer" role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onClick()}>
      {children}
    </div>
  );
}
