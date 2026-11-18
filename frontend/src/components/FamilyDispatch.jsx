import { useEffect, useState } from "react";
import { api, localDate, fmtQty, qtyLabel, toStrips } from "../lib/api";
import { QtyInput, qtyPayload } from "./QtyInput";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";

export const FamilyDispatchModal = ({ meds, onClose, onSaved }) => {
  const [form, setForm] = useState({ memberName: "", medicineId: "", quantity: 1, unit: "strip", date: localDate(), givenBy: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const med = meds.find((m) => m.id === form.medicineId);
  const save = async () => {
    if (!form.memberName.trim() || !form.medicineId || !form.givenBy.trim()) return toast.error("Member name, medicine and given by are required");
    const strips = toStrips(med, form.unit, form.quantity);
    if (!(strips > 0)) return toast.error("Quantity must be more than 0");
    if (med && strips > med.quantity + 1e-9) return toast.error(`Only ${fmtQty(med.quantity)} strip in stock`);
    setSaving(true);
    try {
      await api.post("/family-dispatches", { ...form, ...qtyPayload(med, form.unit, form.quantity) });
      toast.success("Dispatched to family. Stock updated (not counted in revenue).");
      onSaved();
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not save"); }
    setSaving(false);
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()} data-testid="family-dispatch-modal">
        <h2 className="font-display text-xl font-bold mb-1">Dispatch to Family</h2>
        <p className="text-xs text-slate-500 mb-4">No invoice is made and it is not added to revenue. Stock goes down and it is saved in Family History.</p>
        <div className="grid grid-cols-2 gap-3">
          <L label="Family member name *" span><input data-testid="family-member-input" value={form.memberName} onChange={set("memberName")} className="inp" /></L>
          <L label="Medicine *" span>
            <select data-testid="family-medicine-select" value={form.medicineId} onChange={set("medicineId")} className="inp">
              <option value="">Select medicine</option>
              {meds.map((m) => <option key={m.id} value={m.id} disabled={m.quantity <= 0}>{m.name} · {m.batchNumber} · stock {fmtQty(m.quantity)}{m.tabletsPerStrip ? ` × ${m.tabletsPerStrip} tab` : ""}</option>)}
            </select>
          </L>
          <L label="Quantity *"><QtyInput testid="family-qty-input" med={med} unit={form.unit} qty={form.quantity} onChange={(v) => setForm({ ...form, unit: v.unit, quantity: v.qty })} /></L>
          <L label="Date *"><input data-testid="family-date-input" type="date" value={form.date} onChange={set("date")} className="inp" /></L>
          <L label="Took / given by *" span><input data-testid="family-givenby-input" value={form.givenBy} onChange={set("givenBy")} placeholder="Staff name" className="inp" /></L>
          <L label="Notes" span><input data-testid="family-notes-input" value={form.notes} onChange={set("notes")} className="inp" /></L>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
          <button data-testid="family-save-btn" disabled={saving} onClick={save} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold disabled:opacity-60">Dispatch</button>
        </div>
        <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;}`}</style>
      </div>
    </div>
  );
};

const L = ({ label, span, children }) => (
  <label className={`block ${span ? "col-span-2" : ""}`}><span className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1 block">{label}</span>{children}</label>
);

export const FamilyHistory = ({ refreshKey, onChanged }) => {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const load = () => api.get(`/family-dispatches${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`).then((r) => setList(r.data));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, refreshKey]);
  const del = async (r) => {
    if (!window.confirm(`Remove this entry? ${r.quantity} will go back to stock.`)) return;
    try { await api.delete(`/family-dispatches/${r.id}`); toast.success("Removed, stock returned"); load(); onChanged(); } catch { toast.error("Could not remove"); }
  };
  return (
    <div data-testid="family-history">
      <div className="mb-4 relative w-full md:w-96">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
        <input data-testid="family-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search member, medicine or given by"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white outline-none" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Member</th><th className="text-left px-4 py-3">Medicine</th><th className="text-left px-4 py-3">Qty</th><th className="text-left px-4 py-3">Took / Given by</th><th className="text-left px-4 py-3">Notes</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t border-slate-100" data-testid={`family-row-${r.id}`}>
                <td className="px-4 py-3">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-3 font-medium">{r.memberName}</td>
                <td className="px-4 py-3">{r.medicineName} <span className="font-mono text-xs text-slate-500">{r.batchNumber}</span></td>
                <td className="px-4 py-3">{qtyLabel(r.quantity, r.tablets)}</td>
                <td className="px-4 py-3">{r.givenBy}</td>
                <td className="px-4 py-3 text-slate-500">{r.notes || "—"}</td>
                <td className="px-4 py-3 text-right"><button data-testid={`family-delete-${r.id}`} onClick={() => del(r)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No family dispatches yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};
