"""
AI tools for GrowMate AI.

Each tool is a plain Python function returning a JSON-serialisable dict.
Tools never raise for expected business errors — they return {"error": "..."}
so the agent can explain the problem to the shopkeeper.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional

import re

from repository import Repository, get_repository, now_ist

SALE_TYPES = ("credit", "cash")


def _repo() -> Repository:
    return get_repository()


def _days_since(iso_date: str) -> int:
    dt = datetime.fromisoformat(iso_date)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=now_ist().tzinfo)
    return max(0, (now_ist() - dt).days)


def _human_ago(iso_date: str) -> str:
    d = _days_since(iso_date)
    if d == 0:
        return "today"
    if d == 1:
        return "yesterday"
    return f"{d} days ago"


# --------------------------------------------------------------------------
# 1. get_customer_khata
# --------------------------------------------------------------------------
def get_customer_khata(customer_name: str) -> dict:
    """Return a customer's khata: outstanding, transaction history, last transaction."""
    if not customer_name or not customer_name.strip():
        return {"error": "Customer name is required."}
    repo = _repo()
    customer = repo.find_customer_by_name(customer_name)
    if not customer:
        suggestions = [c["name"] for c in repo.list_customers()[:6]]
        return {"error": f"Customer '{customer_name}' not found.", "suggestions": suggestions}

    history = repo.list_transactions(customer_id=customer["id"])
    last = history[0] if history else None
    month_start = now_ist().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = sum(t["amount"] for t in history
                     if t["transaction_type"] in SALE_TYPES
                     and datetime.fromisoformat(t["date"]) >= month_start)
    return {
        "customer": customer,
        "outstanding": customer["outstanding_balance"],
        "transactions": history[:20],
        "transaction_count": len(history),
        "last_transaction": last,
        "last_transaction_ago": _human_ago(last["date"]) if last else None,
        "days_since_last_transaction": _days_since(last["date"]) if last else None,
        "this_month_purchases": round(this_month, 2),
    }


# --------------------------------------------------------------------------
# 2. create_or_update_customer_khata
# --------------------------------------------------------------------------
def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Normalise an Indian mobile number: '+91-98989 89890' -> '9898989890'."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    return digits if len(digits) == 10 else ((str(raw).strip()) or None)


def _sql_khata_result(out: dict) -> dict:
    """Map the SQL function's jsonb result onto the app's tool result shape."""
    cust = out.get("customer") or {}
    created = bool(out.get("created"))
    name = cust.get("name") or "customer"
    message = (f"New khata created for {name}." if created
               else f"{name} already has a khata - reused existing record.")
    result = {"customer": cust, "created": created, "message": message, "source": "sql"}
    txn = out.get("transaction")
    if txn:
        result["transaction"] = {
            "transaction": txn,
            "customer": cust,
            "stock_updates": [],
            "warnings": [],
            "amount_missing": txn.get("payment_status") == "amount_missing",
        }
    return result


def create_or_update_customer_khata(customer_name: str,
                                    father_name: Optional[str] = None,
                                    phone: Optional[str] = None,
                                    amount: Optional[float] = None,
                                    items: Optional[List[dict]] = None,
                                    transaction_type: Optional[str] = None) -> dict:
    """
    Create the customer if they don't exist (never duplicate), optionally update
    father_name / phone, and optionally record a transaction in the same call.

    When the repository is Supabase AND the SQL function
    `create_or_update_customer_khata` (add_voice_khata_function.sql) is
    installed, the whole operation runs atomically server-side (one RPC).
    Otherwise the exact same logic below is used, so behaviour is identical.
    """
    if not customer_name or not customer_name.strip():
        return {"error": "Customer name is required."}
    customer_name = customer_name.strip()
    phone = normalize_phone(phone)

    repo = _repo()
    initial_type = (transaction_type or "none").lower()
    if initial_type not in ("none", "credit", "cash"):
        initial_type = "none"
    rpc = getattr(repo, "rpc_create_or_update_customer_khata", None)
    if rpc is not None:
        try:
            out = rpc(shop_id=repo.shop_id, name=customer_name,
                      father_name=father_name, phone=phone,
                      initial_type=initial_type, initial_amount=amount or 0,
                      items=items or [])
        except Exception as exc:
            import logging
            logging.warning("voice khata RPC failed (%s); using app fallback", exc)
            out = None
        if out:
            return _sql_khata_result(out)

    customer = repo.find_customer_by_name(customer_name)
    created = False
    if customer:
        if father_name or phone:
            customer = repo.update_customer(customer["id"], father_name=father_name, phone=phone)
    else:
        customer = repo.create_customer(customer_name.strip().title(), father_name, phone)
        created = True

    result = {"customer": customer, "created": created,
              "message": f"New khata created for {customer['name']}." if created
              else f"{customer['name']} already has a khata — reused existing record."}

    if (amount is not None and amount > 0) or items:
        txn = add_transaction(customer["name"], items or [], amount, transaction_type or "credit")
        result["transaction"] = txn
        if "customer" in txn:
            result["customer"] = txn["customer"]
    return result


# --------------------------------------------------------------------------
# 3. find_high_credit_customers
# --------------------------------------------------------------------------
def find_high_credit_customers(minimum_amount: float = 1000) -> dict:
    """Customers whose outstanding balance exceeds the threshold."""
    try:
        threshold = float(minimum_amount)
    except (TypeError, ValueError):
        threshold = 1000.0
    repo = _repo()
    rows = [c for c in repo.list_customers() if c["outstanding_balance"] > threshold]
    rows.sort(key=lambda c: c["outstanding_balance"], reverse=True)
    for c in rows:
        last = repo.last_transaction(c["id"])
        c["last_transaction_ago"] = _human_ago(last["date"]) if last else None
    return {"minimum_amount": threshold, "count": len(rows), "customers": rows,
            "total_outstanding": round(sum(c["outstanding_balance"] for c in rows), 2)}


# --------------------------------------------------------------------------
# 4. find_inactive_customers
# --------------------------------------------------------------------------
def find_inactive_customers(days: int = 10) -> dict:
    """Customers whose latest transaction is older than `days` (or who never transacted)."""
    try:
        days = int(days)
    except (TypeError, ValueError):
        days = 10
    repo = _repo()
    cutoff = now_ist() - timedelta(days=days)
    rows = []
    for c in repo.list_customers():
        last = repo.last_transaction(c["id"])
        if last is None:
            rows.append({**c, "last_transaction_date": None, "days_inactive": None,
                         "last_transaction_ago": "never"})
            continue
        last_dt = datetime.fromisoformat(last["date"])
        if last_dt < cutoff:
            rows.append({**c, "last_transaction_date": last["date"],
                         "days_inactive": _days_since(last["date"]),
                         "last_transaction_ago": _human_ago(last["date"])})
    rows.sort(key=lambda c: (c["days_inactive"] is None, -(c["days_inactive"] or 0)))
    return {"days": days, "count": len(rows), "customers": rows}


# --------------------------------------------------------------------------
# 5. get_inventory
# --------------------------------------------------------------------------
def get_inventory(product_name: Optional[str] = None) -> dict:
    """Full inventory, or a single product when product_name is given."""
    repo = _repo()
    if product_name and product_name.strip():
        p = repo.find_product_by_name(product_name)
        if not p:
            return {"error": f"Product '{product_name}' not found.",
                    "available_products": [x["name"] for x in repo.list_products()]}
        return {"product": p, "products": [p], "status": p["status"]}
    products = repo.list_products()
    summary = {
        "total": len(products),
        "good": sum(1 for p in products if p["status"] == "good"),
        "low": sum(1 for p in products if p["status"] == "low"),
        "out": sum(1 for p in products if p["status"] == "out"),
    }
    return {"products": products, "summary": summary,
            "needs_attention": [p for p in products if p["status"] != "good"]}


# --------------------------------------------------------------------------
# 6. get_today_sales
# --------------------------------------------------------------------------
def get_today_sales() -> dict:
    """Today's sale transactions (cash + credit), total, count and average."""
    repo = _repo()
    txns = repo.today_transactions()
    sales = [t for t in txns if t["transaction_type"] in SALE_TYPES]
    payments = [t for t in txns if t["transaction_type"] == "payment"]
    total = round(sum(t["amount"] for t in sales), 2)
    cash_total = round(sum(t["amount"] for t in sales if t["transaction_type"] == "cash"), 2)
    credit_total = round(sum(t["amount"] for t in sales if t["transaction_type"] == "credit"), 2)
    return {
        "date": now_ist().date().isoformat(),
        "total": total,
        "cash_total": cash_total,
        "credit_total": credit_total,
        "payments_received": round(sum(t["amount"] for t in payments), 2),
        "transaction_count": len(sales),
        "average_sale": round(total / len(sales), 2) if sales else 0,
        "transactions": sales,
    }


# --------------------------------------------------------------------------
# 7. add_transaction
# --------------------------------------------------------------------------
def add_transaction(customer_name: Optional[str],
                    items: Optional[List[dict]] = None,
                    amount: Optional[float] = None,
                    transaction_type: str = "credit",
                    notes: Optional[str] = None) -> dict:
    """
    Record a transaction and update customer balance + inventory.

    transaction_type:
      credit  -> customer took goods on udhaar: outstanding += amount, stock reduced
      cash    -> paid sale: stock reduced, balance unchanged
      payment -> customer paid back: outstanding -= amount
    Prices are NEVER invented: if neither `amount` nor per-item prices were
    given, we use the shop's catalogue price when the product is known;
    otherwise the transaction is stored with payment_status = "amount_missing".
    """
    repo = _repo()
    transaction_type = (transaction_type or "credit").lower().strip()
    if transaction_type in ("udhaar", "udhar", "borrow", "loan"):
        transaction_type = "credit"
    if transaction_type in ("paid", "repayment", "jama"):
        transaction_type = "payment"
    if transaction_type not in ("credit", "cash", "payment"):
        return {"error": f"Invalid transaction_type '{transaction_type}'. Use credit, cash or payment."}

    customer = None
    if customer_name and customer_name.strip():
        customer = repo.find_customer_by_name(customer_name)
        if not customer:
            return {"error": f"Customer '{customer_name}' not found.",
                    "hint": "Create the khata first with create_or_update_customer_khata.",
                    "suggestions": [c["name"] for c in repo.list_customers()[:6]]}
    elif transaction_type in ("credit", "payment"):
        return {"error": "A customer name is required for credit or payment transactions."}

    # ---- resolve items ----
    item_rows, warnings, computed_total, all_priced = [], [], 0.0, True
    for it in items or []:
        name = (it.get("product_name") or it.get("name") or "").strip()
        try:
            qty = float(it.get("quantity") or 1)
        except (TypeError, ValueError):
            qty = 1.0
        price = it.get("price")
        product = repo.find_product_by_name(name) if name else None
        unit = it.get("unit") or (product["unit"] if product else None)
        if price is None and product and product.get("price") is not None:
            price = product["price"]
        if price is None:
            all_priced = False
            warnings.append(f"Price for '{name}' was not specified.")
        else:
            computed_total += qty * float(price)
        if not product:
            warnings.append(f"Product '{name}' is not in inventory — recorded without stock update.")
        item_rows.append({"product_id": product["id"] if product else None,
                          "product_name": product["name"] if product else name,
                          "quantity": qty, "unit": unit, "price": price})

    # ---- resolve amount ----
    payment_status = "paid" if transaction_type in ("cash", "payment") else "pending"
    if amount is None or float(amount) <= 0:
        if item_rows and all_priced:
            amount = round(computed_total, 2)
            warnings.append("Amount computed from shop catalogue prices.")
        elif transaction_type == "payment":
            return {"error": "Payment amount is required."}
        else:
            amount = 0.0
            payment_status = "amount_missing"
            warnings.append("Amount not supplied — quantity recorded, please add the price later.")
    amount = round(float(amount), 2)

    # ---- persist ----
    try:
        txn = repo.create_transaction(customer["id"] if customer else None, amount,
                                      transaction_type, payment_status, notes, item_rows)
        if customer and transaction_type == "credit" and amount > 0:
            customer = repo.adjust_customer_balance(customer["id"], amount)
        elif customer and transaction_type == "payment":
            customer = repo.adjust_customer_balance(customer["id"], -amount)
        stock_updates = []
        if transaction_type in SALE_TYPES:
            for it in item_rows:
                if it["product_id"]:
                    p = repo.adjust_product_quantity(it["product_id"], -it["quantity"])
                    if p:
                        stock_updates.append({"product": p["name"], "remaining": p["quantity"],
                                              "unit": p["unit"], "status": p["status"]})
    except Exception as exc:  # never crash the server for a data error
        return {"error": f"Could not record transaction: {exc}"}

    return {"transaction": txn, "customer": customer, "stock_updates": stock_updates,
            "warnings": warnings, "amount_missing": payment_status == "amount_missing"}


# --------------------------------------------------------------------------
# Extra analytics helper (used by the API + agent summaries)
# --------------------------------------------------------------------------
def get_business_summary() -> dict:
    repo = _repo()
    customers = repo.list_customers()
    products = repo.list_products()
    today = get_today_sales()
    return {
        "shop_id": repo.shop_id,
        "today_sales": today["total"],
        "today_transaction_count": today["transaction_count"],
        "today_average_sale": today["average_sale"],
        "outstanding_total": round(sum(c["outstanding_balance"] for c in customers), 2),
        "customers_with_dues": sum(1 for c in customers if c["outstanding_balance"] > 0),
        "customer_count": len(customers),
        "low_stock_count": sum(1 for p in products if p["status"] == "low"),
        "out_of_stock_count": sum(1 for p in products if p["status"] == "out"),
        "recent_transactions": repo.list_transactions(limit=8),
    }


# Responses-API function-calling schemas (GROQ / OpenAI Responses API) ----------
# Format is flat: {"type": "function", "name", "description", "parameters"}.
TOOL_SCHEMAS = [
    {"type": "function",
     "name": "get_customer_khata",
     "description": "Get a customer's khata (ledger): outstanding balance, transaction history and last transaction. Use for 'X ka khata dikhao', 'X ka kitna baki hai', 'X ki history'.",
     "parameters": {"type": "object", "properties": {
         "customer_name": {"type": "string", "description": "Customer name, e.g. 'Ramesh'"}},
         "required": ["customer_name"]}},
    {"type": "function",
     "name": "create_or_update_customer_khata",
     "description": "Create or update a customer khata (never duplicates - reuses an existing customer case-insensitively), e.g. \"X ka naya khata banao\", \"new customer\", \"add customer X\", \"X ka khata kholo\". Optionally set father_name (from \"s/o Y\", \"father name Y\", \"Y ka beta\") and phone (10 digits, may include +91 / spaces - the tool normalises it). Optionally record an initial transaction in the same call via amount + transaction_type (credit = udhaar taken, cash = paid sale).",
     "parameters": {"type": "object", "properties": {
         "customer_name": {"type": "string"},
         "father_name": {"type": "string"},
         "phone": {"type": "string"},
         "amount": {"type": "number", "description": "Only if the user explicitly stated an amount"},
         "items": {"type": "array", "items": {"type": "object", "properties": {
             "product_name": {"type": "string"}, "quantity": {"type": "number"},
             "unit": {"type": "string"}, "price": {"type": "number"}},
             "required": ["product_name", "quantity"]}},
         "transaction_type": {"type": "string", "enum": ["credit", "cash", "payment"]}},
         "required": ["customer_name"]}},
    {"type": "function",
     "name": "find_high_credit_customers",
     "description": "List customers whose outstanding (baki/udhaar) balance is more than a threshold amount.",
     "parameters": {"type": "object", "properties": {
         "minimum_amount": {"type": "number", "description": "Threshold in rupees, default 1000"}},
         "required": []}},
    {"type": "function",
     "name": "find_inactive_customers",
     "description": "List regular customers who have not made any transaction in the last N days.",
     "parameters": {"type": "object", "properties": {
         "days": {"type": "integer", "description": "Number of days, default 10"}},
         "required": []}},
    {"type": "function",
     "name": "get_inventory",
     "description": "Get stock information for the whole shop or a single product (e.g. 'Milk ka stock kitna hai').",
     "parameters": {"type": "object", "properties": {
         "product_name": {"type": "string", "description": "Optional product name"}},
         "required": []}},
    {"type": "function",
     "name": "get_today_sales",
     "description": "Get today's sales total, transaction count, average and list of sales.",
     "parameters": {"type": "object", "properties": {}, "required": []}},
    {"type": "function",
     "name": "add_transaction",
     "description": "Record a transaction for an existing customer. credit = goods taken on udhaar (outstanding increases), cash = paid sale, payment = customer paid money back (outstanding decreases). Reduces inventory for sold items. Never guess prices: only pass amount/price if the user said them.",
     "parameters": {"type": "object", "properties": {
         "customer_name": {"type": "string"},
         "items": {"type": "array", "items": {"type": "object", "properties": {
             "product_name": {"type": "string"}, "quantity": {"type": "number"},
             "unit": {"type": "string"}, "price": {"type": "number"}},
             "required": ["product_name", "quantity"]}},
         "amount": {"type": "number"},
         "transaction_type": {"type": "string", "enum": ["credit", "cash", "payment"]},
         "notes": {"type": "string"}},
         "required": ["transaction_type"]}},
]

TOOL_FUNCTIONS = {
    "get_customer_khata": get_customer_khata,
    "create_or_update_customer_khata": create_or_update_customer_khata,
    "find_high_credit_customers": find_high_credit_customers,
    "find_inactive_customers": find_inactive_customers,
    "get_inventory": get_inventory,
    "get_today_sales": get_today_sales,
    "add_transaction": add_transaction,
}


def run_tool(name: str, arguments: dict) -> dict:
    """Safely execute a tool by name. Never raises."""
    fn = TOOL_FUNCTIONS.get(name)
    if not fn:
        return {"error": f"Unknown tool '{name}'."}
    try:
        return fn(**(arguments or {}))
    except TypeError as exc:
        return {"error": f"Invalid arguments for {name}: {exc}"}
    except Exception as exc:
        return {"error": f"Tool {name} failed: {exc}"}
