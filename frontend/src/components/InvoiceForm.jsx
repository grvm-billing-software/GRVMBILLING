import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { QtyInput, qtyPayload } from "./QtyInput";
import { fmtQty, qtyLabel, toStrips } from "../lib/api";

const today = () => localDate();

export const InvoiceForm = ({ meds, settings, initial, onSaved, onClose }) => {
  const [form, setForm] = useState({ patientName: "", patientContact: "", discount: 0, description: "", ...initial });
  const [lines, setLines] = useState([]);
  const [charges, setCharges] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ipdItems, setIpdItems] = useState([]);
  const [dis, setDis] = useState({ on: !!initial.discharge, summary: "", revisitDate: "" });
  useEffect(() => { setCharges((settings.defaultCharges || []).map((label) => ({ label, amount: 0, fixed: true }))); }, [settings]);
  useEffect(() => {
    if (initial.patientId) api.get(`/patients/${initial.patientId}`).then((r) => setIpdItems((r.data.ipdItems || []).filter((i) => !i.billed)));
  }, [initial.patientId]);
  const addedIds = charges.filter((c) => c.ipdItemId).map((c) => c.ipdItemId);
  const pendingItems = ipdItems.filter((i) => !addedIds.includes(i.id));
  const addIpdItems = () => setCharges([...charges, ...pendingItems.map((i) => ({ label: `${i.name} × ${qtyLabel(i.quantity, i.tablets)} (IPD ${new Date(i.date).toLocaleDateString("en-IN")})`, amount: i.amount, ipdItemId: i.id }))]);

  const setLine = (i, patch) => setLines(lines.map((l, x) => (x === i ? { ...l, ...patch } : l)));
  const pickMed = (i, id) => {
    const m = meds.find((x) => x.id === id);
    setLine(i, m ? { medicineId: m.id, medicineName: m.name, batchNumber: m.batchNumber, unitPrice: m.sellingCost, unit: "strip" } : { medicineId: "" });
  };
  const medOf = (l) => meds.find((m) => m.id === l.medicineId);
  const strips = (l) => toStrips(medOf(l), l.unit, l.quantity);
  const setCharge = (i, patch) => setCharges(charges.map((c, x) => (x === i ? { ...c, ...patch } : c)));
  const medTotal = lines.reduce((s, l) => s + strips(l) * Number(l.unitPrice || 0), 0);
  const chargeTotal = charges.reduce((s, c) => s + Number(c.amount || 0), 0);
  const total = medTotal + chargeTotal - Number(form.discount || 0);

  const save = async () => {
    if (!form.patientName.trim()) return toast.error("Patient name is required");
    const good = lines.filter((l) => l.medicineId);
    if (good.length === 0 && chargeTotal <= 0) return toast.error("Add a medicine or a charge first");
    if (good.some((l) => !(strips(l) > 0))) return toast.error("Quantity must be more than 0");
    const over = good.find((l) => strips(l) > (medOf(l)?.quantity ?? 0) + 1e-9);
    if (over) return toast.error(`Not enough stock for ${over.medicineName} (only ${fmtQty(medOf(over)?.quantity)} strip left)`);
    if (total < 0) return toast.error("Discount is more than the bill");
    if (dis.on && !dis.revisitDate) return toast.error("Please choose the revisit date for discharge");
    setSaving(true);
    try {
      const { data } = await api.post("/bills", {
        ...form,
        discount: Number(form.discount || 0),
        ipdItemIds: addedIds,
        charges: charges.filter((c) => c.label.trim() && Number(c.amount) > 0).map((c) => ({ label: c.label.trim(), amount: Number(c.amount) })),
        lines: good.map((l) => ({ medicineId: l.medicineId, medicineName: l.medicineName, batchNumber: l.batchNumber, ...qtyPayload(medOf(l), l.unit, l.quantity), unitPrice: Number(l.unitPrice) })),
      });
      toast.success(`Invoice ${data.invoiceNumber} created`);
      if (dis.on) {
        try {
          await api.post(`/patients/${initial.patientId}/discharge`, { summary: dis.summary.trim() || `Discharged with medicines. Invoice ${data.invoiceNumber}.`, revisitDate: dis.revisitDate });
          toast.success("Patient discharged. Revisit reminder scheduled.");
        } catch (err) { toast.error(`Invoice saved, but discharge failed: ${err?.response?.data?.detail || "error"}`); }
      }
      onSaved(data);
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not save invoice"); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-3xl w-full p-6 my-6" onClick={(e) => e.stopPropagation()} data-testid="invoice-form">
        <h2 className="font-display text-xl font-bold mb-4">New Invoice</h2>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <input data-testid="bill-patient-name-input" placeholder="Patient Name *" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} className="inp" />
          <input data-testid="bill-patient-contact-input" placeholder="Mobile" value={form.patientContact} onChange={(e) => setForm({ ...form, patientContact: e.target.value })} className="inp" />
        </div>

        <Section title="Medicines (A to Z)">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select data-testid={`bill-line-med-${i}`} value={l.medicineId} onChange={(e) => pickMed(i, e.target.value)} className="inp col-span-5">
                <option value="">Select medicine</option>
                {meds.map((m) => <option key={m.id} value={m.id} disabled={m.quantity <= 0}>{m.name} · {m.batchNumber} · exp {m.expiryDate} · stock {fmtQty(m.quantity)}{m.tabletsPerStrip ? ` × ${m.tabletsPerStrip} tab` : ""}</option>)}
              </select>
              <QtyInput testid={`bill-line-qty-${i}`} med={medOf(l)} unit={l.unit} qty={l.quantity} onChange={(v) => setLine(i, { unit: v.unit, quantity: v.qty })} className="col-span-3" />
              <input data-testid={`bill-line-rate-${i}`} type="number" min="0" title="Rate per strip" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} className="inp col-span-2" />
              <span className="col-span-1 text-right font-mono text-xs">₹{(strips(l) * Number(l.unitPrice || 0)).toFixed(2)}</span>
              <button onClick={() => setLines(lines.filter((_, x) => x !== i))} className="text-red-600 justify-self-end"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button data-testid="bill-add-line-btn" onClick={() => setLines([...lines, { medicineId: "", quantity: 1, unit: "strip", unitPrice: 0 }])} className="text-sm text-[hsl(var(--brand))] font-semibold">+ Add medicine</button>
        </Section>

        <Section title="Charges">
          {charges.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input data-testid={`bill-charge-label-${i}`} value={c.label} readOnly={c.fixed} placeholder="Charge name" onChange={(e) => setCharge(i, { label: e.target.value })} className={`inp col-span-8 ${c.fixed ? "bg-slate-50" : ""}`} />
              <input data-testid={`bill-charge-amount-${i}`} type="number" min="0" value={c.amount} onChange={(e) => setCharge(i, { amount: e.target.value })} className="inp col-span-3" />
              {!c.fixed && <button onClick={() => setCharges(charges.filter((_, x) => x !== i))} className="text-red-600 justify-self-end"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
          <button data-testid="bill-add-charge-btn" onClick={() => setCharges([...charges, { label: "", amount: 0 }])} className="text-sm text-[hsl(var(--brand))] font-semibold">+ Add other charge</button>
          {pendingItems.length > 0 && (
            <button data-testid="bill-add-ipd-items-btn" onClick={addIpdItems} className="ml-4 text-sm text-teal-700 font-semibold">+ Add {pendingItems.length} IPD item(s) used (₹{pendingItems.reduce((s, i) => s + i.amount, 0).toFixed(2)})</button>
          )}
        </Section>

        {initial.patientId && (
          <div className="mb-5 p-4 rounded-lg border border-slate-200 bg-slate-50" data-testid="bill-discharge-section">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input data-testid="bill-discharge-toggle" type="checkbox" checked={dis.on} onChange={(e) => setDis({ ...dis, on: e.target.checked })} /> Discharge this patient after saving
            </label>
            {dis.on && (
              <div className="grid grid-cols-3 gap-3 mt-3">
                <label className="block"><span className="lbl">Revisit Date *</span>
                  <input data-testid="bill-revisit-date-input" type="date" min={today()} value={dis.revisitDate} onChange={(e) => setDis({ ...dis, revisitDate: e.target.value })} className="inp" /></label>
                <label className="block col-span-2"><span className="lbl">Discharge summary (optional)</span>
                  <input data-testid="bill-discharge-summary-input" value={dis.summary} onChange={(e) => setDis({ ...dis, summary: e.target.value })} className="inp" /></label>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <label className="block"><span className="lbl">Discount ₹</span>
            <input data-testid="bill-discount-input" type="number" min="0" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="inp" /></label>
          <label className="block col-span-2"><span className="lbl">Description (optional, printed on invoice)</span>
            <textarea data-testid="bill-description-input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="inp" /></label>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg mb-4 text-sm space-y-1">
          <div className="flex justify-between"><span>Medicines</span><span>₹{medTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Charges</span><span>₹{chargeTotal.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>- ₹{Number(form.discount || 0).toFixed(2)}</span></div>
          <div className="flex justify-between pt-2 border-t border-slate-200"><span className="font-semibold">Grand Total</span><span data-testid="bill-total" className="font-display text-2xl font-bold text-[hsl(var(--brand))]">₹{total.toFixed(2)}</span></div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
          <button data-testid="save-invoice-btn" disabled={saving} onClick={save} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold disabled:opacity-60">Save & Print</button>
        </div>
        <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;}.lbl{display:block;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;font-weight:500;margin-bottom:0.25rem;}`}</style>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mb-5 space-y-2"><p className="text-sm font-semibold text-slate-800">{title}</p>{children}</div>
);

export { today };
