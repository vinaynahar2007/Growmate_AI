"""
Repository layer for GrowMate AI.

The AI tools (tools.py) only talk to the abstract `Repository` interface.
`InMemoryRepository` is used by default with realistic demo data.
`SupabaseRepository` implements the same interface on top of Supabase/Postgres
(see supabase/schema.sql). Switching backends does not change tools or agent.
"""
from __future__ import annotations

import json
import re
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from config import settings

IST = timezone(timedelta(hours=5, minutes=30))


def now_ist() -> datetime:
    return datetime.now(IST)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _norm(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def stock_status(quantity: float, minimum_stock: float) -> str:
    if quantity <= 0:
        return "out"
    if quantity <= minimum_stock:
        return "low"
    return "good"


# --------------------------------------------------------------------------
# Abstract interface
# --------------------------------------------------------------------------
class Repository(ABC):
    """Every method returns plain dicts so tools and API stay backend agnostic."""

    # ---- customers ----
    @abstractmethod
    def list_customers(self, search: Optional[str] = None) -> List[dict]: ...

    @abstractmethod
    def get_customer(self, customer_id: str) -> Optional[dict]: ...

    @abstractmethod
    def find_customer_by_name(self, name: str) -> Optional[dict]: ...

    @abstractmethod
    def create_customer(self, name: str, father_name: Optional[str] = None,
                        phone: Optional[str] = None) -> dict: ...

    @abstractmethod
    def update_customer(self, customer_id: str, **fields) -> Optional[dict]: ...

    @abstractmethod
    def adjust_customer_balance(self, customer_id: str, delta: float) -> Optional[dict]: ...

    # ---- products ----
    @abstractmethod
    def list_products(self, search: Optional[str] = None) -> List[dict]: ...

    @abstractmethod
    def get_product(self, product_id: str) -> Optional[dict]: ...

    @abstractmethod
    def find_product_by_name(self, name: str) -> Optional[dict]: ...

    @abstractmethod
    def adjust_product_quantity(self, product_id: str, delta: float) -> Optional[dict]: ...

    # ---- transactions ----
    @abstractmethod
    def list_transactions(self, customer_id: Optional[str] = None,
                          since: Optional[datetime] = None,
                          limit: Optional[int] = None) -> List[dict]: ...

    @abstractmethod
    def create_transaction(self, customer_id: Optional[str], amount: float,
                           transaction_type: str, payment_status: str,
                           notes: Optional[str], items: List[dict],
                           date: Optional[datetime] = None) -> dict: ...

    # ---- helpers shared by both implementations ----
    def last_transaction(self, customer_id: str) -> Optional[dict]:
        txns = self.list_transactions(customer_id=customer_id, limit=1)
        return txns[0] if txns else None

    def today_transactions(self) -> List[dict]:
        start = now_ist().replace(hour=0, minute=0, second=0, microsecond=0)
        return self.list_transactions(since=start)


# --------------------------------------------------------------------------
# In-memory implementation with demo data
# --------------------------------------------------------------------------
HINDI_PRODUCT_ALIASES = {
    "doodh": "milk", "dudh": "milk",
    "chawal": "rice", "chaval": "rice",
    "atta": "wheat", "gehu": "wheat", "gehun": "wheat", "aata": "wheat",
    "cheeni": "sugar", "chini": "sugar", "shakkar": "sugar",
    "tel": "cooking oil", "oil": "cooking oil",
    "daal": "dal", "dal": "dal",
    "chai": "tea", "chai patti": "tea",
    "biscuit": "biscuits", "biskut": "biscuits",
}


class InMemoryRepository(Repository):
    def __init__(self, shop_id: str = settings.SHOP_ID, seed: bool = True):
        self.shop_id = shop_id
        self.customers: Dict[str, dict] = {}
        self.products: Dict[str, dict] = {}
        self.transactions: Dict[str, dict] = {}
        if seed:
            self._seed()

    # ---------- customers ----------
    def list_customers(self, search: Optional[str] = None) -> List[dict]:
        rows = [dict(c) for c in self.customers.values()]
        if search:
            q = _norm(search)
            rows = [c for c in rows if q in _norm(c["name"]) or q in _norm(c.get("phone"))
                    or q in _norm(c.get("father_name"))]
        return sorted(rows, key=lambda c: c["name"])

    def get_customer(self, customer_id: str) -> Optional[dict]:
        c = self.customers.get(customer_id)
        return dict(c) if c else None

    def find_customer_by_name(self, name: str) -> Optional[dict]:
        q = _norm(name)
        if not q:
            return None
        # 1. exact match
        for c in self.customers.values():
            if _norm(c["name"]) == q:
                return dict(c)
        # 2. first-name match ("Ramesh" -> "Ramesh Kumar")
        for c in self.customers.values():
            parts = _norm(c["name"]).split(" ")
            if parts and parts[0] == q:
                return dict(c)
        # 3. contains
        for c in self.customers.values():
            if q in _norm(c["name"]) or _norm(c["name"]) in q:
                return dict(c)
        return None

    def create_customer(self, name, father_name=None, phone=None) -> dict:
        cid = _new_id("cust")
        row = {
            "id": cid, "shop_id": self.shop_id, "name": name.strip(),
            "father_name": (father_name or "").strip() or None,
            "phone": (phone or "").strip() or None,
            "outstanding_balance": 0.0, "created_at": _iso(now_ist()),
        }
        self.customers[cid] = row
        return dict(row)

    def update_customer(self, customer_id, **fields) -> Optional[dict]:
        c = self.customers.get(customer_id)
        if not c:
            return None
        for k, v in fields.items():
            if v is not None and k in ("name", "father_name", "phone"):
                c[k] = v.strip() or None
        return dict(c)

    def adjust_customer_balance(self, customer_id, delta) -> Optional[dict]:
        c = self.customers.get(customer_id)
        if not c:
            return None
        c["outstanding_balance"] = round(c["outstanding_balance"] + delta, 2)
        return dict(c)

    # ---------- products ----------
    def _with_status(self, p: dict) -> dict:
        row = dict(p)
        row["status"] = stock_status(row["quantity"], row["minimum_stock"])
        return row

    def list_products(self, search=None) -> List[dict]:
        rows = [self._with_status(p) for p in self.products.values()]
        if search:
            q = HINDI_PRODUCT_ALIASES.get(_norm(search), _norm(search))
            rows = [p for p in rows if q in _norm(p["name"])]
        return sorted(rows, key=lambda p: p["name"])

    def get_product(self, product_id) -> Optional[dict]:
        p = self.products.get(product_id)
        return self._with_status(p) if p else None

    def find_product_by_name(self, name) -> Optional[dict]:
        q = _norm(name)
        if not q:
            return None
        q = HINDI_PRODUCT_ALIASES.get(q, q)
        for p in self.products.values():
            if _norm(p["name"]) == q:
                return self._with_status(p)
        for p in self.products.values():
            if q in _norm(p["name"]) or _norm(p["name"]) in q:
                return self._with_status(p)
        # singular / plural tolerance
        for p in self.products.values():
            if _norm(p["name"]).rstrip("s") == q.rstrip("s"):
                return self._with_status(p)
        return None

    def adjust_product_quantity(self, product_id, delta) -> Optional[dict]:
        p = self.products.get(product_id)
        if not p:
            return None
        p["quantity"] = round(max(0.0, p["quantity"] + delta), 3)
        return self._with_status(p)

    # ---------- transactions ----------
    def list_transactions(self, customer_id=None, since=None, limit=None) -> List[dict]:
        rows = list(self.transactions.values())
        if customer_id:
            rows = [t for t in rows if t["customer_id"] == customer_id]
        if since:
            rows = [t for t in rows if datetime.fromisoformat(t["date"]) >= since]
        rows.sort(key=lambda t: t["date"], reverse=True)
        if limit:
            rows = rows[:limit]
        return [self._decorate_txn(t) for t in rows]

    def _decorate_txn(self, t: dict) -> dict:
        row = dict(t)
        row["items"] = [dict(i) for i in t.get("items", [])]
        cust = self.customers.get(t["customer_id"]) if t.get("customer_id") else None
        row["customer_name"] = cust["name"] if cust else "Walk-in customer"
        return row

    def create_transaction(self, customer_id, amount, transaction_type, payment_status,
                           notes, items, date=None) -> dict:
        tid = _new_id("txn")
        item_rows = []
        for it in items or []:
            item_rows.append({
                "id": _new_id("item"), "transaction_id": tid,
                "product_id": it.get("product_id"), "product_name": it.get("product_name"),
                "quantity": float(it.get("quantity") or 0), "unit": it.get("unit"),
                "price": it.get("price"),
            })
        row = {
            "id": tid, "shop_id": self.shop_id, "customer_id": customer_id,
            "date": _iso(date or now_ist()), "amount": round(float(amount or 0), 2),
            "transaction_type": transaction_type, "payment_status": payment_status,
            "notes": notes, "items": item_rows,
        }
        self.transactions[tid] = row
        return self._decorate_txn(row)

    # ---------- demo data ----------
    def _seed(self):
        today = now_ist().replace(hour=10, minute=30, second=0, microsecond=0)

        def days_ago(n: int, hour: int = 11, minute: int = 15) -> datetime:
            return (today - timedelta(days=n)).replace(hour=hour, minute=minute)

        products = [
            ("Rice", 42, "kg", 58, 15),
            ("Wheat", 30, "kg", 34, 20),
            ("Sugar", 8, "kg", 44, 10),
            ("Milk", 6, "litre", 62, 12),
            ("Cooking Oil", 14, "litre", 148, 6),
            ("Dal", 0, "kg", 128, 8),
            ("Tea", 22, "packet", 55, 10),
            ("Biscuits", 4, "packet", 10, 20),
        ]
        for name, qty, unit, price, min_stock in products:
            pid = _new_id("prod")
            self.products[pid] = {
                "id": pid, "shop_id": self.shop_id, "name": name, "quantity": float(qty),
                "unit": unit, "price": float(price), "minimum_stock": float(min_stock),
            }

        customers = [
            ("Ramesh Kumar", "Mohan Kumar", "9876543210"),
            ("Rahul Verma", "Vikash Verma", "9812345678"),
            ("Priya Sharma", "Suresh Sharma", "9898989898"),
            ("Amit Singh", "Rajendra Singh", "9765432109"),
            ("Neha Gupta", "Anil Gupta", "9654321098"),
            ("Suresh Yadav", "Ram Yadav", "9543210987"),
        ]
        by_name = {}
        for i, (name, father, phone) in enumerate(customers):
            c = self.create_customer(name, father, phone)
            c_row = self.customers[c["id"]]
            c_row["created_at"] = _iso(days_ago(60 - i * 5))
            by_name[name.split()[0]] = c["id"]

        P = {p["name"]: p for p in self.products.values()}

        def item(name, qty, price=None):
            p = P[name]
            return {"product_id": p["id"], "product_name": p["name"], "quantity": qty,
                    "unit": p["unit"], "price": p["price"] if price is None else price}

        # (customer, days_ago, amount, type, items, notes)
        history = [
            # Ramesh -> outstanding 2450, last txn 4 days ago
            ("Ramesh", 26, 900, "credit", [item("Rice", 10), item("Sugar", 5)], "Monthly ration"),
            ("Ramesh", 22, 900, "payment", [], "Paid in cash"),
            ("Ramesh", 12, 1200, "credit", [item("Cooking Oil", 5), item("Wheat", 10)], None),
            ("Ramesh", 7, 1800, "credit", [item("Rice", 20), item("Dal", 5)], "Wedding order"),
            ("Ramesh", 4, 550, "payment", [], "Part payment via UPI"),
            # Rahul -> outstanding 800, last txn today (cash)
            ("Rahul", 18, 500, "credit", [item("Tea", 4), item("Biscuits", 10)], None),
            ("Rahul", 14, 500, "payment", [], None),
            ("Rahul", 2, 800, "credit", [item("Cooking Oil", 3), item("Sugar", 3)], None),
            ("Rahul", 0, 450, "cash", [item("Milk", 4), item("Biscuits", 5)], None),
            # Priya -> outstanding 1500, inactive 13 days
            ("Priya", 15, 2200, "credit", [item("Rice", 25), item("Dal", 4)], "Festival stock"),
            ("Priya", 13, 700, "payment", [], None),
            # Amit -> outstanding 400, active today
            ("Amit", 9, 380, "cash", [item("Milk", 3), item("Tea", 2)], None),
            ("Amit", 5, 400, "credit", [item("Sugar", 5), item("Biscuits", 10)], None),
            ("Amit", 0, 350, "cash", [item("Wheat", 10)], None),
            # Neha -> outstanding 600, inactive 20 days
            ("Neha", 34, 1200, "credit", [item("Cooking Oil", 5), item("Rice", 5)], None),
            ("Neha", 28, 1200, "payment", [], "Cleared old dues"),
            ("Neha", 20, 600, "credit", [item("Dal", 3), item("Tea", 2)], None),
            # Suresh -> outstanding 2000, last txn 8 days ago
            ("Suresh", 9, 3000, "credit", [item("Rice", 30), item("Wheat", 20), item("Cooking Oil", 4)], "Bulk order"),
            ("Suresh", 8, 1000, "payment", [], None),
            # Walk-in cash sale today
            (None, 0, 620, "cash", [item("Cooking Oil", 2), item("Tea", 3), item("Milk", 2)], "Walk-in"),
        ]
        for idx, (cust, d, amt, ttype, items, notes) in enumerate(history):
            cid = by_name[cust] if cust else None
            status = "paid" if ttype in ("cash", "payment") else "pending"
            hour = 9 + (idx % 8)
            self.create_transaction(cid, amt, ttype, status, notes, items, date=days_ago(d, hour, (idx * 7) % 60))
            if cid:
                if ttype == "credit":
                    self.adjust_customer_balance(cid, amt)
                elif ttype == "payment":
                    self.adjust_customer_balance(cid, -amt)


# --------------------------------------------------------------------------
# Supabase implementation (same interface)
# --------------------------------------------------------------------------
class SupabaseRepository(Repository):
    """
    Uses supabase-py against the tables in supabase/schema.sql.
    Only instantiated when SUPABASE_URL and SUPABASE_KEY are configured.
    """

    def __init__(self, url: str, key: str, shop_id: str = settings.SHOP_ID):
        from supabase import create_client  # imported lazily so demo mode has no hard dependency
        self.client = create_client(url, key)
        self.shop_id = shop_id

    # ---- customers ----
    def list_customers(self, search=None):
        q = self.client.table("customers").select("*").eq("shop_id", self.shop_id)
        if search:
            q = q.ilike("name", f"%{search}%")
        return q.order("name").execute().data or []

    def get_customer(self, customer_id):
        res = self.client.table("customers").select("*").eq("id", customer_id).limit(1).execute()
        return res.data[0] if res.data else None

    def find_customer_by_name(self, name):
        q = _norm(name)
        if not q:
            return None
        res = self.client.table("customers").select("*").eq("shop_id", self.shop_id) \
            .ilike("name", f"%{q}%").execute()
        rows = res.data or []
        for c in rows:
            if _norm(c["name"]) == q or _norm(c["name"]).split(" ")[0] == q:
                return c
        return rows[0] if rows else None

    def create_customer(self, name, father_name=None, phone=None):
        payload = {"shop_id": self.shop_id, "name": name.strip(),
                   "father_name": (father_name or "").strip() or None,
                   "phone": (phone or "").strip() or None, "outstanding_balance": 0}
        return self.client.table("customers").insert(payload).execute().data[0]

    def update_customer(self, customer_id, **fields):
        payload = {k: v for k, v in fields.items() if v is not None}
        if not payload:
            return self.get_customer(customer_id)
        res = self.client.table("customers").update(payload).eq("id", customer_id).execute()
        return res.data[0] if res.data else None

    def adjust_customer_balance(self, customer_id, delta):
        c = self.get_customer(customer_id)
        if not c:
            return None
        new_bal = round(float(c["outstanding_balance"]) + delta, 2)
        return self.update_customer(customer_id, outstanding_balance=new_bal)

    # ---- products ----
    def _with_status(self, p):
        p = dict(p)
        p["status"] = stock_status(float(p["quantity"]), float(p["minimum_stock"]))
        return p

    def list_products(self, search=None):
        q = self.client.table("products").select("*").eq("shop_id", self.shop_id)
        if search:
            q = q.ilike("name", f"%{HINDI_PRODUCT_ALIASES.get(_norm(search), search)}%")
        return [self._with_status(p) for p in (q.order("name").execute().data or [])]

    def get_product(self, product_id):
        res = self.client.table("products").select("*").eq("id", product_id).limit(1).execute()
        return self._with_status(res.data[0]) if res.data else None

    def find_product_by_name(self, name):
        rows = self.list_products(search=name)
        return rows[0] if rows else None

    def adjust_product_quantity(self, product_id, delta):
        p = self.get_product(product_id)
        if not p:
            return None
        qty = max(0.0, float(p["quantity"]) + delta)
        res = self.client.table("products").update({"quantity": qty}).eq("id", product_id).execute()
        return self._with_status(res.data[0]) if res.data else None

    # ---- transactions ----
    def list_transactions(self, customer_id=None, since=None, limit=None):
        q = self.client.table("transactions").select("*, transaction_items(*), customers(name)") \
            .eq("shop_id", self.shop_id).order("date", desc=True)
        if customer_id:
            q = q.eq("customer_id", customer_id)
        if since:
            q = q.gte("date", since.isoformat())
        if limit:
            q = q.limit(limit)
        rows = []
        for t in q.execute().data or []:
            t = dict(t)
            t["items"] = t.pop("transaction_items", []) or []
            cust = t.pop("customers", None)
            t["customer_name"] = cust["name"] if cust else "Walk-in customer"
            rows.append(t)
        return rows

    def create_transaction(self, customer_id, amount, transaction_type, payment_status,
                           notes, items, date=None):
        payload = {"shop_id": self.shop_id, "customer_id": customer_id,
                   "date": (date or now_ist()).isoformat(), "amount": float(amount or 0),
                   "transaction_type": transaction_type, "payment_status": payment_status,
                   "notes": notes}
        txn = self.client.table("transactions").insert(payload).execute().data[0]
        if items:
            item_rows = [{"transaction_id": txn["id"], "product_id": it.get("product_id"),
                          "product_name": it.get("product_name"), "quantity": it.get("quantity"),
                          "unit": it.get("unit"), "price": it.get("price")} for it in items]
            self.client.table("transaction_items").insert(item_rows).execute()
        txn["items"] = items
        return txn

    # ---- voice-friendly khata (atomic SQL function) ----
    def rpc_create_or_update_customer_khata(self, *, shop_id=None, name=None,
                                            father_name=None, phone=None,
                                            initial_type="none", initial_amount=0,
                                            items=None, note=None):
        """Call the `create_or_update_customer_khata` SQL function (see
        supabase/migrations/add_voice_khata_function.sql).

        Everything (customer upsert + optional transaction + items + stock +
        balance) happens atomically server-side. Returns the function's jsonb
        result as a dict, or raises on failure so tools.py can fall back.
        """
        safe_items = []
        for it in (items or []):
            try:
                qty = float(it.get("quantity") or 1)
            except (TypeError, ValueError):
                qty = 1.0
            safe_items.append({
                "product_name": it.get("product_name") or it.get("name"),
                "quantity": qty,
                "unit": it.get("unit"),
                "unit_price": it.get("price"),
                "line_total": it.get("line_total"),
            })
        payload = {
            "p_shop_id": shop_id or self.shop_id,
            "p_name": name,
            "p_initial_type": (initial_type or "none").lower(),
            "p_initial_amount": float(initial_amount or 0),
            "p_items": json.dumps(safe_items, ensure_ascii=False, default=str),
            "p_note": note,
        }
        if father_name:
            payload["p_father_name"] = father_name
        if phone:
            payload["p_phone"] = phone
        res = self.client.rpc("create_or_update_customer_khata", payload).execute()
        data = res.data
        if isinstance(data, list):
            data = data[0] if data else None
        if isinstance(data, dict):
            return data
        return {"error": "Unexpected RPC response from create_or_update_customer_khata."}


# --------------------------------------------------------------------------
# Factory
# --------------------------------------------------------------------------
_repo: Optional[Repository] = None


def get_repository() -> Repository:
    global _repo
    if _repo is None:
        if settings.supabase_enabled:
            try:
                _repo = SupabaseRepository(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                print("[GrowMate] Using SupabaseRepository")
            except Exception as exc:  # fall back safely
                print(f"[GrowMate] Supabase init failed ({exc}); using in-memory demo data")
                _repo = InMemoryRepository()
        else:
            _repo = InMemoryRepository()
            print("[GrowMate] Using InMemoryRepository with demo data")
    return _repo
