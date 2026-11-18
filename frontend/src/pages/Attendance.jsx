import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";

export default function Attendance() {
  const [date, setDate] = useState(localDate());
  const [staff, setStaff] = useState([]);
  const [att, setAtt] = useState({});
  useEffect(() => { api.get("/staff").then((r) => setStaff(r.data)); }, []);
  useEffect(() => {
    api.get(`/attendance?date=${date}`).then((r) => {
      const map = {}; r.data.forEach((a) => (map[a.staffId] = a.status));
      setAtt(map);
    });
  }, [date]);
  const mark = async (s, status) => {
    try {
      await api.post("/attendance", { staffId: s.id, staffName: s.name, date, status });
      setAtt((a) => ({ ...a, [s.id]: status }));
    } catch { toast.error("Failed"); }
  };
  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900">Attendance</h1>
        <input data-testid="attendance-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg" />
      </header>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider"><tr><th className="text-left px-4 py-3">Staff</th><th className="text-left px-4 py-3">Designation</th><th className="text-left px-4 py-3">Status</th></tr></thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{s.name}</td><td className="px-4 py-3">{s.designation}</td>
                <td className="px-4 py-3">
                  {["present","absent","leave"].map((st) => (
                    <button key={st} data-testid={`att-${s.id}-${st}`} onClick={() => mark(s, st)}
                      className={`px-3 py-1 rounded-full text-xs font-medium mr-2 ${att[s.id] === st ? (st === "present" ? "bg-green-600 text-white" : st === "absent" ? "bg-red-600 text-white" : "bg-amber-500 text-white") : "bg-slate-100 text-slate-600"}`}>
                      {st}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
            {staff.length === 0 && <tr><td colSpan="3" className="px-4 py-10 text-center text-slate-400">Add staff first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
