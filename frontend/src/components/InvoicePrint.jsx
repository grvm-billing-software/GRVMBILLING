import { Printer, X, Ban } from "lucide-react";
import { api, qtyLabel } from "../lib/api";
import { toast } from "sonner";

const money = (n) => `₹${Number(n || 0).toFixed(2)}`;

export const InvoicePrint = ({ bill, settings, onClose, onChanged }) => {
  const cancelled = bill.status === "cancelled";
  const cancel = async () => {
    const reason = window.prompt("Reason for cancelling this invoice? Medicines will go back to stock.");
    if (reason === null) return;
    try {
      const { data } = await api.post(`/bills/${bill.id}/cancel`, { reason });
      toast.success(`Invoice ${data.invoiceNumber} cancelled, stock returned`);
      onChanged && onChanged(data);
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not cancel"); }
  };
  const legacy = [["OPD Fee", bill.opdFee], ["IPD Fee", bill.ipdFee], ["Lab Fee", bill.labFee]].filter(([, v]) => v > 0);
  const charges = [...(bill.charges || []).map((c) => [c.label, c.amount]), ...legacy];
  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center p-4 overflow-y-auto print-overlay" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full my-6 print-area" onClick={(e) => e.stopPropagation()} data-testid="invoice-print">
        <div className="flex justify-end gap-2 p-3 border-b border-slate-100 no-print">
          {!cancelled && <button data-testid="invoice-cancel-btn" onClick={cancel} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-sm font-semibold inline-flex items-center gap-1.5 mr-auto"><Ban className="w-4 h-4" /> Cancel Invoice</button>}
          <button data-testid="invoice-print-btn" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--brand))] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Printer className="w-4 h-4" /> Print</button>
          <button data-testid="invoice-close-btn" onClick={onClose} className="p-1.5 rounded-lg border border-slate-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-8 text-slate-900 print-body relative">
          {cancelled && <div data-testid="invoice-cancelled-stamp" className="absolute top-40 left-1/2 -translate-x-1/2 -rotate-12 border-4 border-red-600 text-red-600 text-5xl font-extrabold px-6 py-2 opacity-70 pointer-events-none">CANCELLED</div>}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-4">
            <h1 className="font-display text-3xl font-extrabold tracking-wide" data-testid="invoice-hospital-name">{settings.hospitalName}</h1>
            <p className="text-sm mt-1" data-testid="invoice-hospital-address">{settings.hospitalAddress}</p>
            <p className="text-xs uppercase tracking-[0.3em] mt-3 font-semibold">Patient Invoice</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm mb-5">
            <p><span className="text-slate-500">Patient:</span> <b data-testid="invoice-patient-name">{bill.patientName}</b></p>
            <p className="text-right"><span className="text-slate-500">Invoice No:</span> <b className="font-mono">{bill.invoiceNumber}</b></p>
            <p><span className="text-slate-500">Mobile:</span> {bill.patientContact || "—"}</p>
            <p className="text-right"><span className="text-slate-500">Date:</span> {new Date(bill.invoiceDate).toLocaleString("en-IN")}</p>
          </div>
          {bill.lines?.length > 0 && (
            <table className="w-full text-sm border border-slate-300 mb-4">
              <thead className="bg-slate-100">
                <tr>{["#", "Medicine", "Batch", "MRP", "Qty", "Amount"].map((h) => <th key={h} className="border border-slate-300 px-2 py-1.5 text-left">{h}</th>)}</tr>
              </thead>
              <tbody>
                {bill.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="border border-slate-300 px-2 py-1">{i + 1}</td>
                    <td className="border border-slate-300 px-2 py-1">{l.medicineName}</td>
                    <td className="border border-slate-300 px-2 py-1 font-mono text-xs">{l.batchNumber}</td>
                    <td className="border border-slate-300 px-2 py-1">{l.mrp ? money(l.mrp) : "—"}</td>
                    <td className="border border-slate-300 px-2 py-1" data-testid={`invoice-line-qty-${i}`}>{qtyLabel(l.quantity, l.tablets)}</td>
                    <td className="border border-slate-300 px-2 py-1 text-right">{money(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {charges.length > 0 && (
            <table className="w-full text-sm border border-slate-300 mb-4">
              <thead className="bg-slate-100"><tr><th className="border border-slate-300 px-2 py-1.5 text-left">Charges</th><th className="border border-slate-300 px-2 py-1.5 text-right">Amount</th></tr></thead>
              <tbody>{charges.map(([l, a], i) => <tr key={i}><td className="border border-slate-300 px-2 py-1">{l}</td><td className="border border-slate-300 px-2 py-1 text-right">{money(a)}</td></tr>)}</tbody>
            </table>
          )}
          <div className="ml-auto w-72 text-sm space-y-1">
            <Row l="Medicine total" r={money(bill.medicineSubtotal)} />
            <Row l="Charges total" r={money((bill.chargesTotal || 0) + (bill.opdFee || 0) + (bill.ipdFee || 0) + (bill.labFee || 0))} />
            <Row l="Discount" r={`- ${money(bill.discount)}`} />
            <div className="flex justify-between border-t-2 border-slate-800 pt-2 font-display text-xl font-bold"><span>Grand Total</span><span data-testid="invoice-grand-total">{money(bill.total)}</span></div>
          </div>
          {bill.description && (
            <div className="mt-5 border border-slate-300 rounded p-3 text-sm" data-testid="invoice-description">
              <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">Description</p>
              <p className="whitespace-pre-wrap">{bill.description}</p>
            </div>
          )}
          {cancelled && <p className="mt-4 text-sm text-red-600">Cancelled on {new Date(bill.cancelledAt).toLocaleString("en-IN")}{bill.cancelReason ? ` — ${bill.cancelReason}` : ""}</p>}
          <div className="flex justify-between items-end mt-12 text-sm">
            <p className="text-slate-500">Thank you. Get well soon.</p>
            <p className="border-t border-slate-800 pt-1 w-48 text-center">Authorised Signature</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ l, r }) => <div className="flex justify-between"><span className="text-slate-500">{l}</span><span>{r}</span></div>;
