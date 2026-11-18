import { useEffect, useState } from "react";
import { api, MED_TYPES, fmtQty } from "../lib/api";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import { FamilyDispatchModal, FamilyHistory } from "../components/FamilyDispatch";
import { StockHistory } from "../components/StockHistory";

const EMPTY = { name: "", batchNumber: "", expiryDate: "", quantity: 0, medicineType: "Tablet", tabletsPerStrip: 0, sellingCost: 0, mrp: 0, supplier: "", location: "", notes: "" };
const TABS = [["inventory", "Inventory"], ["family", "Family History"], ["stock", "Stock History"]];

export default function Medicines() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [tab, setTab] = useState("inventory");
  const [familyOpen, setFamilyOpen] = useState(false);
  const [allMeds, setAllMeds] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [q, setQ] = useState("");
  const [stock, setStock] = useState("all");
  const [expiry, setExpiry] = useState("all");
  const load = (isLive = () => true) => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("search", q.trim());
    if (stock !== "all") p.set("stock", stock);
    if (expiry !== "all") p.set("expiry", expiry);
    return api.get(`/medicines?${p.toString()}`).then((r) => isLive() && setList(r.data)).catch(() => isLive() && toast.error("Could not load medicines"));
  };
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => load(() => live), 250);
    return () => { live = false; clearTimeout(t); };
    /* eslint-disable-next-line */
  }, [q, stock, expiry]);
  const filtered = q.trim() || stock !== "all" || expiry !== "all";
  const save = async () => {
    if (!form.name || !form.batchNumber || !form.expiryDate) return toast.error("Name, batch and expiry are required");
    if ([form.quantity, form.tabletsPerStrip, form.sellingCost, form.mrp].some((v) => Number(v) < 0)) return toast.error("Numbers cannot be negative");
    const payload = { ...form, quantity: Number(form.quantity), tabletsPerStrip: Number(form.tabletsPerStrip || 0), sellingCost: Number(form.sellingCost), mrp: Number(form.mrp) };
    try {
      if (editId) await api.patch(`/medicines/${editId}`, payload);
      else await api.post("/medicines", payload);
      toast.success(editId ? "Updated" : "Added medicine");
      setOpen(false); setForm(EMPTY); setEditId(null); load(); setRefreshKey((k) => k + 1);
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  const edit = (m) => { setForm({ ...EMPTY, ...m }); setEditId(m.id); setOpen(true); };
  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/medicines/${id}`); load(); };
  const openFamily = () => api.get("/medicines?stock=available").then((r) => { setAllMeds(r.data); setFamilyOpen(true); });
  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="medicines-title">Medicines Inventory</h1>
          <p className="text-slate-500 mt-1">Batch & expiry tracked</p>
        </div>
        <div className="flex gap-2">
          <button data-testid="dispatch-family-btn" onClick={openFamily}
            className="px-4 py-2.5 rounded-lg border border-[hsl(var(--brand))] text-[hsl(var(--brand))] font-semibold inline-flex items-center gap-2 hover:bg-[hsl(var(--brand-light))]"><Users className="w-4 h-4" /> Dispatch to Family</button>
          <button data-testid="add-medicine-btn" onClick={() => { setForm(EMPTY); setEditId(null); setOpen(true); }}
            className="px-4 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Add Medicine</button>
        </div>
      </header>
      <div className="flex gap-2 mb-5 border-b border-slate-200">
        {TABS.map(([k, l]) => (
          <button key={k} data-testid={`med-tab-${k}`} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 ${tab === k ? "border-[hsl(var(--brand))] text-[hsl(var(--brand))]" : "border-transparent text-slate-500"}`}>{l}</button>
        ))}
      </div>
      {tab === "family" && <FamilyHistory refreshKey={refreshKey} onChanged={() => { load(); setRefreshKey((k) => k + 1); }} />}
      {tab === "stock" && <StockHistory refreshKey={refreshKey} />}
      {familyOpen && <FamilyDispatchModal meds={allMeds} onClose={() => setFamilyOpen(false)} onSaved={() => { setFamilyOpen(false); load(); setRefreshKey((k) => k + 1); setTab("family"); }} />}
      {tab === "inventory" && <>
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input data-testid="medicine-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, batch or supplier"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[hsl(var(--brand))]" />
        </div>
        <select data-testid="medicine-stock-filter" value={stock} onChange={(e) => setStock(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white">
          <option value="all">All stock</option><option value="available">In stock</option><option value="low">Low stock (under 10)</option>
        </select>
        <select data-testid="medicine-expiry-filter" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white">
          <option value="all">All expiry</option><option value="near">Expiring in 60 days</option><option value="expired">Expired</option>
        </select>
        <span className="self-center text-xs text-slate-500" data-testid="medicine-count">{list.length} medicine(s), A to Z</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Batch</th><th className="text-left px-4 py-3">Expiry</th><th className="text-left px-4 py-3">Qty</th><th className="text-left px-4 py-3">Tablets / Strip</th><th className="text-left px-4 py-3">Selling</th><th className="text-left px-4 py-3">MRP</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const expired = new Date(m.expiryDate) < new Date();
              const low = (m.quantity || 0) < 10;
              return (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3" data-testid={`med-type-${m.id}`}><span className="badge-soft bg-slate-100 text-slate-700">{m.medicineType || "—"}</span></td>
                  <td className="px-4 py-3 font-mono text-xs">{m.batchNumber}</td>
                  <td className={`px-4 py-3 ${expired ? "text-red-700 font-semibold" : ""}`}>{m.expiryDate}</td>
                  <td className={`px-4 py-3 ${low ? "text-amber-700 font-semibold" : ""}`}>{fmtQty(m.quantity)}</td>
                  <td className="px-4 py-3" data-testid={`med-tps-${m.id}`}>{m.tabletsPerStrip || "—"}</td>
                  <td className="px-4 py-3">₹{Number(m.sellingCost).toFixed(2)}</td>
                  <td className="px-4 py-3">₹{Number(m.mrp).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button data-testid={`med-edit-${m.id}`} onClick={() => edit(m)} className="p-1.5 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                    <button data-testid={`med-delete-${m.id}`} onClick={() => del(m.id)} className="p-1.5 hover:bg-red-50 text-red-600 rounded ml-1"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan="9" className="px-4 py-10 text-center text-slate-400" data-testid="medicine-empty">{filtered ? "No medicines match your search." : "No medicines yet."}</td></tr>}
          </tbody>
        </table>
      </div>
      </>}
      {open && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold mb-4">{editId ? "Edit" : "Add"} Medicine</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="block col-span-2">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1 block">Medicine Type *</span>
                <div className="flex flex-wrap gap-2">
                  {MED_TYPES.map((t) => (
                    <button type="button" key={t} data-testid={`med-type-option-${t}`} onClick={() => setForm({ ...form, medicineType: t })}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border ${form.medicineType === t ? "bg-[hsl(var(--brand))] text-white border-[hsl(var(--brand))]" : "border-slate-200 text-slate-600"}`}>{t}</button>
                  ))}
                </div>
              </label>
              {[
                ["name", "Name *"], ["batchNumber", "Batch *"], ["expiryDate", "Expiry Date *", "date"],
                ["quantity", "Stock (strips / units)", "number"], ["tabletsPerStrip", "Tablets per Strip", "number"], ["sellingCost", "Selling Cost ₹ (per strip)", "number"], ["mrp", "MRP ₹ (per strip)", "number"],
                ["supplier", "Supplier"], ["location", "Location"],
              ].map(([k, l, type]) => (
                <label key={k} className="block">
                  <span className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1 block">{l}</span>
                  <input data-testid={`med-${k}-input`} type={type || "text"} min={type === "number" ? "0" : undefined} step={type === "number" ? "any" : undefined} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[hsl(var(--brand))]" />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
              <button data-testid="med-save-btn" onClick={save} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
