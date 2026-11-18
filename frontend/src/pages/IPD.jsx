import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Link } from "react-router-dom";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function IPD() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set("search", q);
    if (status !== "all") params.set("status", status);
    api.get(`/ipd-admissions?${params.toString()}`).then((r) => setList(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, status]);
  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="ipd-page-title">IPD Admissions</h1>
          <p className="text-slate-500 mt-1">Admitted, discharged, and referral patients</p>
        </div>
        <Link to="/ipd/admit" data-testid="ipd-admit-btn"
          className="px-4 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold hover:bg-[hsl(var(--brand-hover))] inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Admit Patient
        </Link>
      </header>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input data-testid="ipd-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white">
          <option value="all">All</option><option value="admitted">Admitted</option><option value="discharged">Discharged</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3">Doctor</th><th className="text-left px-4 py-3">Room</th><th className="text-left px-4 py-3">Admitted</th><th className="text-left px-4 py-3">Status</th><th className="text-left px-4 py-3">Revisit</th><th className="text-left px-4 py-3">Open</th></tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{a.patientName}<div className="text-xs text-slate-500 font-mono">{a.patientContact}</div></td>
                <td className="px-4 py-3">{a.doctor || "—"}</td>
                <td className="px-4 py-3">{a.room || "—"}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(a.admissionAt).toLocaleString()}</td>
                <td className="px-4 py-3"><span className={`badge-soft ${a.status === "admitted" ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-700"}`}>{a.status}</span></td>
                <td className="px-4 py-3">{a.revisitDate || "—"}</td>
                <td className="px-4 py-3 whitespace-nowrap">{a.patientId && <Link to={`/patients/${a.patientId}`} className="text-[hsl(var(--brand))] font-medium hover:underline">{a.status === "admitted" ? "Discharge / View" : "View"}</Link>}
                  <button data-testid={`ipd-delete-${a.id}`} onClick={async () => { if (!window.confirm("Delete this IPD record?")) return; try { await api.delete(`/ipd-admissions/${a.id}`); toast.success("Deleted"); load(); } catch { toast.error("Could not delete"); } }} className="p-1.5 hover:bg-red-50 text-red-600 rounded ml-2"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No IPD records.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
