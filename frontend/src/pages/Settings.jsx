import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function Settings() {
  const [form, setForm] = useState(null);
  useEffect(() => { api.get("/settings").then((r) => setForm(r.data)); }, []);
  if (!form) return <div className="p-8 text-slate-500">Loading...</div>;
  const setCharge = (i, v) => setForm({ ...form, defaultCharges: form.defaultCharges.map((c, x) => (x === i ? v : c)) });
  const save = async () => {
    if (!form.hospitalName.trim() || !form.hospitalAddress.trim()) return toast.error("Hospital name and address are required");
    if (Number(form.defaultOpdFee) < 0) return toast.error("OPD fee cannot be negative");
    try {
      const { data } = await api.put("/settings", { ...form, defaultOpdFee: Number(form.defaultOpdFee) });
      setForm(data);
      toast.success("Settings saved");
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not save"); }
  };
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-slate-900 mb-1" data-testid="settings-title">Settings</h1>
      <p className="text-slate-500 mb-6">Printed on invoices, OPD slips and WhatsApp messages</p>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <F label="Hospital Name"><input data-testid="settings-name-input" value={form.hospitalName} onChange={(e) => setForm({ ...form, hospitalName: e.target.value })} className="inp" /></F>
        <F label="Hospital Address"><textarea data-testid="settings-address-input" rows={2} value={form.hospitalAddress} onChange={(e) => setForm({ ...form, hospitalAddress: e.target.value })} className="inp" /></F>
        <F label="Default OPD Fee (₹)"><input data-testid="settings-opd-fee-input" type="number" min="0" value={form.defaultOpdFee} onChange={(e) => setForm({ ...form, defaultOpdFee: e.target.value })} className="inp" /></F>
        <div>
          <span className="lbl">Default charges on every invoice</span>
          <div className="space-y-2">
            {form.defaultCharges.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input data-testid={`settings-charge-${i}`} value={c} onChange={(e) => setCharge(i, e.target.value)} className="inp" />
                <button onClick={() => setForm({ ...form, defaultCharges: form.defaultCharges.filter((_, x) => x !== i) })} className="text-red-600 px-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <button data-testid="settings-add-charge-btn" onClick={() => setForm({ ...form, defaultCharges: [...form.defaultCharges, ""] })} className="text-sm text-[hsl(var(--brand))] font-semibold inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Add charge</button>
          </div>
        </div>
        <div className="flex justify-end"><button data-testid="settings-save-btn" onClick={save} className="px-5 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Save Settings</button></div>
      </div>
      <style>{`.inp{width:100%;padding:0.6rem 0.9rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;}.lbl{display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:500;margin-bottom:0.25rem;}`}</style>
    </div>
  );
}

const F = ({ label, children }) => <label className="block"><span className="lbl">{label}</span>{children}</label>;
