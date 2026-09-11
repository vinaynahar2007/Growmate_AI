import { Package, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import { inr, qty } from "../../lib/format.js";
import { Card, Empty, ErrorNote, PageHeader, Spinner, StockBadge, StatCard } from "../ui.jsx";

export default function Inventory({ refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const load = () => {
    setError(null);
    api.inventory().then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, [refreshKey]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => (filter === "all" || p.status === filter) && p.name.toLowerCase().includes(search.toLowerCase()));
  }, [data, filter, search]);

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Inventory" title="Stock overview" subtitle="Stock reduces automatically when a sale is recorded." />
      {error && <div className="mb-4"><ErrorNote message={error} onRetry={load} /></div>}

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <StatCard label="Products" value={data.summary.total} hint="In catalogue" tone="purple" icon={Package} />
            <StatCard label="Good stock" value={data.summary.good} hint="Above minimum" tone="green" />
            <StatCard label="Low stock" value={data.summary.low} hint="At or below minimum" tone="amber" />
            <StatCard label="Out of stock" value={data.summary.out} hint="Reorder now" tone="red" />
          </div>

          <div className="flex flex-wrap gap-2 items-center mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input className="input" style={{ paddingLeft: 38 }} placeholder="Search product…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {[["all", "All"], ["good", "Good"], ["low", "Low"], ["out", "Out"]].map(([k, label]) => (
              <button key={k} className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>

          <Card className="overflow-hidden">
            {rows.length === 0 ? (
              <Empty title="No products match" />
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock</th>
                      <th>Level</th>
                      <th>Min. stock</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const pct = Math.min(100, Math.round((p.quantity / Math.max(p.minimum_stock * 3, 1)) * 100));
                      const color = p.status === "good" ? "var(--green)" : p.status === "low" ? "var(--amber)" : "var(--red)";
                      return (
                        <tr key={p.id}>
                          <td className="font-medium">{p.name}</td>
                          <td>{qty(p.quantity)} {p.unit}</td>
                          <td style={{ minWidth: 140 }}>
                            <div className="h-1.5 rounded-full w-full" style={{ background: "var(--border)" }}>
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
                            </div>
                          </td>
                          <td className="text-[var(--muted)]">{qty(p.minimum_stock)} {p.unit}</td>
                          <td>{p.price != null ? `${inr(p.price)}/${p.unit}` : "—"}</td>
                          <td><StockBadge status={p.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
