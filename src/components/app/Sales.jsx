import { IndianRupee, Plus, Receipt, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { fmtDateTime, inr, qty } from "../../lib/format.js";
import { Avatar, Badge, Card, Empty, ErrorNote, PageHeader, Spinner, StatCard, TxnBadge } from "../ui.jsx";
import { TxnModal } from "./Khata.jsx";

export default function Sales({ refreshKey, onDataChanged }) {
  const [today, setToday] = useState(null);
  const [recent, setRecent] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    setError(null);
    Promise.all([api.salesToday(), api.transactions(40), api.inventory()])
      .then(([t, r, inv]) => { setToday(t); setRecent(r); setProducts(inv.products || []); })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Sales"
        title="Sales & transactions"
        subtitle="Cash + udhaar sales for today, and the full recent transaction log."
        actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Record cash sale</button>}
      />
      {error && <div className="mb-4"><ErrorNote message={error} onRetry={load} /></div>}

      {!today ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          <StatCard label="Today's sales" value={inr(today.total)} hint={`Cash ${inr(today.cash_total)} · Udhaar ${inr(today.credit_total)}`} tone="green" icon={IndianRupee} />
          <StatCard label="Transactions" value={today.transaction_count} hint="Sales recorded today" tone="purple" icon={Receipt} />
          <StatCard label="Average sale" value={inr(today.average_sale)} hint="Per transaction" tone="blue" icon={TrendingUp} />
          <StatCard label="Payments received" value={inr(today.payments_received)} hint="Khata recoveries today" tone="amber" />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-2 p-5">
          <h3 className="font-semibold mb-3">Today's sales</h3>
          {!today ? <Spinner /> : today.transactions.length === 0 ? <Empty title="No sales yet today" /> : (
            <div className="divide-y divide-[var(--border)]">
              {today.transactions.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-3">
                  <Avatar name={t.customer_name} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.customer_name}</div>
                    <div className="text-[11px] text-[var(--muted)] truncate">{t.items?.map((i) => `${qty(i.quantity)} ${i.unit || ""} ${i.product_name}`).join(", ") || t.notes || "—"}</div>
                  </div>
                  <TxnBadge type={t.transaction_type} />
                  <div className="text-sm font-semibold">{inr(t.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="xl:col-span-3 overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}><h3 className="font-semibold">Recent transactions</h3></div>
          {!recent ? <Spinner /> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Date</th><th>Customer</th><th>Type</th><th>Items</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id}>
                      <td className="text-[var(--muted)] whitespace-nowrap">{fmtDateTime(t.date)}</td>
                      <td className="font-medium whitespace-nowrap">{t.customer_name}</td>
                      <td><TxnBadge type={t.transaction_type} />{t.payment_status === "amount_missing" && <Badge tone="red" className="ml-1">Price pending</Badge>}</td>
                      <td className="text-[var(--muted)] text-xs max-w-[220px] truncate">{t.items?.map((i) => `${qty(i.quantity)} ${i.product_name}`).join(", ") || "—"}</td>
                      <td className="text-right font-semibold" style={{ color: t.transaction_type === "payment" ? "var(--green)" : undefined }}>{t.transaction_type === "payment" ? "-" : "+"}{inr(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <TxnModal open={open} onClose={() => setOpen(false)} customer={null} products={products} onDone={() => { setOpen(false); onDataChanged?.(); load(); }} />
    </div>
  );
}
