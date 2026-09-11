import { Bot, CheckCircle2, Sparkles, AlertTriangle, User } from "lucide-react";
import { inr, qty } from "../../lib/format.js";
import { Badge, StockBadge, TxnBadge } from "../ui.jsx";

function Mini({ label, value, tone }) {
  return (
    <div className="card-2 p-3.5">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

function titleFor(meta) {
  const tool = meta?.tool_calls?.[0]?.name;
  const data = meta?.data;
  switch (tool) {
    case "get_customer_khata":
      return data?.customer ? `${data.customer.name.split(" ")[0]}'s Khata` : "Customer Khata";
    case "find_high_credit_customers":
      return "High-credit customers";
    case "find_inactive_customers":
      return "Inactive customers";
    case "get_inventory":
      return data?.product ? `${data.product.name} stock` : "Inventory";
    case "get_today_sales":
      return "Today's sales";
    case "add_transaction":
      return "Transaction recorded";
    case "create_or_update_customer_khata":
      return "Khata updated";
    default:
      return "GrowMate AI";
  }
}

function DataView({ meta }) {
  const tool = meta?.tool_calls?.[0]?.name;
  const d = meta?.data;
  if (!d || d.error) return null;

  if (tool === "get_customer_khata") {
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Mini label="Outstanding" value={inr(d.outstanding)} tone={d.outstanding > 0 ? "var(--amber)" : "var(--green)"} />
          <Mini label="Last visit" value={d.last_transaction_ago || "never"} />
          <Mini label="This month" value={inr(d.this_month_purchases)} />
        </div>
        {d.transactions?.length > 0 && (
          <div className="mt-3 card-2 divide-y divide-[var(--border)]">
            {d.transactions.slice(0, 4).map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <TxnBadge type={t.transaction_type} />
                  <span className="text-[var(--muted)] text-xs">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                </div>
                <span className="font-semibold" style={{ color: t.transaction_type === "payment" ? "var(--green)" : undefined }}>
                  {t.transaction_type === "payment" ? "-" : "+"}
                  {inr(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </>
    );
  }

  if (tool === "find_high_credit_customers" || tool === "find_inactive_customers") {
    if (!d.customers?.length) return null;
    return (
      <div className="mt-4 card-2 divide-y divide-[var(--border)]">
        {d.customers.map((c) => (
          <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-[var(--muted)]">Last visit {c.last_transaction_ago}</div>
            </div>
            <div className="font-semibold" style={{ color: c.outstanding_balance > 0 ? "var(--amber)" : "var(--muted)" }}>
              {inr(c.outstanding_balance)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === "get_inventory") {
    const rows = d.product ? [d.product] : d.needs_attention?.length ? d.needs_attention : d.products?.slice(0, 6) || [];
    return (
      <div className="mt-4 card-2 divide-y divide-[var(--border)]">
        {rows.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-3.5 py-2.5 text-sm">
            <div className="font-medium">{p.name}</div>
            <div className="flex items-center gap-3">
              <span className="text-[var(--muted)]">
                {qty(p.quantity)} {p.unit}
              </span>
              <StockBadge status={p.status} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tool === "get_today_sales") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <Mini label="Total sales" value={inr(d.total)} tone="var(--green)" />
        <Mini label="Transactions" value={d.transaction_count} />
        <Mini label="Average sale" value={inr(d.average_sale)} />
      </div>
    );
  }

  if (tool === "add_transaction" || (tool === "create_or_update_customer_khata" && d.transaction)) {
    const r = tool === "add_transaction" ? d : d.transaction;
    if (!r?.transaction) {
      return d.customer ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Mini label="Customer" value={d.customer.name} />
          <Mini label="Father name" value={d.customer.father_name || "—"} />
          <Mini label="Outstanding" value={inr(d.customer.outstanding_balance)} />
        </div>
      ) : null;
    }
    const t = r.transaction;
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Mini label="Amount" value={r.amount_missing ? "Price pending" : inr(t.amount)} tone={r.amount_missing ? "var(--amber)" : undefined} />
          <Mini label="Type" value={<TxnBadge type={t.transaction_type} />} />
          <Mini label="New balance" value={r.customer ? inr(r.customer.outstanding_balance) : "—"} />
        </div>
        {r.stock_updates?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {r.stock_updates.map((s) => (
              <Badge key={s.product} tone={s.status === "good" ? "gray" : s.status === "low" ? "amber" : "red"}>
                {s.product}: {qty(s.remaining)} {s.unit} left
              </Badge>
            ))}
          </div>
        )}
        {r.warnings?.length > 0 && (
          <div className="mt-3 text-xs text-[var(--amber)] flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" /> <span>{r.warnings.join(" ")}</span>
          </div>
        )}
      </>
    );
  }

  if (tool === "create_or_update_customer_khata" && d.customer) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <Mini label="Customer" value={d.customer.name} />
        <Mini label="Father name" value={d.customer.father_name || "—"} />
        <Mini label="Phone" value={d.customer.phone || "—"} />
      </div>
    );
  }
  return null;
}

export function UserBubble({ content }) {
  return (
    <div className="flex justify-end fade-up">
      <div className="flex items-start gap-3 max-w-[85%]">
        <div className="rounded-2xl rounded-tr-md px-4 py-3 text-sm font-medium text-white" style={{ background: "var(--grad)" }}>
          {content}
        </div>
        <div className="w-8 h-8 rounded-full grid place-items-center shrink-0 card-2">
          <User size={14} className="text-[var(--muted)]" />
        </div>
      </div>
    </div>
  );
}

export default function ResponseCard({ message }) {
  const meta = message.meta || {};
  const isError = meta.mode === "error" || meta.data?.error;
  const hasTools = meta.tool_calls?.length > 0;
  const grounded = hasTools && !meta.data?.error;

  return (
    <div className="card p-5 fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="icon-tile" style={{ width: 38, height: 38 }}>
            <Bot size={17} />
          </div>
          <div>
            <div className="font-semibold text-[15px]">{titleFor(meta)}</div>
            <div className="text-[11px] text-[var(--muted)]">
              AI response · {new Date(message.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              {meta.mode === "demo" && <span className="ml-2 badge badge-amber" style={{ padding: "1px 7px" }}>Demo AI mode</span>}
              {meta.mode === "openai" && <span className="ml-2 badge badge-purple" style={{ padding: "1px 7px" }}><Sparkles size={10} /> OpenAI agent</span>}
            </div>
          </div>
        </div>
        {grounded && (
          <span className="text-[11px] text-[var(--green)] flex items-center gap-1 shrink-0">
            <CheckCircle2 size={13} /> From your shop data
          </span>
        )}
        {isError && (
          <span className="text-[11px] text-[var(--red)] flex items-center gap-1 shrink-0">
            <AlertTriangle size={13} /> Needs attention
          </span>
        )}
      </div>

      <p className="mt-4 text-[14.5px] leading-relaxed whitespace-pre-line text-body">{message.content}</p>
      <DataView meta={meta} />

      {hasTools && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {meta.tool_calls.map((t, i) => (
            <span key={i} className="badge badge-gray" style={{ fontFamily: "ui-monospace, monospace", fontWeight: 500 }}>
              ⚙ {t.name}
              {Object.keys(t.arguments || {}).length ? `(${Object.values(t.arguments).filter((v) => v !== null && typeof v !== "object").join(", ")})` : "()"}
            </span>
          ))}
        </div>
      )}
      {meta.error && meta.mode !== "error" && <div className="mt-3 text-[11px] text-[var(--amber)]">{meta.error}</div>}
    </div>
  );
}
