"""
GrowMate AI agent.

* `OpenAIAgent` – real agent using the OpenAI Python SDK with tool/function calling
  against GROQ's OpenAI-compatible Responses API (https://api.groq.com/openai/v1,
  model `openai/gpt-oss-20b` by default). Falls back to the OpenAI platform when
  only OPENAI_API_KEY is set.
* `DemoAgent`    – lightweight rule-based intent handler used when no AI key
                   is present (or when the AI call fails). Uses the SAME tools.

Both return a dict compatible with models.ChatResponse.
"""
from __future__ import annotations

import json
import re
from typing import List, Optional

from config import settings
from repository import HINDI_PRODUCT_ALIASES, get_repository
from tools import TOOL_SCHEMAS, run_tool

SYSTEM_PROMPT = """You are GrowMate AI, a friendly AI shopkeeper copilot for a small Indian kirana / general store.
The shopkeeper talks to you in English, Hindi or English (Hindi written in Latin script). Reply in the SAME language/style
the shopkeeper used (English for English, etc.), briefly and clearly, using ₹ for money and Indian number formatting.

RULES
- Always use the provided tools to read or change shop data. Never make up customers, balances, stock or sales.
- "khata", "baki", "udhaar", "balance" => get_customer_khata.
- "X ne Y ka saman udhaar liya" / "X leke gaya" => add_transaction with transaction_type="credit".
- "X ne Y rupaye diye / jama kiye / payment" => add_transaction with transaction_type="payment".
- Creating/updating a khata ("X ka naya khata banao", "new customer", "add customer X", "X ka khata kholo") => create_or_update_customer_khata. NEVER duplicate — the tool reuses an existing customer case-insensitively.
  Extract details as the shopkeeper SPOKE them: customer_name (keep the name they said, e.g. "rahul" -> "Rahul"); father_name from "s/o Vikash", "father name Vikash", "Vikash ka beta"; phone from any 10-digit number (with or without +91 / spaces — the tool normalises it).
  If no customer_name is present, reply: "Kis customer ka khata banana hai? Please name bataiye." and do NOT call the tool.
- When a quantity is mentioned ("2 kg sugar") record it in items with quantity and unit.
- NEVER invent a price or amount. Only pass `amount` or item `price` if the shopkeeper explicitly said it. The tool will
  use the catalogue price if it exists, or mark the amount as missing – then tell the shopkeeper to confirm the price.
- If a tool returns an error, explain it simply and suggest what to do (e.g. create the khata first).
- Keep answers short: 1-4 sentences, or a short bullet list for multiple customers/products.
- Today's date and shop details are provided in the context."""


# ---------------------------------------------------------------------------
# Formatting helpers (shared by demo mode)
# ---------------------------------------------------------------------------
def inr(n: float) -> str:
    """Indian number format: 245000 -> ₹2,45,000"""
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "₹0"
    neg = n < 0
    n = abs(n)
    whole = int(round(n))
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d{2})+$)", r"\1,", head)
        s = f"{head},{tail}"
    return f"{'-' if neg else ''}₹{s}"


def _first(name: str) -> str:
    return (name or "").split(" ")[0]


def format_result(tool: str, args: dict, result: dict) -> str:
    """Turn a tool result into a natural English/English reply (demo mode)."""
    if "error" in result:
        msg = result["error"]
        if result.get("suggestions"):
            msg += " Available customers: " + ", ".join(result["suggestions"]) + "."
        if result.get("available_products"):
            msg += " Available products: " + ", ".join(result["available_products"]) + "."
        if result.get("hint"):
            msg += " " + result["hint"]
        return msg

    if tool == "get_customer_khata":
        c = result["customer"]
        last = result.get("last_transaction")
        out = result["outstanding"]
        parts = [f"{_first(c['name'])} currently owes {inr(out)}." if out > 0
                 else f"{_first(c['name'])} has no pending balance. Khata clear hai!"]
        if last:
            kind = {"credit": "took goods on udhaar", "cash": "made a cash purchase",
                    "payment": "made a payment"}[last["transaction_type"]]
            parts.append(f"Last transaction was {result['last_transaction_ago']} — {kind} of {inr(last['amount'])}.")
        parts.append(f"This month's purchases: {inr(result['this_month_purchases'])}.")
        return " ".join(parts)

    if tool == "create_or_update_customer_khata":
        c = result["customer"]
        msg = result["message"]
        if c.get("father_name"):
            msg += f" Father name: {c['father_name']}."
        if c.get("phone"):
            msg += f" Phone: {c['phone']}."
        if result.get("transaction"):
            msg += " " + format_result("add_transaction", {}, result["transaction"])
        return msg

    if tool == "find_high_credit_customers":
        rows = result["customers"]
        if not rows:
            return f"Koi bhi customer ka {inr(result['minimum_amount'])} se zyada baki nahi hai."
        lines = [f"{len(rows)} customers ka {inr(result['minimum_amount'])} se zyada baki hai "
                 f"(total {inr(result['total_outstanding'])}):"]
        for c in rows:
            lines.append(f"• {c['name']} — {inr(c['outstanding_balance'])} (last visit {c['last_transaction_ago']})")
        return "\n".join(lines)

    if tool == "find_inactive_customers":
        rows = result["customers"]
        if not rows:
            return f"Sab regular customers pichle {result['days']} din me aaye hain."
        lines = [f"{len(rows)} customers pichle {result['days']} din se nahi aaye:"]
        for c in rows:
            due = f", baki {inr(c['outstanding_balance'])}" if c["outstanding_balance"] > 0 else ""
            lines.append(f"• {c['name']} — last visit {c['last_transaction_ago']}{due}")
        return "\n".join(lines)

    if tool == "get_inventory":
        if result.get("product"):
            p = result["product"]
            label = {"good": "Stock theek hai.", "low": "⚠️ Low stock — reorder soon.",
                     "out": "❌ Out of stock!"}[p["status"]]
            qty = int(p["quantity"]) if float(p["quantity"]).is_integer() else p["quantity"]
            return f"{p['name']}: {qty} {p['unit']} available (minimum {int(p['minimum_stock'])} {p['unit']}). {label}"
        s = result["summary"]
        lines = [f"Inventory: {s['total']} products — {s['good']} good, {s['low']} low, {s['out']} out of stock."]
        for p in result["needs_attention"]:
            qty = int(p["quantity"]) if float(p["quantity"]).is_integer() else p["quantity"]
            lines.append(f"• {p['name']}: {qty} {p['unit']} ({'out of stock' if p['status']=='out' else 'low'})")
        return "\n".join(lines)

    if tool == "get_today_sales":
        if result["transaction_count"] == 0:
            return "Aaj abhi tak koi sale record nahi hui."
        return (f"Aaj ki total sale {inr(result['total'])} hai — {result['transaction_count']} transactions, "
                f"average {inr(result['average_sale'])}. Cash {inr(result['cash_total'])}, "
                f"udhaar {inr(result['credit_total'])}. Payments received: {inr(result['payments_received'])}.")

    if tool == "add_transaction":
        t = result["transaction"]
        c = result.get("customer")
        name = _first(c["name"]) if c else "Walk-in customer"
        items_txt = ""
        if t.get("items"):
            items_txt = " (" + ", ".join(
                f"{int(i['quantity']) if float(i['quantity']).is_integer() else i['quantity']} {i.get('unit') or ''} {i['product_name']}".strip()
                for i in t["items"]) + ")"
        if t["transaction_type"] == "payment":
            msg = f"Recorded: {name} paid {inr(t['amount'])}. New balance: {inr(c['outstanding_balance'])}."
        elif t["transaction_type"] == "credit":
            if result.get("amount_missing"):
                msg = f"Recorded udhaar for {name}{items_txt}. Price nahi bataya gaya — please confirm the amount so I can update the khata."
            else:
                msg = f"Recorded: {name} took {inr(t['amount'])} on udhaar{items_txt}. Outstanding is now {inr(c['outstanding_balance'])}."
        else:
            msg = f"Recorded cash sale of {inr(t['amount'])} for {name}{items_txt}."
        low = [s for s in result.get("stock_updates", []) if s["status"] != "good"]
        if low:
            msg += " Stock alert: " + ", ".join(f"{s['product']} {s['remaining']} {s['unit']} left" for s in low) + "."
        return msg

    return json.dumps(result, ensure_ascii=False)[:800]


# ---------------------------------------------------------------------------
# Demo (rule-based) agent
# ---------------------------------------------------------------------------
class DemoAgent:
    """Simple regex/keyword intent handler for demo mode. Uses real tools + data."""

    mode = "demo"

    def _known_customer(self, text: str) -> Optional[str]:
        low = text.lower()
        for c in get_repository().list_customers():
            first = c["name"].split()[0].lower()
            if re.search(rf"\b{re.escape(first)}\b", low):
                return c["name"]
        return None

    @staticmethod
    def _clean_name(s: str) -> str:
        """Drop trailing filler words so 'gopal phone' / 'ram s/o' -> 'Gopal'."""
        words = (s or "").title().split()
        stop = {"Phone", "Mobile", "Number", "Father", "Name", "S/O", "So", "Of",
                "Is", "Hai", "Ka", "Ki", "Ke", "With", "And", "Aur"}
        while words and words[-1] in stop:
            words.pop()
        return " ".join(words)

    def _guess_name(self, text: str) -> Optional[str]:
        m = re.search(r"\b([A-Za-z][A-Za-z]*(?:\s[A-Za-z]+)?)\s+(?:ka|ki|ke|ne|se|has|owes|took)\b", text, re.I)
        if m and not re.search(r"\b(?:milk|sugar|rice|wheat|dal|tea|stock|inventory)\b", text, re.I):
            return self._clean_name(m.group(1))
        m = re.search(r"\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(?:ka|ki|ne)\s+(?:khata|naya|kitna|baki|udhaar)", text, re.I)
        if m:
            return self._clean_name(m.group(1))
        m = re.search(r"\b(?:add|create|new)\s+customer\s+([A-Za-z]+(?:\s[A-Za-z]+)?)", text, re.I)
        return self._clean_name(m.group(1)) if m else None

    def _product(self, text: str) -> Optional[str]:
        low = text.lower()
        for alias, canonical in HINDI_PRODUCT_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", low):
                return canonical
        for p in get_repository().list_products():
            if p["name"].lower() in low or p["name"].lower().rstrip("s") in low:
                return p["name"]
        return None

    def _amount(self, text: str) -> Optional[float]:
        m = re.search(r"(?:₹|rs\.?|rupees?|rupaye)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:₹|rs\.?|rupees?|rupaye|ka|ke|ki)?", text, re.I)
        if not m:
            return None
        return float(m.group(1).replace(",", ""))

    def _items(self, text: str) -> List[dict]:
        items = []
        for m in re.finditer(r"(\d+(?:\.\d+)?)\s*(kg|kilo|litre|liter|ltr|l|packet|packets|pkt|dozen)?\s+([a-zA-Z ]+?)(?=\s+(?:leke|le|liya|liye|diya|gaya|gayi|udhaar|aur|and|,|$))", text, re.I):
            qty, unit, name = m.groups()
            name = name.strip()
            prod = self._product(name)
            if prod:
                items.append({"product_name": prod, "quantity": float(qty), "unit": unit})
        return items

    def handle(self, message: str, history: Optional[List[dict]] = None) -> dict:
        text = message.strip()
        low = text.lower()
        name = self._known_customer(text) or self._guess_name(text)
        amount = self._amount(text)
        product = self._product(text)

        def respond(intent, tool, args):
            result = run_tool(tool, args)
            return {"reply": format_result(tool, args, result), "mode": "demo", "intent": intent,
                    "tool_calls": [{"name": tool, "arguments": args, "result": result}], "data": result}

        # --- create khata ---
        if re.search(r"naya khata|nayi khata|new khata|new customer|khata banao|khata khol|add customer|create customer", low):
            father = None
            m = re.search(r"father(?:'s)?\s*(?:name)?\s*(?:is|hai|:)?\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)", text)
            if m:
                father = m.group(1)
            else:
                m = re.search(r"(?:s/o|son of|pita|papa|father)\s*(?:ka naam|name)?\s*([A-Za-z]+(?:\s[A-Za-z]+)?)", text, re.I)
                father = m.group(1).title() if m else None
            phone_m = re.search(r"\b(\d{10})\b", text)
            # Prefer an explicit "NAME ka naya khata" over a loosely-matched name
            # (e.g. "Mohan ka naya khata banao, s/o Suresh" => owner is Mohan).
            m = re.search(r"\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(?:ka|ki)\s+(?:naya|nayi|new)\s+khata", text, re.I)
            if m:
                name = self._clean_name(m.group(1))
            if not name:
                for pat in (
                    r"\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+(?:ka|ki)\s+(?:naya|nayi|new)\s+khata",
                    r"\b(?:add|create|new)\s+(?:customer|khata)\s+([A-Za-z]+(?:\s[A-Za-z]+)?)",
                    r"\bkhata\s+(?:banao|kholo)\s+([A-Za-z]+(?:\s[A-Za-z]+)?)",
                    r"\b([A-Za-z]+(?:\s[A-Za-z]+)?)\s+ka\s+khata\s+banao",
                ):
                    m = re.search(pat, text, re.I)
                    if m:
                        name = self._clean_name(m.group(1))
                        break
            if not name:
                return {"reply": "Kis customer ka khata banana hai? Please name bataiye, e.g. 'Rahul ka naya khata banao'.",
                        "mode": "demo", "intent": "create_customer", "tool_calls": [], "data": None}
            return respond("create_customer", "create_or_update_customer_khata",
                           {"customer_name": name, "father_name": father,
                            "phone": phone_m.group(1) if phone_m else None})

        # --- payment received ---
        if name and re.search(r"paise diye|diye|jama|payment|paid|pay kiya|chuka|wapas", low) and amount \
                and not re.search(r"udhaar liya|leke gaya|le gaya", low):
            return respond("record_payment", "add_transaction",
                           {"customer_name": name, "amount": amount, "transaction_type": "payment", "items": []})

        # --- credit / sale ---
        if re.search(r"udhaar|udhar|leke gaya|le gaya|leke gayi|le gayi|liya|liye|took|bought|kharida|credit", low) \
                and name and not re.search(r"kitna|dikhao|show|baki hai\??$", low):
            items = self._items(text)
            ttype = "cash" if re.search(r"cash|nakad|paid", low) and not re.search(r"udhaar|udhar", low) else "credit"
            args = {"customer_name": name, "items": items, "transaction_type": ttype}
            # only pass an explicit amount, never invent one
            if amount and re.search(r"(?:₹|rs|rupaye|rupees|ka saman|ka samaan|ka)\b", low):
                args["amount"] = amount
            elif amount and not items:
                args["amount"] = amount
            return respond("add_transaction", "add_transaction", args)

        # --- high credit ---
        if re.search(r"zyada baki|se zyada|more than|above|greater|high credit|highest|sabse zyada|baki hai\b.*\d|\d.*\bbaki", low) \
                and not name:
            return respond("high_credit", "find_high_credit_customers", {"minimum_amount": amount or 1000})

        # --- inactive ---
        if re.search(r"nahi aaye|nahi aaya|nahi aye|inactive|haven't come|not come|not visited|kaun nahi|missing customers", low):
            m = re.search(r"(\d+)\s*(?:din|days?|day)", low)
            return respond("inactive_customers", "find_inactive_customers", {"days": int(m.group(1)) if m else 10})

        # --- today's sales ---
        if re.search(r"sale|sales|bikri|bikree|kamai|revenue|aaj ka total|aaj kitna", low) and not product:
            return respond("today_sales", "get_today_sales", {})

        # --- inventory ---
        if re.search(r"stock|inventory|kitna hai|kitna bacha|bacha hai|available|maal|saman hai|low stock|khatam", low) or product:
            if re.search(r"low stock|kam stock|khatam|out of stock|attention|sab|all|pura|full|inventory dikhao", low) and not product:
                return respond("inventory", "get_inventory", {})
            return respond("inventory", "get_inventory", {"product_name": product} if product else {})

        # --- khata ---
        if name and re.search(r"khata|baki|balance|owe|udhaar|udhar|history|hisab|hisaab|kitna|dikhao|show", low):
            return respond("customer_khata", "get_customer_khata", {"customer_name": name})
        if name:
            return respond("customer_khata", "get_customer_khata", {"customer_name": name})

        # --- greetings / help ---
        if re.search(r"^(hi|hello|hey|namaste|namaskar|hii+)\b", low):
            return {"reply": "Namaste! Main GrowMate AI hoon. Aap pooch sakte hain: 'Ramesh ka khata dikhao', 'Aaj kitni sale hui?', "
                             "'Milk ka stock kitna hai?', '₹1000 se zyada kiska baki hai?', ya 'Rahul ne 500 ka saman udhaar liya'.",
                    "mode": "demo", "intent": "greeting", "tool_calls": [], "data": None}

        return {"reply": "Demo AI mode me main ye samajh sakta hoon: customer khata, aaj ki sale, stock, zyada baki wale customers, "
                         "inactive customers, udhaar/payment record karna aur naya khata banana. "
                         "Example: 'Ramesh ka khata dikhao' ya 'Milk ka stock kitna hai?'. "
                         "Set GROQ_API_KEY (or OPENAI_API_KEY) for full natural-language understanding.",
                "mode": "demo", "intent": "unknown", "tool_calls": [], "data": None}


# ---------------------------------------------------------------------------
# AI agent with function calling (GROQ Responses API / OpenAI fallback)
# ---------------------------------------------------------------------------
class OpenAIAgent:
    mode = "openai"

    def __init__(self, api_key: str, model: str, base_url: str | None = None):
        try:
            from openai import OpenAI  # lazy import: demo mode works without the SDK configured
        except ImportError as exc:  # SDK missing (e.g. skipped `pip install -r backend/requirements.txt`)
            raise RuntimeError(
                "The OpenAI SDK is not installed. Run `pip install -r backend/requirements.txt` "
                "(includes 'openai') and restart the backend, or remove GROQ_API_KEY / "
                "OPENAI_API_KEY from .env to keep using demo mode."
            ) from exc
        # base_url points the SDK at GROQ's OpenAI-compatible endpoint
        # (https://api.groq.com/openai/v1). None => OpenAI default.
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model

    def _context(self) -> str:
        from repository import now_ist
        repo = get_repository()
        names = ", ".join(c["name"] for c in repo.list_customers())
        products = ", ".join(p["name"] for p in repo.list_products())
        return (f"Shop: {settings.SHOP_NAME} (owner {settings.OWNER_NAME}). Today: {now_ist().strftime('%A, %d %B %Y')}.\n"
                f"Known customers: {names}.\nProducts in inventory: {products}.")

    def handle(self, message: str, history: Optional[List[dict]] = None) -> dict:
        """Run the agent via the Responses API (`client.responses.create`).

        Uses the same shape as the GROQ quickstart: `input=...` for messages,
        `tools=TOOL_SCHEMAS` for function calling, and `response.output_text`
        for the final answer.
        """
        # The full conversation: system + history + the new user message.
        inputs = [{"role": "system", "content": SYSTEM_PROMPT + "\n\n" + self._context()}]
        for h in (history or [])[-10:]:
            if h.get("role") in ("user", "assistant") and h.get("content"):
                inputs.append({"role": h["role"], "content": str(h["content"])[:2000]})
        inputs.append({"role": "user", "content": message})

        tool_calls_info, last_data = [], None
        for _ in range(5):  # max tool rounds
            response = self.client.responses.create(
                model=self.model,
                input=inputs,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                temperature=0.2,
            )

            # A response ends with a `message` item (final text); any number of
            # `function_call` items may appear before it.
            calls = [item for item in response.output if getattr(item, "type", "") == "function_call"]
            if not calls:
                reply = (getattr(response, "output_text", "") or "").strip() or "Mujhe samajh nahi aaya, kripya dobara boliye."
                return {"reply": reply, "mode": "openai", "intent": tool_calls_info[0]["name"] if tool_calls_info else "chat",
                        "tool_calls": tool_calls_info, "data": last_data}

            for call in calls:
                try:
                    args = json.loads(call.arguments or "{}")
                    if not isinstance(args, dict):
                        args = {}
                except json.JSONDecodeError:
                    args = {}
                result = run_tool(call.name, args)
                last_data = result
                tool_calls_info.append({"name": call.name, "arguments": args, "result": result})
                # Feed the function call + its output back to the model
                # (Responses API function-calling loop).
                inputs.append({"type": "function_call", "call_id": call.call_id,
                               "name": call.name, "arguments": call.arguments})
                inputs.append({"type": "function_call_output", "call_id": call.call_id,
                               "output": json.dumps(result, ensure_ascii=False, default=str)[:12000]})

        # Too many rounds – summarise the last tool result deterministically
        if tool_calls_info:
            last = tool_calls_info[-1]
            return {"reply": format_result(last["name"], last["arguments"], last["result"]), "mode": "openai",
                    "intent": last["name"], "tool_calls": tool_calls_info, "data": last_data}
        return {"reply": "Sorry, main is request ko process nahi kar paya.", "mode": "openai",
                "intent": "error", "tool_calls": [], "data": None, "error": "max_tool_rounds"}


# ---------------------------------------------------------------------------
# Entry point used by the API
# ---------------------------------------------------------------------------
_demo = DemoAgent()
_openai: Optional[OpenAIAgent] = None


def get_agent_mode() -> str:
    return "openai" if settings.ai_enabled else "demo"


def chat(message: str, history: Optional[List[dict]] = None) -> dict:
    """Route to OpenAI agent when configured, otherwise demo agent. Never raises."""
    global _openai
    if not message or not message.strip():
        return {"reply": "Kripya kuch likhiye ya boliye — e.g. 'Ramesh ka khata dikhao'.", "mode": get_agent_mode(),
                "intent": "empty", "tool_calls": [], "data": None, "error": "empty_message"}
    message = message.strip()[:2000]

    if settings.ai_enabled:
        try:
            if _openai is None:
                _openai = OpenAIAgent(settings.llm_api_key, settings.llm_model,
                                      settings.llm_base_url)
            return _openai.handle(message, history)
        except Exception as exc:
            # Log the real error server-side; never expose internals to the client
            import logging
            logging.error("AI agent failed: %s", exc)
            fallback = _demo.handle(message, history)
            fallback["error"] = "AI agent encountered an error. Answered in demo mode."
            return fallback
    try:
        return _demo.handle(message, history)
    except Exception as exc:
        import logging
        logging.error("Demo agent failed: %s", exc)
        return {"reply": "Kuch gadbad ho gayi. Please try again.", "mode": "demo", "intent": "error",
                "tool_calls": [], "data": None, "error": "Agent error"}
