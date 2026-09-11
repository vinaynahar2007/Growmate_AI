/**
 * In-browser demo store.
 *
 * Mirrors the Python in-memory repository + demo agent so the UI keeps working
 * when the FastAPI backend is not reachable (e.g. static preview). The real
 * application talks to the Python backend via src/lib/api.js — this file is only
 * a graceful fallback and contains NO API keys.
 */

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 12)}`;
const norm = (s) => (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");

const ALIASES = {
  doodh: "milk", dudh: "milk", chawal: "rice", chaval: "rice", atta: "wheat", gehu: "wheat", gehun: "wheat",
  aata: "wheat", cheeni: "sugar", chini: "sugar", shakkar: "sugar", tel: "cooking oil", oil: "cooking oil",
  daal: "dal", dal: "dal", chai: "tea", biscuit: "biscuits", biskut: "biscuits",
};

const daysAgo = (n, h = 11, m = 15) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const stockStatus = (q, min) => (q <= 0 ? "out" : q <= min ? "low" : "good");

// ---------------------------------------------------------------- seed
const products = [
  ["Rice", 42, "kg", 58, 15], ["Wheat", 30, "kg", 34, 20], ["Sugar", 8, "kg", 44, 10],
  ["Milk", 6, "litre", 62, 12], ["Cooking Oil", 14, "litre", 148, 6], ["Dal", 0, "kg", 128, 8],
  ["Tea", 22, "packet", 55, 10], ["Biscuits", 4, "packet", 10, 20],
].map(([name, quantity, unit, price, minimum_stock]) => ({
  id: uid("prod"), shop_id: "shop_demo_001", name, quantity, unit, price, minimum_stock,
}));

const customers = [
  ["Ramesh Kumar", "Mohan Kumar", "9876543210"], ["Rahul Verma", "Vikash Verma", "9812345678"],
  ["Priya Sharma", "Suresh Sharma", "9898989898"], ["Amit Singh", "Rajendra Singh", "9765432109"],
  ["Neha Gupta", "Anil Gupta", "9654321098"], ["Suresh Yadav", "Ram Yadav", "9543210987"],
].map(([name, father_name, phone], i) => ({
  id: uid("cust"), shop_id: "shop_demo_001", name, father_name, phone, outstanding_balance: 0, created_at: daysAgo(60 - i * 5),
}));

const P = Object.fromEntries(products.map((p) => [p.name, p]));
const C = Object.fromEntries(customers.map((c) => [c.name.split(" ")[0], c]));
const item = (name, quantity, price) => {
  const p = P[name];
  return { id: uid("item"), product_id: p.id, product_name: p.name, quantity, unit: p.unit, price: price ?? p.price };
};

const transactions = [];
const history = [
  ["Ramesh", 26, 900, "credit", [item("Rice", 10), item("Sugar", 5)], "Monthly ration"],
  ["Ramesh", 22, 900, "payment", [], "Paid in cash"],
  ["Ramesh", 12, 1200, "credit", [item("Cooking Oil", 5), item("Wheat", 10)], null],
  ["Ramesh", 7, 1800, "credit", [item("Rice", 20), item("Dal", 5)], "Wedding order"],
  ["Ramesh", 4, 550, "payment", [], "Part payment via UPI"],
  ["Rahul", 18, 500, "credit", [item("Tea", 4), item("Biscuits", 10)], null],
  ["Rahul", 14, 500, "payment", [], null],
  ["Rahul", 2, 800, "credit", [item("Cooking Oil", 3), item("Sugar", 3)], null],
  ["Rahul", 0, 450, "cash", [item("Milk", 4), item("Biscuits", 5)], null],
  ["Priya", 15, 2200, "credit", [item("Rice", 25), item("Dal", 4)], "Festival stock"],
  ["Priya", 13, 700, "payment", [], null],
  ["Amit", 9, 380, "cash", [item("Milk", 3), item("Tea", 2)], null],
  ["Amit", 5, 400, "credit", [item("Sugar", 5), item("Biscuits", 10)], null],
  ["Amit", 0, 350, "cash", [item("Wheat", 10)], null],
  ["Neha", 34, 1200, "credit", [item("Cooking Oil", 5), item("Rice", 5)], null],
  ["Neha", 28, 1200, "payment", [], "Cleared old dues"],
  ["Neha", 20, 600, "credit", [item("Dal", 3), item("Tea", 2)], null],
  ["Suresh", 9, 3000, "credit", [item("Rice", 30), item("Wheat", 20), item("Cooking Oil", 4)], "Bulk order"],
  ["Suresh", 8, 1000, "payment", [], null],
  [null, 0, 620, "cash", [item("Cooking Oil", 2), item("Tea", 3), item("Milk", 2)], "Walk-in"],
];
history.forEach(([cust, d, amount, transaction_type, items, notes], idx) => {
  const c = cust ? C[cust] : null;
  const id = uid("txn");
  transactions.push({
    id, shop_id: "shop_demo_001", customer_id: c ? c.id : null, date: daysAgo(d, 9 + (idx % 8), (idx * 7) % 60),
    amount, transaction_type, payment_status: transaction_type === "credit" ? "pending" : "paid", notes,
    items: items.map((i) => ({ ...i, transaction_id: id })),
  });
  if (c && transaction_type === "credit") c.outstanding_balance += amount;
  if (c && transaction_type === "payment") c.outstanding_balance -= amount;
});

// ---------------------------------------------------------------- repo
const withStatus = (p) => ({ ...p, status: stockStatus(p.quantity, p.minimum_stock) });
const decorate = (t) => {
  const c = customers.find((x) => x.id === t.customer_id);
  return { ...t, customer_name: c ? c.name : "Walk-in customer" };
};
const sorted = (rows) => [...rows].sort((a, b) => (a.date < b.date ? 1 : -1));
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
const ago = (iso) => (!iso ? "never" : daysSince(iso) === 0 ? "today" : daysSince(iso) === 1 ? "yesterday" : `${daysSince(iso)} days ago`);

function findCustomer(name) {
  const q = norm(name);
  if (!q) return null;
  return customers.find((c) => norm(c.name) === q) || customers.find((c) => norm(c.name).split(" ")[0] === q) ||
    customers.find((c) => norm(c.name).includes(q)) || null;
}
function findProduct(name) {
  let q = norm(name);
  q = ALIASES[q] || q;
  return products.find((p) => norm(p.name) === q) || products.find((p) => norm(p.name).includes(q) || q.includes(norm(p.name))) ||
    products.find((p) => norm(p.name).replace(/s$/, "") === q.replace(/s$/, "")) || null;
}
const lastTxn = (cid) => sorted(transactions.filter((t) => t.customer_id === cid))[0] || null;

const SALE = ["credit", "cash"];

export const local = {
  health: async () => ({ status: "ok", service: "growmate-ai", ai_mode: "demo", repository: "BrowserDemo", shop: { name: "Sharma General Store", owner: "Rajesh" } }),

  customers: async (search) => {
    const q = norm(search);
    return customers
      .filter((c) => !q || norm(c.name).includes(q) || norm(c.phone).includes(q) || norm(c.father_name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => { const l = lastTxn(c.id); return { ...c, last_transaction_date: l?.date || null, last_transaction_ago: ago(l?.date) }; });
  },
  customer: async (id) => customers.find((c) => c.id === id) || null,
  createCustomer: async ({ name, father_name, phone }) => {
    const ex = findCustomer(name);
    if (ex && norm(ex.name) === norm(name)) throw new Error(`Customer '${ex.name}' already exists.`);
    const c = { id: uid("cust"), shop_id: "shop_demo_001", name: name.trim(), father_name: father_name || null, phone: phone || null, outstanding_balance: 0, created_at: new Date().toISOString() };
    customers.push(c);
    return c;
  },
  updateCustomer: async (id, fields) => {
    const c = customers.find((x) => x.id === id);
    if (!c) throw new Error("Customer not found.");
    Object.entries(fields).forEach(([k, v]) => { if (v != null && ["name", "father_name", "phone"].includes(k)) c[k] = v; });
    return c;
  },
  khata: async (id) => {
    const c = customers.find((x) => x.id === id);
    if (!c) throw new Error("Customer not found.");
    return khataFor(c);
  },
  inventory: async (product) => {
    if (product) {
      const p = findProduct(product);
      if (!p) return { error: `Product '${product}' not found.`, available_products: products.map((x) => x.name) };
      const w = withStatus(p);
      return { product: w, products: [w], status: w.status };
    }
    const rows = products.map(withStatus).sort((a, b) => a.name.localeCompare(b.name));
    return {
      products: rows,
      summary: { total: rows.length, good: rows.filter((p) => p.status === "good").length, low: rows.filter((p) => p.status === "low").length, out: rows.filter((p) => p.status === "out").length },
      needs_attention: rows.filter((p) => p.status !== "good"),
    };
  },
  salesToday: async () => todaySales(),
  transactions: async (limit = 50, customer_id) => sorted(transactions.filter((t) => !customer_id || t.customer_id === customer_id)).slice(0, limit).map(decorate),
  addTransaction: async (body) => {
    const r = addTransaction(body);
    if (r.error) throw new Error(r.error);
    return r;
  },
  dashboard: async () => summary(),
  analytics: async (minCredit = 1000, days = 10) => ({
    summary: summary(), high_credit: highCredit(minCredit), inactive: inactive(days), low_stock: products.map(withStatus).filter((p) => p.status !== "good"), sales: todaySales(),
  }),
  chat: async (message) => demoChat(message),
};

// ---------------------------------------------------------------- tools
function khataFor(c) {
  const hist = sorted(transactions.filter((t) => t.customer_id === c.id)).map(decorate);
  const last = hist[0] || null;
  const ms = new Date(); ms.setDate(1); ms.setHours(0, 0, 0, 0);
  const month = hist.filter((t) => SALE.includes(t.transaction_type) && new Date(t.date) >= ms).reduce((s, t) => s + t.amount, 0);
  return {
    customer: c, outstanding: c.outstanding_balance, transactions: hist, transaction_count: hist.length, last_transaction: last,
    last_transaction_ago: last ? ago(last.date) : null, days_since_last_transaction: last ? daysSince(last.date) : null, this_month_purchases: month,
  };
}
function todaySales() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = transactions.filter((t) => new Date(t.date) >= start);
  const sales = sorted(today.filter((t) => SALE.includes(t.transaction_type))).map(decorate);
  const total = sales.reduce((s, t) => s + t.amount, 0);
  return {
    date: start.toISOString().slice(0, 10), total, cash_total: sales.filter((t) => t.transaction_type === "cash").reduce((s, t) => s + t.amount, 0),
    credit_total: sales.filter((t) => t.transaction_type === "credit").reduce((s, t) => s + t.amount, 0),
    payments_received: today.filter((t) => t.transaction_type === "payment").reduce((s, t) => s + t.amount, 0),
    transaction_count: sales.length, average_sale: sales.length ? Math.round(total / sales.length) : 0, transactions: sales,
  };
}
function highCredit(min = 1000) {
  const rows = customers.filter((c) => c.outstanding_balance > min).sort((a, b) => b.outstanding_balance - a.outstanding_balance)
    .map((c) => ({ ...c, last_transaction_ago: ago(lastTxn(c.id)?.date) }));
  return { minimum_amount: min, count: rows.length, customers: rows, total_outstanding: rows.reduce((s, c) => s + c.outstanding_balance, 0) };
}
function inactive(days = 10) {
  const rows = customers.map((c) => { const l = lastTxn(c.id); return { ...c, last_transaction_date: l?.date || null, days_inactive: l ? daysSince(l.date) : null, last_transaction_ago: ago(l?.date) }; })
    .filter((c) => c.days_inactive === null || c.days_inactive > days).sort((a, b) => (b.days_inactive || 0) - (a.days_inactive || 0));
  return { days, count: rows.length, customers: rows };
}
function summary() {
  const t = todaySales();
  const pr = products.map(withStatus);
  return {
    today_sales: t.total, today_transaction_count: t.transaction_count, today_average_sale: t.average_sale,
    outstanding_total: customers.reduce((s, c) => s + c.outstanding_balance, 0), customers_with_dues: customers.filter((c) => c.outstanding_balance > 0).length,
    customer_count: customers.length, low_stock_count: pr.filter((p) => p.status === "low").length, out_of_stock_count: pr.filter((p) => p.status === "out").length,
    recent_transactions: sorted(transactions).slice(0, 8).map(decorate),
  };
}
function addTransaction({ customer_name, items = [], amount, transaction_type = "credit", notes }) {
  let customer = null;
  if (customer_name) {
    customer = findCustomer(customer_name);
    if (!customer) return { error: `Customer '${customer_name}' not found.`, suggestions: customers.slice(0, 6).map((c) => c.name) };
  } else if (transaction_type !== "cash") return { error: "A customer name is required for credit or payment transactions." };

  const warnings = []; let total = 0; let allPriced = true;
  const rows = items.map((it) => {
    const p = findProduct(it.product_name);
    let price = it.price ?? (p ? p.price : null);
    if (price == null) { allPriced = false; warnings.push(`Price for '${it.product_name}' was not specified.`); } else total += price * it.quantity;
    if (!p) warnings.push(`Product '${it.product_name}' is not in inventory — recorded without stock update.`);
    return { id: uid("item"), product_id: p?.id || null, product_name: p?.name || it.product_name, quantity: Number(it.quantity) || 1, unit: it.unit || p?.unit || null, price };
  });
  let status = transaction_type === "credit" ? "pending" : "paid";
  if (!amount || amount <= 0) {
    if (rows.length && allPriced) { amount = total; warnings.push("Amount computed from shop catalogue prices."); }
    else if (transaction_type === "payment") return { error: "Payment amount is required." };
    else { amount = 0; status = "amount_missing"; warnings.push("Amount not supplied — quantity recorded, please add the price later."); }
  }
  const txn = { id: uid("txn"), shop_id: "shop_demo_001", customer_id: customer?.id || null, date: new Date().toISOString(), amount, transaction_type, payment_status: status, notes: notes || null, items: rows };
  transactions.push(txn);
  if (customer && transaction_type === "credit") customer.outstanding_balance += amount;
  if (customer && transaction_type === "payment") customer.outstanding_balance -= amount;
  const stock_updates = [];
  if (SALE.includes(transaction_type)) rows.forEach((r) => { const p = products.find((x) => x.id === r.product_id); if (p) { p.quantity = Math.max(0, p.quantity - r.quantity); stock_updates.push({ product: p.name, remaining: p.quantity, unit: p.unit, status: stockStatus(p.quantity, p.minimum_stock) }); } });
  return { transaction: decorate(txn), customer, stock_updates, warnings, amount_missing: status === "amount_missing" };
}

// ---------------------------------------------------------------- demo chat
const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
const first = (n) => (n || "").split(" ")[0];

function format(tool, result) {
  if (result.error) return result.error + (result.suggestions ? " Available customers: " + result.suggestions.join(", ") + "." : "") + (result.available_products ? " Available products: " + result.available_products.join(", ") + "." : "");
  switch (tool) {
    case "get_customer_khata": {
      const c = result.customer; const l = result.last_transaction;
      let s = result.outstanding > 0 ? `${first(c.name)} currently owes ${inr(result.outstanding)}.` : `${first(c.name)} has no pending balance. Khata clear hai!`;
      if (l) s += ` Last transaction was ${result.last_transaction_ago} — ${{ credit: "took goods on udhaar", cash: "made a cash purchase", payment: "made a payment" }[l.transaction_type]} of ${inr(l.amount)}.`;
      return s + ` This month's purchases: ${inr(result.this_month_purchases)}.`;
    }
    case "find_high_credit_customers":
      if (!result.count) return `Koi bhi customer ka ${inr(result.minimum_amount)} se zyada baki nahi hai.`;
      return [`${result.count} customers ka ${inr(result.minimum_amount)} se zyada baki hai (total ${inr(result.total_outstanding)}):`, ...result.customers.map((c) => `• ${c.name} — ${inr(c.outstanding_balance)} (last visit ${c.last_transaction_ago})`)].join("\n");
    case "find_inactive_customers":
      if (!result.count) return `Sab regular customers pichle ${result.days} din me aaye hain.`;
      return [`${result.count} customers pichle ${result.days} din se nahi aaye:`, ...result.customers.map((c) => `• ${c.name} — last visit ${c.last_transaction_ago}${c.outstanding_balance > 0 ? `, baki ${inr(c.outstanding_balance)}` : ""}`)].join("\n");
    case "get_inventory": {
      if (result.product) { const p = result.product; return `${p.name}: ${p.quantity} ${p.unit} available (minimum ${p.minimum_stock} ${p.unit}). ${{ good: "Stock theek hai.", low: "⚠️ Low stock — reorder soon.", out: "❌ Out of stock!" }[p.status]}`; }
      const s = result.summary;
      return [`Inventory: ${s.total} products — ${s.good} good, ${s.low} low, ${s.out} out of stock.`, ...result.needs_attention.map((p) => `• ${p.name}: ${p.quantity} ${p.unit} (${p.status === "out" ? "out of stock" : "low"})`)].join("\n");
    }
    case "get_today_sales":
      if (!result.transaction_count) return "Aaj abhi tak koi sale record nahi hui.";
      return `Aaj ki total sale ${inr(result.total)} hai — ${result.transaction_count} transactions, average ${inr(result.average_sale)}. Cash ${inr(result.cash_total)}, udhaar ${inr(result.credit_total)}. Payments received: ${inr(result.payments_received)}.`;
    case "add_transaction": {
      const t = result.transaction; const c = result.customer; const name = c ? first(c.name) : "Walk-in customer";
      const items = t.items?.length ? ` (${t.items.map((i) => `${i.quantity} ${i.unit || ""} ${i.product_name}`.trim()).join(", ")})` : "";
      let msg = t.transaction_type === "payment" ? `Recorded: ${name} paid ${inr(t.amount)}. New balance: ${inr(c.outstanding_balance)}.`
        : t.transaction_type === "credit" ? (result.amount_missing ? `Recorded udhaar for ${name}${items}. Price nahi bataya gaya — please confirm the amount.` : `Recorded: ${name} took ${inr(t.amount)} on udhaar${items}. Outstanding is now ${inr(c.outstanding_balance)}.`)
        : `Recorded cash sale of ${inr(t.amount)} for ${name}${items}.`;
      const low = (result.stock_updates || []).filter((s) => s.status !== "good");
      if (low.length) msg += " Stock alert: " + low.map((s) => `${s.product} ${s.remaining} ${s.unit} left`).join(", ") + ".";
      return msg;
    }
    case "create_or_update_customer_khata":
      return result.message + (result.customer.father_name ? ` Father name: ${result.customer.father_name}.` : "") + (result.transaction ? " " + format("add_transaction", result.transaction) : "");
    default: return JSON.stringify(result);
  }
}

function demoChat(message) {
  const text = (message || "").trim(); const low = text.toLowerCase();
  const known = customers.find((c) => new RegExp(`\\b${c.name.split(" ")[0].toLowerCase()}\\b`).test(low));
  let name = known?.name || (text.match(/\b([A-Z][a-z]+)\s+(?:ka|ki|ke|ne|se|has|owes|took)\b/) || [])[1] || null;
  const amtM = text.match(/(?:₹|rs\.?|rupees?|rupaye)?\s*(\d[\d,]*(?:\.\d+)?)/i); const amount = amtM ? parseFloat(amtM[1].replace(/,/g, "")) : null;
  const productAlias = Object.keys(ALIASES).find((a) => new RegExp(`\\b${a}\\b`).test(low));
  const product = productAlias ? ALIASES[productAlias] : products.find((p) => low.includes(p.name.toLowerCase()) || low.includes(p.name.toLowerCase().replace(/s$/, "")))?.name || null;
  const respond = (intent, tool, args, result) => ({ reply: format(tool, result), mode: "demo", intent, tool_calls: [{ name: tool, arguments: args, result }], data: result });

  if (/naya khata|new khata|new customer|khata banao|khata khol|add customer|create customer/.test(low)) {
    const fm = text.match(/father(?:'s)?\s*(?:name)?\s*(?:is|hai|:)?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/) || text.match(/(?:pita|papa)\s*(?:ka naam)?\s*([A-Za-z]+)/i);
    const pm = text.match(/\b(\d{10})\b/);
    if (!name) { const m = text.match(/\b([A-Za-z]+)\s+ka\s+naya/i); name = m ? m[1][0].toUpperCase() + m[1].slice(1) : null; }
    if (!name) return { reply: "Kis customer ka khata banana hai? e.g. 'Rahul ka naya khata banao'.", mode: "demo", intent: "create_customer", tool_calls: [], data: null };
    const ex = findCustomer(name); let created = false; let cust = ex;
    if (ex) { if (fm) ex.father_name = fm[1]; if (pm) ex.phone = pm[1]; }
    else { cust = { id: uid("cust"), shop_id: "shop_demo_001", name, father_name: fm ? fm[1] : null, phone: pm ? pm[1] : null, outstanding_balance: 0, created_at: new Date().toISOString() }; customers.push(cust); created = true; }
    const result = { customer: cust, created, message: created ? `New khata created for ${cust.name}.` : `${cust.name} already has a khata — reused existing record.` };
    return respond("create_customer", "create_or_update_customer_khata", { customer_name: name }, result);
  }
  if (name && /paise diye|diye|jama|payment|paid|chuka|wapas/.test(low) && amount && !/udhaar liya|leke gaya|le gaya/.test(low)) {
    const args = { customer_name: name, amount, transaction_type: "payment", items: [] };
    return respond("record_payment", "add_transaction", args, addTransaction(args));
  }
  if (/udhaar|udhar|leke gaya|le gaya|leke gayi|le gayi|liya|liye|took|bought|kharida|credit/.test(low) && name && !/kitna|dikhao|show/.test(low)) {
    const items = [];
    for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(kg|kilo|litre|liter|ltr|l|packet|packets|pkt|dozen)?\s+([a-zA-Z ]+?)(?=\s+(?:leke|le|liya|liye|diya|gaya|gayi|udhaar|aur|and|,|$))/gi)) {
      const p = findProduct(m[3].trim()); if (p) items.push({ product_name: p.name, quantity: parseFloat(m[1]), unit: m[2] || p.unit });
    }
    const args = { customer_name: name, items, transaction_type: /cash|nakad|paid/.test(low) && !/udhaar|udhar/.test(low) ? "cash" : "credit" };
    if (amount && (/(?:₹|rs|rupaye|rupees|ka saman|ka samaan|ka)\b/.test(low) || !items.length)) args.amount = amount;
    return respond("add_transaction", "add_transaction", args, addTransaction(args));
  }
  if (/zyada baki|se zyada|more than|above|greater|high credit|highest|sabse zyada|\d.*\bbaki/.test(low) && !name) {
    const args = { minimum_amount: amount || 1000 }; return respond("high_credit", "find_high_credit_customers", args, highCredit(args.minimum_amount));
  }
  if (/nahi aaye|nahi aaya|nahi aye|inactive|haven't come|not come|not visited|kaun nahi/.test(low)) {
    const m = low.match(/(\d+)\s*(?:din|days?)/); const args = { days: m ? parseInt(m[1]) : 10 };
    return respond("inactive_customers", "find_inactive_customers", args, inactive(args.days));
  }
  if (/sale|sales|bikri|kamai|revenue|aaj ka total|aaj kitna/.test(low) && !product) return respond("today_sales", "get_today_sales", {}, todaySales());
  if (/stock|inventory|kitna hai|kitna bacha|bacha hai|available|low stock|khatam/.test(low) || product) {
    const full = /low stock|kam stock|khatam|out of stock|attention|sab|all|pura|full|inventory dikhao/.test(low) && !product;
    const args = full || !product ? {} : { product_name: product };
    return local.inventory(args.product_name).then((r) => respond("inventory", "get_inventory", args, r));
  }
  if (name) { const c = findCustomer(name); const r = c ? khataFor(c) : { error: `Customer '${name}' not found.`, suggestions: customers.slice(0, 6).map((x) => x.name) }; return respond("customer_khata", "get_customer_khata", { customer_name: name }, r); }
  if (/^(hi|hello|hey|namaste|namaskar)/.test(low)) return { reply: "Namaste! Main GrowMate AI hoon. Pooch sakte hain: 'Ramesh ka khata dikhao', 'Aaj kitni sale hui?', 'Milk ka stock kitna hai?'.", mode: "demo", intent: "greeting", tool_calls: [], data: null };
  return { reply: "Demo AI mode me main samajh sakta hoon: customer khata, aaj ki sale, stock, zyada baki wale customers, inactive customers, udhaar/payment record karna aur naya khata banana. Example: 'Ramesh ka khata dikhao'.", mode: "demo", intent: "unknown", tool_calls: [], data: null };
}
