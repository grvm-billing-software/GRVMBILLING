import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Search, User } from "lucide-react";
import { toast } from "sonner";

export default function Patients() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    let live = true;
    const t = setTimeout(() => {
      api.get(`/patients${q.trim() ? `?search=${encodeURIComponent(q.trim())}` : ""}`)
        .then((r) => live && setList(r.data))
        .catch(() => live && toast.error("Search failed, please try again"))
        .finally(() => live && setLoading(false));
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="patients-title">Patients</h1>
        <p className="text-slate-500 mt-1">Search any patient by name, mobile number or OPD No.</p>
      </header>
      <div className="mb-4 relative w-full md:w-[28rem]">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
        <input data-testid="patient-search-input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, mobile or OPD No."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white outline-none focus:border-[hsl(var(--brand))]" />
      </div>
      <p className="text-xs text-slate-500 mb-2" data-testid="patient-count">{loading ? "Searching..." : `${list.length} patient(s)`}</p>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3">Age / Gender</th><th className="text-left px-4 py-3">Mobile</th><th className="text-left px-4 py-3">Last OPD</th><th className="text-left px-4 py-3">Status</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-slate-100" data-testid={`patient-row-${p.id}`}>
                <td className="px-4 py-3 font-medium text-slate-900"><span className="inline-flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />{p.name}</span></td>
                <td className="px-4 py-3">{p.age || "—"} / {p.gender || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.contact || "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.lastVisit ? `No. ${p.lastVisit.appointmentNumber} · ${new Date(p.lastVisit.visitDate).toLocaleDateString("en-IN")}` : "—"}</td>
                <td className="px-4 py-3">{p.admitted ? <span className="badge-soft bg-teal-50 text-teal-700">admitted</span> : <span className="text-xs text-slate-400">—</span>}</td>
                <td className="px-4 py-3 text-right"><Link data-testid={`patient-open-${p.id}`} to={`/patients/${p.id}`} className="text-[hsl(var(--brand))] font-medium hover:underline">Open profile</Link></td>
              </tr>
            ))}
            {!loading && list.length === 0 && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">No patients found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
