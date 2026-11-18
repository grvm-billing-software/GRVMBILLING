import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function Referrals() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ patientName: "", patientContact: "", referringDoctor: "", center: "", testName: "", notes: "", referralDate: localDate() });
  const load = () => api.get("/referrals").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.patientName) return toast.error("Patient name required");
    try {
      await api.post("/referrals", form);
      toast.success("Referral created. WhatsApp queued.");
      setOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Failed"); }
  };
  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">Referrals</h1>
        <button data-testid="new-referral-btn" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> New Referral</button>
      </header>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3">Doctor</th><th className="text-left px-4 py-3">Center</th><th className="text-left px-4 py-3">Test</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{r.patientName}</td>
                <td className="px-4 py-3">{r.referringDoctor || "—"}</td>
                <td className="px-4 py-3">{r.center || "—"}</td>
                <td className="px-4 py-3">{r.testName || "—"}</td>
                <td className="px-4 py-3">{r.referralDate}</td>
                <td className="px-4 py-3">
                  <select data-testid={`ref-status-${r.id}`} value={r.status} onChange={async (e) => { await api.patch(`/referrals/${r.id}`, { status: e.target.value }); load(); }} className="px-2 py-1 border border-slate-200 rounded-lg text-xs">
                    <option value="pending">pending</option><option value="completed">completed</option><option value="cancelled">cancelled</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right"><button data-testid={`ref-delete-${r.id}`} onClick={async () => { if (!window.confirm("Delete this referral?")) return; await api.delete(`/referrals/${r.id}`); load(); }} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No referrals yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold mb-4">New Referral</h2>
            <div className="grid grid-cols-2 gap-3">
              {[["patientName","Patient Name *"],["patientContact","Contact"],["referringDoctor","Referring Doctor"],["center","Center/Hospital"],["testName","Test/Service"],["referralDate","Date","date"]].map(([k,l,t])=>(
                <label key={k} className="block"><span className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1 block">{l}</span>
                  <input data-testid={`ref-${k}-input`} type={t||"text"} value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
              <button data-testid="ref-save-btn" onClick={save} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Save & Notify</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
