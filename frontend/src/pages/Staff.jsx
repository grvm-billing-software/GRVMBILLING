import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export default function Staff() {
  const [list, setList] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", designation: "", phone: "", joiningDate: localDate(), monthlySalary: 0 });
  const load = () => api.get("/staff").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!form.name) return toast.error("Name required");
    try {
      await api.post("/staff", { ...form, monthlySalary: Number(form.monthlySalary) });
      toast.success("Staff added"); setOpen(false); load();
    } catch (err) { toast.error("Failed"); }
  };
  const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/staff/${id}`); load(); };
  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">Staff</h1>
        <button data-testid="add-staff-btn" onClick={() => setOpen(true)} className="px-4 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Add Staff</button>
      </header>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider"><tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Designation</th><th className="text-left px-4 py-3">Phone</th><th className="text-left px-4 py-3">Joining</th><th className="text-left px-4 py-3">Salary</th><th></th></tr></thead>
          <tbody>
            {list.map((s)=>(
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{s.name}</td><td className="px-4 py-3">{s.designation || "—"}</td><td className="px-4 py-3 font-mono text-xs">{s.phone || "—"}</td><td className="px-4 py-3">{s.joiningDate}</td><td className="px-4 py-3">₹{Number(s.monthlySalary).toFixed(2)}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => del(s.id)} className="text-red-600"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">No staff yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold mb-4">Add Staff</h2>
            <div className="space-y-3">
              {[["name","Name *"],["designation","Designation"],["phone","Phone"],["joiningDate","Joining Date","date"],["monthlySalary","Monthly Salary","number"]].map(([k,l,t])=>(
                <label key={k} className="block"><span className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1 block">{l}</span>
                  <input data-testid={`staff-${k}-input`} type={t||"text"} value={form[k]} onChange={(e)=>setForm({...form,[k]:e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></label>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4"><button onClick={()=>setOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button><button data-testid="staff-save-btn" onClick={save} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
