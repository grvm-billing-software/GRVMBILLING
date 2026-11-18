import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem("session_token");
  if (t) cfg.headers["x-session-token"] = t;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("session_token");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const localDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const MED_TYPES = ["Tablet", "Capsule", "Injection", "Syrup", "Powder", "Other"];

export const fmtQty = (n) => String(Number(Number(n || 0).toFixed(2)));

export const qtyLabel = (quantity, tablets) => (tablets ? `${fmtQty(quantity)} (${tablets} tab)` : fmtQty(quantity));

export const canSplit = (med) => !!med && Number(med.tabletsPerStrip) > 0;

export const toStrips = (med, unit, qty) => (unit === "tab" && canSplit(med) ? Number(qty || 0) / Number(med.tabletsPerStrip) : Number(qty || 0));
