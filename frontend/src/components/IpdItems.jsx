import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";
import { Trash2, PackagePlus } from "lucide-react";

export const IpdItems = ({ admission, items, onChange }) => {
  const [meds, setMeds] = useState([]);
  const [form, setForm] = useState({ medicineId: "", name: "", quantity: 1, unitPrice: 0, date: localDate(), notes: "" });
  const [saving, setSaving] = useState(false);
  const active = admission.status === "admitted";
  useEffect(() => { if (active) api.get("/medicines?stock=available").then((r) => setMeds(r.data)); }, [active, items.length]);
  const mine = items.filter((i) => i.admissionId === admission.id);
  const total = mine.reduce((s, i) => s + Number(i.amount || 0), 0);
  const pick = (id) => {
    const m = meds.find((x) => x.id === id);
    setForm({ ...form, medicineId: id, name: m ? m.name : "", unitPrice: m ? m.mrp : 0 });
  };
  const add = async () => {
    if (!form.medicineId && !form.name.trim()) return toast.error("Pick a medicine or type the item name");
    if (!(Number(form.quantity) > 0)) return toast.error("Quantity must be more than 0");
    const m = meds.find((x) => x.id === form.medicineId);
    if (m && Number(form.quantity) > m.quantity) return toast.error(`Only ${m.quantity} in stock`);
    setSaving(true);
    try {
      await api.post(`/ipd-admissions/${admission.id}/items`, { ...form, medicineId: form.medicineId || null, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice || 0) });
      toast.success("Item added");
      setForm({ medicineId: "", name: "", quantity: 1, unitPrice: 0, date: form.date, notes: "" });
      onChange();
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not add"); }
    setSaving(false);
  };
  const del = async (i) => {
    if (!window.confirm("Remove this item?")) return;
    try { await api.delete(`/ipd-admissions/${admission.id}/items/${i.id}`); onChange(); } catch (err) { toast.error(err?.response?.data?.detail || "Could not remove"); }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6" data-testid={`ipd-items-${admission.id}`}>
      <h3 className="font-display font-semibold mb-1 flex items-center gap-2"><PackagePlus className="w-4 h-4 text-[hsl(var(--brand))]" /> Items used during IPD {active ? "(admitted)" : "(discharged)"}</h3>
      <p className="text-xs text-slate-500 mb-4">Room {admission.room || "—"} · {admission.doctor || "—"} · since {new Date(admission.admissionAt).toLocaleDateString("en-IN")}. Medicines picked from stock are taken out of inventory.</p>
      {active && (
        <div className="grid grid-cols-12 gap-2 mb-4">
          <select data-testid="ipd-item-medicine" value={form.medicineId} onChange={(e) => pick(e.target.value)} className="inp col-span-12 md:col-span-3">
            <option value="">Other item (type below)</option>
            {meds.map((m) => <option key={m.id} value={m.id}>{m.name} · {m.batchNumber} · stock {m.quantity}</option>)}
          </select>
          <input data-testid="ipd-item-name" value={form.name} disabled={!!form.medicineId} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Item / service name" className="inp col-span-12 md:col-span-3" />
          <input data-testid="ipd-item-qty" type="number" min="1" title="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="inp col-span-4 md:col-span-1" />
          <input data-testid="ipd-item-price" type="number" min="0" title="Price each ₹" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} className="inp col-span-4 md:col-span-2" />
          <input data-testid="ipd-item-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="inp col-span-4 md:col-span-2" />
          <button data-testid="ipd-item-add-btn" disabled={saving} onClick={add} className="col-span-12 md:col-span-1 px-3 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold disabled:opacity-60">Add</button>
        </div>
      )}
      {mine.length === 0 ? <p className="text-sm text-slate-400">No items added yet.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wider text-slate-500"><th className="text-left py-2">Date</th><th className="text-left py-2">Item</th><th className="text-left py-2">Qty</th><th className="text-left py-2">Price</th><th className="text-right py-2">Amount</th><th></th></tr></thead>
          <tbody>
            {mine.map((i) => (
              <tr key={i.id} className="border-t border-slate-100">
                <td className="py-2">{new Date(i.date).toLocaleDateString("en-IN")}</td>
                <td className="py-2">{i.name} {i.medicineId && <span className="badge-soft bg-teal-50 text-teal-700 ml-1">stock</span>} {i.billed && <span className="badge-soft bg-indigo-50 text-indigo-700 ml-1">billed</span>}</td>
                <td className="py-2">{i.quantity}</td>
                <td className="py-2">₹{Number(i.unitPrice).toFixed(2)}</td>
                <td className="py-2 text-right">₹{Number(i.amount).toFixed(2)}</td>
                <td className="py-2 text-right">{!i.billed && <button data-testid={`ipd-item-delete-${i.id}`} onClick={() => del(i)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-semibold"><td className="py-2" colSpan="4">Total</td><td className="py-2 text-right" data-testid="ipd-items-total">₹{total.toFixed(2)}</td><td /></tr>
          </tbody>
        </table>
      )}
      <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;}`}</style>
    </div>
  );
};
