import { useEffect, useState } from "react";
import { api, fmtQty } from "../lib/api";

const LABEL = { created: "Added", adjustment: "Adjusted", sale: "Sold (invoice)", returned: "Returned", family: "Family", ipd_use: "IPD use" };
const COLOR = { sale: "text-indigo-700", family: "text-amber-700", ipd_use: "text-teal-700", returned: "text-green-700" };

export const StockHistory = ({ refreshKey }) => {
  const [list, setList] = useState([]);
  useEffect(() => { api.get("/inventory-logs?limit=500").then((r) => setList(r.data)); }, [refreshKey]);
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="stock-history">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
          <tr><th className="text-left px-4 py-3">When</th><th className="text-left px-4 py-3">Medicine</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Change</th><th className="text-left px-4 py-3">Stock after</th><th className="text-left px-4 py-3">Details</th></tr>
        </thead>
        <tbody>
          {list.map((l) => (
            <tr key={l.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-xs text-slate-500">{new Date(l.createdAt).toLocaleString("en-IN")}</td>
              <td className="px-4 py-3 font-medium">{l.medicineName} <span className="font-mono text-xs text-slate-500">{l.batchNumber}</span></td>
              <td className={`px-4 py-3 font-medium ${COLOR[l.action] || ""}`}>{LABEL[l.action] || l.action}</td>
              <td className={`px-4 py-3 font-mono ${l.quantityChange < 0 ? "text-red-600" : "text-green-700"}`}>{l.quantityChange > 0 ? `+${fmtQty(l.quantityChange)}` : fmtQty(l.quantityChange)}</td>
              <td className="px-4 py-3">{fmtQty(l.quantityAfter)}</td>
              <td className="px-4 py-3 text-slate-500 text-xs">{l.notes}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-400">No stock changes yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
