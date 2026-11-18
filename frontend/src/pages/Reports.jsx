import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Reports() {
  const [data, setData] = useState({});
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const load = () => {
    const p = new URLSearchParams();
    if (start) p.set("startDate", start);
    if (end) p.set("endDate", end);
    api.get(`/reports/summary?${p.toString()}`).then((r) => setData(r.data));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);
  const cards = [["bills","Invoices"],["revenue","Revenue (₹)"],["opdVisits","OPD Visits"],["ipdCurrent","Admitted now"],["referrals","Total Referrals"]];
  return (
    <div className="p-8">
      <h1 className="font-display text-3xl font-bold text-slate-900 mb-6">Reports</h1>
      <div className="flex gap-3 mb-6">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg" />
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(([k, l]) => (
          <div key={k} className="stat-card">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">{l}</p>
            <p className="font-display text-3xl font-bold text-slate-900 mt-2">{k === "revenue" ? `₹${Number(data[k] || 0).toFixed(2)}` : data[k] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
