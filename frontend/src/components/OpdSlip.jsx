import { Printer, X } from "lucide-react";

export const OpdSlip = ({ visit, settings, onClose }) => (
  <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center p-4 overflow-y-auto print-overlay" onClick={onClose}>
    <div className="bg-white rounded-xl max-w-2xl w-full my-6 print-area" onClick={(e) => e.stopPropagation()} data-testid="opd-slip">
      <div className="flex justify-end gap-2 p-3 border-b border-slate-100 no-print">
        <button data-testid="opd-slip-print-btn" onClick={() => window.print()} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--brand))] text-white text-sm font-semibold inline-flex items-center gap-1.5"><Printer className="w-4 h-4" /> Print</button>
        <button data-testid="opd-slip-close-btn" onClick={onClose} className="p-1.5 rounded-lg border border-slate-200"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-8 text-slate-900 print-body">
        <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
          <h1 className="font-display text-2xl font-extrabold tracking-wide">{settings.hospitalName}</h1>
          <p className="text-sm">{settings.hospitalAddress}</p>
          <p className="text-xs uppercase tracking-[0.3em] mt-2 font-semibold">OPD Slip</p>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div className="border-2 border-slate-800 rounded-lg px-5 py-2 text-center">
            <p className="text-xs uppercase tracking-wider">OPD No.</p>
            <p className="font-display text-4xl font-extrabold" data-testid="opd-slip-number">{visit.appointmentNumber}</p>
          </div>
          <p className="text-sm">Date: <b>{new Date(visit.visitDate).toLocaleString("en-IN")}</b></p>
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <p>Patient: <b>{visit.patientName}</b></p>
          <p>Age / Gender: <b>{visit.age} / {visit.gender}</b></p>
          <p>Mobile: <b>{visit.contact || "—"}</b></p>
          <p>Doctor: <b>{visit.doctor || "—"}</b></p>
          <p>OPD Fee: <b>₹{Number(visit.fee).toFixed(2)}</b></p>
          {visit.notes && <p>Notes: {visit.notes}</p>}
        </div>
        <div className="mt-6 border-t border-dashed border-slate-400 pt-3 min-h-[180px]">
          <p className="text-xs uppercase tracking-wider text-slate-500">Rx / Doctor's notes</p>
        </div>
        <div className="flex justify-end mt-8 text-sm"><p className="border-t border-slate-800 pt-1 w-48 text-center">Doctor's Signature</p></div>
      </div>
    </div>
  </div>
);
