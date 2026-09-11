import { ArrowDownLeft, ArrowUpRight, BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { fmtDateTime, inr, qty, timeAgo } from "../../lib/format.js";
import { Avatar, Badge, Card, Empty, ErrorNote, Field, Modal, PageHeader, Spinner, TxnBadge } from "../ui.jsx";

const emptyItem = () => ({ product_name: "", quantity: 1, price: "" });

export default function Khata({ refreshKey, selectedId, onSelect, onDataChanged }) {
  const [customers, setCustomers] = useState(null);
  const [products, setProducts] = useState([]);
  const [khata, setKhata] = useState(null);
  const [error, setError] = useState(null);
  const [khataError, setKhataError] = useState(null);
  const [filter, setFilter] = useState("");
  const [txnOpen, setTxnOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    setError(null);
    api.customers().then((rows) => {
      setCustomers(rows);
      if (!selectedId && rows.length) onSelect(rows[0].id);
    }).catch((e) => setError(e.message));
    api.inventory().then((r) => setProducts(r.products || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const loadKhata = () => {
    if (!selectedId) return;
    setKhata(null);
    setKhataError(null);
    api.khata(selectedId).then(setKhata).catch((e) => setKhataError(e.message));
  };
  useEffect(loadKhata, [selectedId, refreshKey]);

  const list = useMemo(() => (customers || []).filter((c) => c.name.toLowerCase().includes(filter.toLowerCase())), [customers, filter]);

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Khata" title="Customer Khata" subtitle="Udhaar ledger — every credit, payment and item, per customer." />

      {error && <div className="mb-4"><ErrorNote message={error} /></div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* customer list */}
        <Card className="lg:col-span-4 p-3">
          <input className="input mb-2" placeholder="Filter customers…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          {!customers ? (
            <Spinner />
          ) : (
            <div className="space-y-1 max-h-[60vh] overflow-auto pr-1">
              {list.map((c) => (
                <button key={c.id} onClick={() => onSelect(c.id)} className={`nav-item ${selectedId === c.id ? "active" : ""}`} style={{ padding: "10px 12px" }}>
                  <Avatar name={c.name} size={30} />
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block truncate text-[13.5px]">{c.name}</span>
                    <span className="block text-[11px] text-[var(--muted)]">{c.last_transaction_ago}</span>
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: c.outstanding_balance > 0 ? "var(--amber)" : "var(--green)" }}>
                    {inr(c.outstanding_balance)}
                  </span>
                </button>
              ))}
              {list.length === 0 && <Empty title="No match" />}
            </div>
          )}
        </Card>

        {/* khata detail */}
        <div className="lg:col-span-8 space-y-4">
          {khataError && <ErrorNote message={khataError} onRetry={loadKhata} />}
          {!khata && !khataError ? (
            <Card><Spinner label="Loading khata…" /></Card>
          ) : khata ? (
            <>
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={khata.customer.name} size={52} />
                    <div>
                      <div className="text-xl font-bold">{khata.customer.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {khata.customer.father_name ? `S/o ${khata.customer.father_name} · ` : ""}
                        {khata.customer.phone || "no phone"} · customer since {new Date(khata.customer.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
                      <Pencil size={14} /> Edit
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => setTxnOpen(true)}>
                      <Plus size={14} /> Record entry
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  <Mini label="Outstanding" value={inr(khata.outstanding)} tone={khata.outstanding > 0 ? "var(--amber)" : "var(--green)"} />
                  <Mini label="Last visit" value={khata.last_transaction_ago || "never"} />
                  <Mini label="This month" value={inr(khata.this_month_purchases)} />
                  <Mini label="Entries" value={khata.transaction_count} />
                </div>
              </Card>

              <Card className="p-0 overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <BookOpen size={16} className="text-accent" />
                  <h3 className="font-semibold">Transaction history</h3>
                </div>
                {khata.transactions.length === 0 ? (
                  <Empty title="No transactions yet" hint="Record the first entry for this customer." />
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {khata.transactions.map((t) => (
                      <div key={t.id} className="px-5 py-3.5 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: t.transaction_type === "payment" ? "rgba(52,211,153,0.1)" : "rgba(251,191,36,0.1)", color: t.transaction_type === "payment" ? "var(--green)" : "var(--amber)" }}>
                          {t.transaction_type === "payment" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <TxnBadge type={t.transaction_type} />
                            {t.payment_status === "amount_missing" && <Badge tone="red">Price pending</Badge>}
                            <span className="text-xs text-[var(--muted)]">{fmtDateTime(t.date)} · {timeAgo(t.date)}</span>
                          </div>
                          {t.items?.length > 0 && (
                            <div className="text-xs text-[var(--muted)] mt-1">
                              {t.items.map((i) => `${qty(i.quantity)} ${i.unit || ""} ${i.product_name}${i.price != null ? ` @ ${inr(i.price)}` : " (price not set)"}`).join(" · ")}
                            </div>
                          )}
                          {t.notes && <div className="text-xs text-[var(--muted-2)] mt-0.5 italic">{t.notes}</div>}
                        </div>
                        <div className="font-semibold text-right" style={{ color: t.transaction_type === "payment" ? "var(--green)" : undefined }}>
                          {t.transaction_type === "payment" ? "-" : "+"}
                          {inr(t.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : null}
        </div>
      </div>

      {khata && (
        <>
          <TxnModal open={txnOpen} onClose={() => setTxnOpen(false)} customer={khata.customer} products={products} onDone={() => { setTxnOpen(false); onDataChanged?.(); loadKhata(); }} />
          <EditModal open={editOpen} onClose={() => setEditOpen(false)} customer={khata.customer} onDone={() => { setEditOpen(false); onDataChanged?.(); loadKhata(); }} />
        </>
      )}
    </div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div className="card-2 p-3.5">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={tone ? { color: tone } : undefined}>{value}</div>
    </div>
  );
}

export function TxnModal({ open, onClose, customer, products, onDone, allowWalkIn = false }) {
  const [type, setType] = useState("credit");
  const [amount, setAmount] = useState("");
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) { setType("credit"); setAmount(""); setItems([]); setNotes(""); setErr(null); setResult(null); }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const cleanItems = items.filter((i) => i.product_name).map((i) => ({ product_name: i.product_name, quantity: Number(i.quantity) || 1, price: i.price === "" ? null : Number(i.price) }));
    if (type === "payment" && !(Number(amount) > 0)) return setErr("Payment amount is required.");
    if (type !== "payment" && !(Number(amount) > 0) && cleanItems.length === 0) return setErr("Enter an amount or add at least one item.");
    setSaving(true);
    try {
      const r = await api.addTransaction({ customer_name: customer?.name || null, amount: amount === "" ? null : Number(amount), transaction_type: type, items: type === "payment" ? [] : cleanItems, notes: notes || null });
      setResult(r);
      setTimeout(onDone, 900);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={customer ? `Record entry · ${customer.name.split(" ")[0]}` : "Record cash sale"} width={560}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {[["credit", "Udhaar (credit)"], ["cash", "Cash sale"], ["payment", "Payment received"]].filter(([k]) => customer || k === "cash").map(([k, label]) => (
            <button type="button" key={k} onClick={() => setType(k)} className={`btn btn-sm ${type === k ? "btn-primary" : "btn-ghost"}`}>{label}</button>
          ))}
        </div>
        {type !== "payment" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[var(--muted)] font-medium">Items (optional — stock is reduced automatically)</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setItems([...items, emptyItem()])}><Plus size={13} /> Item</button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <select className="input col-span-6" value={it.product_name} onChange={(e) => { const n = [...items]; n[idx] = { ...it, product_name: e.target.value }; setItems(n); }}>
                    <option value="">Select product…</option>
                    {products.map((p) => <option key={p.id} value={p.name}>{p.name} ({qty(p.quantity)} {p.unit})</option>)}
                  </select>
                  <input className="input col-span-2" type="number" min="0.1" step="0.1" value={it.quantity} onChange={(e) => { const n = [...items]; n[idx] = { ...it, quantity: e.target.value }; setItems(n); }} placeholder="Qty" />
                  <input className="input col-span-3" type="number" min="0" value={it.price} onChange={(e) => { const n = [...items]; n[idx] = { ...it, price: e.target.value }; setItems(n); }} placeholder="Price (opt.)" />
                  <button type="button" className="col-span-1 text-[var(--muted)] hover:text-[var(--red)] grid place-items-center" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        <Field label={type === "payment" ? "Amount received (₹) *" : "Total amount (₹)"} hint={type !== "payment" ? "Leave blank to use catalogue prices for the items. Prices are never guessed." : undefined}>
          <input className="input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500" />
        </Field>
        <Field label="Notes">
          <input className="input" maxLength="500" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
        </Field>
        {err && <ErrorNote message={err} />}
        {result && (
          <div className="text-sm rounded-xl px-4 py-3" style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", color: "#6ee7b7" }}>
            Recorded {inr(result.transaction.amount)} {result.transaction.transaction_type}. {result.customer ? `New balance ${inr(result.customer.outstanding_balance)}.` : ""} {result.warnings?.join(" ")}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save entry"}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ open, onClose, customer, onDone }) {
  const [form, setForm] = useState({ name: "", father_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (open && customer) setForm({ name: customer.name || "", father_name: customer.father_name || "", phone: customer.phone || "" });
  }, [open, customer]);
  const submit = async (e) => {
    e.preventDefault();
    if (form.phone && !/^(\+91)?[6-9]\d{9}$/.test(form.phone.trim())) return setErr("Please enter a valid 10-digit Indian mobile number.");
    setSaving(true); setErr(null);
    try {
      await api.updateCustomer(customer.id, { name: form.name.trim() || null, father_name: form.father_name.trim() || null, phone: form.phone.trim() || null });
      onDone();
    } catch (e2) { setErr(e2.message); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Edit customer">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name"><input className="input" maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Father's name"><input className="input" maxLength="100" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" maxLength="15" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        {err && <ErrorNote message={err} />}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>
    </Modal>
  );
}
