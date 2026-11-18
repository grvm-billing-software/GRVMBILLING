import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Search, Plus, Printer, Trash2 } from "lucide-react";
import { OpdSlip } from "../components/OpdSlip";

export default function OPD() {
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [slip, setSlip] = useState(null);
  const [settings, setSettings] = useState({});
  const [day, setDay] = useState(localDate());
  const load = () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("search", q.trim());
    if (day) p.set("day", day);
    return api.get(`/opd-visits?${p.toString()}`).then((r) => setList(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q, day]);
  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data)); }, []);
  const del = async (v) => {
    if (!window.confirm(`Delete OPD No. ${v.appointmentNumber}?`)) return;
    try { await api.delete(`/opd-visits/${v.id}`); toast.success("Deleted"); load(); } catch { toast.error("Could not delete"); }
  };
  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="opd-page-title">OPD Visits</h1>
          <p className="text-slate-500 mt-1">All patient outpatient registrations</p>
        </div>
        <Link to="/opd/register" data-testid="opd-register-btn"
          className="px-4 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold hover:bg-[hsl(var(--brand-hover))] inline-flex items-center gap-2">
          <Plus className="w-4 h-4" /> Register Patient
        </Link>
      </header>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
          <input data-testid="opd-search-input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, OPD no., doctor or phone"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-[hsl(var(--brand))] outline-none" />
        </div>
        <input data-testid="opd-day-filter" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white" />
        <button data-testid="opd-all-days-btn" onClick={() => setDay("")} className={`px-3 py-2.5 rounded-lg border text-sm font-medium ${day ? "border-slate-200 bg-white" : "border-[hsl(var(--brand))] text-[hsl(var(--brand))]"}`}>All days</button>
        <span className="text-xs text-slate-500" data-testid="opd-count">{list.length} visit(s) · OPD No. starts from 1 every day</span>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">OPD No.</th><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3">Age/Gender</th><th className="text-left px-4 py-3">Doctor</th><th className="text-left px-4 py-3">Fee</th><th className="text-left px-4 py-3">Date</th><th className="text-right px-4 py-3">Actions</th></tr>
          </thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id} className="border-t border-slate-100" data-testid={`opd-row-${v.appointmentNumber}`}>
                <td className="px-4 py-3 font-mono font-semibold">{v.appointmentNumber}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{v.patientName}<div className="text-xs text-slate-500 font-mono">{v.contact}</div></td>
                <td className="px-4 py-3">{v.age} / {v.gender}</td>
                <td className="px-4 py-3">{v.doctor || "—"}</td>
                <td className="px-4 py-3">₹{Number(v.fee).toFixed(2)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(v.visitDate).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {v.patientId && <Link to={`/patients/${v.patientId}`} className="text-[hsl(var(--brand))] font-medium hover:underline mr-3">Profile</Link>}
                  <button data-testid={`opd-slip-${v.appointmentNumber}`} onClick={() => setSlip(v)} className="p-1.5 hover:bg-slate-100 rounded" title="Print slip"><Printer className="w-4 h-4" /></button>
                  <button data-testid={`opd-delete-${v.appointmentNumber}`} onClick={() => del(v)} className="p-1.5 hover:bg-red-50 text-red-600 rounded ml-1" title="Delete"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-400">No OPD visits yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {slip && <OpdSlip visit={slip} settings={settings} onClose={() => setSlip(null)} />}
    </div>
  );
}
