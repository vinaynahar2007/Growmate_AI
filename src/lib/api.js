/**
 * API client for the Python/FastAPI backend.
 *
 * All calls go to VITE_API_URL (default http://localhost:8000). If the backend is
 * unreachable (network error / timeout) we transparently fall back to the
 * in-browser demo store and flag the connection status so the UI can show a banner.
 * The OpenAI key never touches this file - it lives only in the backend .env.
 */
import { local } from "./localDemo.js";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

// ERROR SANITIZER - backend internals are never shown to the user or spoken via TTS
const STATUS_TEXT = {
  400: "Invalid request - please check your input.",
  401: "Authentication required.",
  403: "Access denied.",
  404: "Resource not found.",
  408: "Request timed out. Please try again.",
  409: "Conflict - this record may have been modified.",
  429: "Too many requests. Please slow down.",
  500: "Internal server error. Please try again later.",
  502: "Backend service unavailable.",
  503: "Service temporarily unavailable.",
  504: "Backend timed out.",
};

function sanitizeError(data, status) {
  console.error("[API " + status + "]", data);
  if (status >= 500) return STATUS_TEXT[status] || STATUS_TEXT[500];
  if (status >= 400) {
    var detail = data && (data.detail || data.error);
    if (typeof detail === "string" && detail.length < 200) return detail;
    return STATUS_TEXT[status] || "Something went wrong.";
  }
  return "Something went wrong.";
}

function safeId(id) {
  if (id == null) return id;
  var s = String(id);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new ApiError("Invalid identifier.", { status: 400 });
  return s;
}

// ---------------------------------------------------------------- status store
const status = { backend: "checking", aiMode: "demo", model: null, repository: null, shop: null, lastError: null };
const listeners = new Set();
const setStatus = (patch) => {
  Object.assign(status, patch);
  listeners.forEach((fn) => fn({ ...status }));
};
export const getStatus = () => ({ ...status });
export const subscribeStatus = (fn) => {
  listeners.add(fn);
  fn({ ...status });
  return () => listeners.delete(fn);
};

// ---------------------------------------------------------------- fetch helper
export class ApiError extends Error {
  constructor(message, { status: code, network = false } = {}) {
    super(message);
    this.status = code;
    this.network = network;
  }
}

async function request(path, { method = "GET", body, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: "same-origin",
    });
  } catch (err) {
    clearTimeout(timer);
    throw new ApiError(err.name === "AbortError" ? "Backend timed out" : "Backend unavailable", { network: true });
  }
  clearTimeout(timer);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new ApiError(sanitizeError(data, res.status), { status: res.status });
  }
  return data;
}

async function withFallback(remote, fallback) {
  try {
    const data = await remote();
    if (status.backend !== "online") setStatus({ backend: "online", lastError: null });
    return data;
  } catch (err) {
    if (err instanceof ApiError && err.network) {
      setStatus({ backend: "offline", aiMode: "demo", lastError: err.message });
      return fallback();
    }
    throw err;
  }
}

// ---------------------------------------------------------------- public API
export const api = {
  async health() {
    try {
      const h = await request("/api/health", { timeout: 4000 });
      setStatus({ backend: "online", aiMode: h.ai_mode, model: h.model, repository: h.repository, shop: h.shop, lastError: null });
      return h;
    } catch (err) {
      setStatus({ backend: "offline", aiMode: "demo", repository: "BrowserDemo", lastError: err.message });
      return local.health();
    }
  },

  chat: (message, history = []) =>
    withFallback(
      () => request("/api/chat", { method: "POST", body: { message, history }, timeout: 60000 }),
      () => local.chat(message)
    ),

  customers: (search) =>
    withFallback(
      () => request(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
      () => local.customers(search)
    ),
  customer: (id) => withFallback(() => request(`/api/customers/${safeId(id)}`), () => local.customer(id)),
  createCustomer: (body) =>
    withFallback(() => request("/api/customers", { method: "POST", body }), () => local.createCustomer(body)),
  updateCustomer: (id, body) =>
    withFallback(() => request(`/api/customers/${safeId(id)}`, { method: "PUT", body }), () => local.updateCustomer(id, body)),
  khata: (id) => withFallback(() => request(`/api/customers/${safeId(id)}/khata`), () => local.khata(id)),

  inventory: (product) =>
    withFallback(
      () => request(`/api/inventory${product ? `?product=${encodeURIComponent(product)}` : ""}`),
      () => local.inventory(product)
    ),

  salesToday: () => withFallback(() => request("/api/sales/today"), () => local.salesToday()),
  transactions: (limit = 50, customerId) =>
    withFallback(
      () => request(`/api/transactions?limit=${limit}${customerId ? `&customer_id=${customerId}` : ""}`),
      () => local.transactions(limit, customerId)
    ),
  addTransaction: (body) =>
    withFallback(() => request("/api/transactions", { method: "POST", body }), () => local.addTransaction(body)),

  dashboard: () => withFallback(() => request("/api/dashboard"), () => local.dashboard()),
  analytics: (minCredit = 1000, days = 10) =>
    withFallback(
      () => request(`/api/analytics?min_credit=${minCredit}&inactive_days=${days}`),
      () => local.analytics(minCredit, days)
    ),
};
