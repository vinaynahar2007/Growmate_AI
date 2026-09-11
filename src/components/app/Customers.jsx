import { Phone, Plus, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import { inr } from "../../lib/format.js";
import { Avatar, Badge, Card, Empty, ErrorNote, Field, Modal, PageHeader, Spinner } from "../ui.jsx";

export default function Customers({ refreshKey, onOpenKhata, onDataChanged }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", father_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const load = () => {
    setError(null);
    api.customers(search.trim() || undefined).then(setRows).catch((e) => setError(e.message));
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setFormError("Name is required.");
    if (form.name.length > 100) return setFormError("Name is too long.");
    if (form.father_name.length > 100) return setFormError("Father's name is too long.");
    if (form.phone && !/^(\+91)?[6-9]\d{9}$/.test(form.phone.trim())) return setFormError("Please enter a valid 10-digit Indian mobile number.");
    setSaving(true);
    setFormError(null);
    try {
      await api.createCustomer({ name: form.name.trim(), father_name: form.father_name.trim() || null, phone: form.phone.trim() || null });
      setOpen(false);
      setForm({ name: "", father_name: "", phone: "" });
      onDataChanged?.();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Customers"
        title="Customer directory"
        subtitle="Search, view and manage all khata customers in one place."
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} /> Add customer
          </button>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input className="input" style={{ paddingLeft: 40 }} placeholder="Search by name, phone or father name…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <div className="mb-4"><ErrorNote message={error} onRetry={load} /></div>}

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Card>
          <Empty title="No customers found" hint="Try a different search or add a new customer." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((c) => (
            <Card key={c.id} hover className="p-5 cursor-pointer" onClick={() => onOpenKhata(c.id)}>
              <div className="flex items-start gap-3">
                <Avatar name={c.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-[var(--muted)] flex items-center gap-1 mt-0.5">
                    <UserRound size={11} /> {c.father_name ? `S/o ${c.father_name}` : "Father name not set"}
                  </div>
                  <div className="text-xs text-[var(--muted)] flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {c.phone || "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-end justify-between mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div>
                  <div className="text-[11px] text-[var(--muted)]">Outstanding</div>
                  <div className="text-lg font-bold" style={{ color: c.outstanding_balance > 0 ? "var(--amber)" : "var(--green)" }}>
                    {inr(c.outstanding_balance)}
                  </div>
                </div>
                <Badge tone={c.last_transaction_ago === "today" ? "green" : "gray"}>Last visit: {c.last_transaction_ago || "never"}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New customer khata">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Customer name *">
            <input className="input" maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rahul Verma" autoFocus />
          </Field>
          <Field label="Father's name">
            <input className="input" maxLength="100" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} placeholder="e.g. Vikash Verma" />
          </Field>
          <Field label="Phone">
            <input className="input" maxLength="15" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit mobile" />
          </Field>
          {formError && <ErrorNote message={formError} />}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Create khata"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
