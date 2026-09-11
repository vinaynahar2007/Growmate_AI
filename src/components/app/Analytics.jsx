import { AlertTriangle, Clock, IndianRupee, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { inr, qty } from "../../lib/format.js";
import { Avatar, Card, Empty, ErrorNote, PageHeader, Spinner, StatCard, StockBadge } from "../ui.jsx";

export default function Analytics({ refreshKey, onOpenKhata }) {
  const [minCredit, setMinCredit] = useState(1000);
  const [days, setDays] = useState(10);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    setError(null);
    api.analytics(minCredit, days).then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minCredit, days, refreshKey]);

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Analytics" title="Business insights" subtitle="Everyday transactions turned into simple, actionable signals." />
      {error && <div className="mb-4"><ErrorNote message={error} onRetry={load} /></div>}

      {!data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <StatCard label="Sales today" value={inr(data.summary.today_sales)} hint={`${data.summary.today_transaction_count} transactions`} tone="green" icon={IndianRupee} />
            <StatCard label="Outstanding credit" value={inr(data.summary.outstanding_total)} hint={`${data.summary.customers_with_dues} customers owe money`} tone="amber" icon={Wallet} />
            <StatCard label="Inactive customers" value={data.inactive.count} hint={`No visit in ${days} days`} tone="blue" icon={Clock} />
            <StatCard label="Stock alerts" value={data.low_stock.length} hint={`${data.summary.out_of_stock_count} out of stock`} tone="red" icon={AlertTriangle} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">High-credit customers</h3>
                <span className="text-xs text-[var(--muted)]">&gt; {inr(minCredit)}</span>
              </div>
              <input type="range" min={0} max={3000} step={100} value={minCredit} onChange={(e) => setMinCredit(Number(e.target.value))} className="w-full mb-3" />
              {data.high_credit.customers.length === 0 ? <Empty title="No one above threshold" /> : (
                <div className="divide-y divide-[var(--border)]">
                  {data.high_credit.customers.map((c) => (
                    <button key={c.id} onClick={() => onOpenKhata(c.id)} className="w-full flex items-center gap-3 py-2.5 text-left hover:opacity-90">
                      <Avatar name={c.name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-[var(--muted)]">Last visit {c.last_transaction_ago}</div>
                      </div>
                      <div className="font-semibold text-[var(--amber)]">{inr(c.outstanding_balance)}</div>
                    </button>
                  ))}
                  <div className="pt-3 text-xs text-[var(--muted)]">Total: <span className="text-[var(--text)] font-semibold">{inr(data.high_credit.total_outstanding)}</span></div>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold">Inactive customers</h3>
                <span className="text-xs text-[var(--muted)]">&gt; {days} days</span>
              </div>
              <input type="range" min={1} max={30} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full mb-3" />
              {data.inactive.customers.length === 0 ? <Empty title="Everyone visited recently" /> : (
                <div className="divide-y divide-[var(--border)]">
                  {data.inactive.customers.map((c) => (
                    <button key={c.id} onClick={() => onOpenKhata(c.id)} className="w-full flex items-center gap-3 py-2.5 text-left hover:opacity-90">
                      <Avatar name={c.name} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-[11px] text-[var(--muted)]">{c.phone || "no phone"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{c.days_inactive == null ? "never" : `${c.days_inactive}d`}</div>
                        {c.outstanding_balance > 0 && <div className="text-[11px] text-[var(--amber)]">owes {inr(c.outstanding_balance)}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="font-semibold mb-3">Low-stock products</h3>
              {data.low_stock.length === 0 ? <Empty title="All stock levels healthy" /> : (
                <div className="divide-y divide-[var(--border)]">
                  {data.low_stock.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="text-[11px] text-[var(--muted)]">{qty(p.quantity)} {p.unit} left · min {qty(p.minimum_stock)}</div>
                      </div>
                      <StockBadge status={p.status} />
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 p-3.5 rounded-xl text-xs leading-relaxed" style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)", color: "var(--muted)" }}>
                <span className="text-accent font-semibold">Sales summary:</span> today {inr(data.sales.total)} across {data.sales.transaction_count} sales (avg {inr(data.sales.average_sale)}), with {inr(data.sales.payments_received)} recovered from khata.
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
