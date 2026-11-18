import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { Plus, Search } from "lucide-react";
import { InvoiceForm } from "../components/InvoiceForm";
import { InvoicePrint } from "../components/InvoicePrint";

export default function Billing() {
  const [params] = useSearchParams();
  const pid = params.get("patientId");
  const [bills, setBills] = useState([]);
  const [meds, setMeds] = useState([]);
  const [settings, setSettings] = useState({});
  const [initial, setInitial] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [q, setQ] = useState("");

  const load = () => api.get(`/bills${q ? `?search=${encodeURIComponent(q)}` : ""}`).then((r) => setBills(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [q]);
  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data));
    if (pid) api.get(`/patients/${pid}`).then((r) => setInitial({ patientId: pid, patientName: r.data.patient.name, patientContact: r.data.patient.contact, discharge: params.get("discharge") === "1" }));
  }, [pid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (initial) api.get("/medicines").then((r) => setMeds(r.data)); }, [initial]);

  return (
    <div className="p-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="billing-title">Billing & Invoices</h1>
          <p className="text-slate-500 mt-1">Medicines, charges, discount and printable invoices</p>
        </div>
        <button data-testid="new-invoice-btn" onClick={() => setInitial({})}
          className="px-4 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> New Invoice</button>
      </header>
      <div className="mb-4 relative w-full md:w-96">
        <Search className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
        <input data-testid="bill-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice, patient or mobile"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white outline-none" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr><th className="text-left px-4 py-3">Invoice</th><th className="text-left px-4 py-3">Patient</th><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Total</th><th></th></tr>
          </thead>
          <tbody>
            {bills.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{b.invoiceNumber}</td>
                <td className="px-4 py-3 font-medium">{b.patientName}<div className="text-xs text-slate-500 font-mono">{b.patientContact}</div></td>
                <td className="px-4 py-3 text-slate-500 text-xs">{new Date(b.invoiceDate).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 font-display font-bold"><span className={b.status === "cancelled" ? "line-through text-slate-400" : ""}>₹{Number(b.total).toFixed(2)}</span>{b.status === "cancelled" && <span data-testid={`bill-cancelled-${b.invoiceNumber}`} className="ml-2 badge-soft bg-red-50 text-red-700">cancelled</span>}</td>
                <td className="px-4 py-3 text-right"><button data-testid={`view-bill-${b.invoiceNumber}`} onClick={() => setViewing(b)} className="text-[hsl(var(--brand))] font-medium">View / Print</button></td>
              </tr>
            ))}
            {bills.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-400">No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {initial && (
        <InvoiceForm meds={meds} settings={settings} initial={initial} onClose={() => setInitial(null)}
          onSaved={(b) => { setInitial(null); setViewing(b); load(); }} />
      )}
      {viewing && <InvoicePrint bill={viewing} settings={settings} onClose={() => setViewing(null)} onChanged={(b) => { setViewing(b); load(); }} />}
    </div>
  );
}
