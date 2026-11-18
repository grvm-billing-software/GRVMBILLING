import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";
import { BedDouble, FileText, Receipt, Send, User, Pencil } from "lucide-react";
import { PatientNotes } from "../components/PatientNotes";
import { IpdItems } from "../components/IpdItems";

export default function PatientProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [revisitDate, setRevisitDate] = useState("");
  const [refForm, setRefForm] = useState({ referringDoctor: "", center: "", testName: "", notes: "" });
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const load = () => api.get(`/patients/${id}`).then((r) => setData(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (!data) return <div className="p-8 text-slate-500">Loading...</div>;
  const p = data.patient;
  const activeIpd = data.ipd.find((i) => i.status === "admitted");
  const latestIpd = activeIpd || data.ipd[0];
  const canDischarge = !!activeIpd || data.opd.length > 0;

  const doDischarge = async () => {
    if (!summary.trim()) return toast.error("Please enter the discharge summary");
    if (!revisitDate) return toast.error("Please choose the revisit date");
    try {
      const { data: res } = await api.post(`/patients/${p.id}/discharge`, { summary, revisitDate });
      toast.success(`${res.type === "ipd" ? "IPD" : "OPD"} discharge saved. WhatsApp summary & revisit reminder queued.`);
      setDischargeOpen(false); setSummary(""); setRevisitDate("");
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Discharge failed"); }
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return toast.error("Name is required");
    const digits = (editForm.contact || "").replace(/\D/g, "");
    if (digits && !(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) return toast.error("Please enter a valid 10-digit mobile number");
    try {
      await api.patch(`/patients/${p.id}`, { ...editForm, age: Number(editForm.age || 0) });
      toast.success("Patient updated"); setEditOpen(false); load();
    } catch (err) { toast.error(err?.response?.data?.detail?.[0]?.msg || err?.response?.data?.detail || "Could not update"); }
  };

  const createReferral = async () => {
    if (!refForm.center && !refForm.referringDoctor) return toast.error("Please enter doctor or center");
    try {
      await api.post("/referrals", {
        patientId: p.id, patientName: p.name, patientContact: p.contact,
        ...refForm, referralDate: localDate(),
      });
      toast.success("Referral saved. WhatsApp queued.");
      setReferralOpen(false); setRefForm({ referringDoctor: "", center: "", testName: "", notes: "" });
      load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Referral failed"); }
  };

  return (
    <div className="p-8">
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] flex items-center justify-center"><User className="w-7 h-7" /></div>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-bold text-slate-900" data-testid="patient-name">{p.name}</h1>
            <p className="text-sm text-slate-500">{p.age} yrs · {p.gender || "—"} · <span className="font-mono">{p.contact || "—"}</span>{p.address && ` · ${p.address}`}</p>
          </div>
          {activeIpd && <span className="badge-soft bg-teal-50 text-teal-700">admitted · room {activeIpd.room || "—"}</span>}
          <button data-testid="edit-patient-btn" onClick={() => { setEditForm({ name: p.name, age: p.age, gender: p.gender, contact: p.contact, address: p.address || "" }); setEditOpen(true); }}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium inline-flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Edit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <ActionBtn test="action-discharge" onClick={() => setDischargeOpen(true)} icon={FileText} label="Patient Discharge" sub={activeIpd ? "IPD: summary + revisit date" : "OPD: summary + revisit date"} disabled={!canDischarge} />
        <ActionBtn test="action-admit" onClick={() => nav(`/ipd/admit?patientId=${p.id}`)} icon={BedDouble} label="Admit to IPD" sub={activeIpd ? "Already admitted" : "Open admission form"} disabled={!!activeIpd} />
        <ActionBtn test="action-invoice" onClick={() => nav(`/billing?patientId=${p.id}${canDischarge ? "&discharge=1" : ""}`)} icon={Receipt} label="Discharge w/ Medicine" sub="Invoice + revisit date" />
        <ActionBtn test="action-referral" onClick={() => setReferralOpen(true)} icon={Send} label="Referral" sub="Doctor / hospital" />
      </div>

      {latestIpd && <IpdItems admission={latestIpd} items={data.ipdItems || []} onChange={load} />}

      <PatientNotes patientId={p.id} notes={data.notes || []} onChange={load} />

      <HistoryTables data={data} />

      {editOpen && (
        <Modal onClose={() => setEditOpen(false)} title="Edit Patient">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *"><input data-testid="edit-name-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="inp" /></Field>
            <Field label="Age"><input data-testid="edit-age-input" type="number" min="0" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} className="inp" /></Field>
            <Field label="Gender">
              <select data-testid="edit-gender-input" value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="inp">
                <option value="">—</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </Field>
            <Field label="Mobile"><input data-testid="edit-contact-input" value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} className="inp" /></Field>
            <div className="col-span-2"><Field label="Address"><input data-testid="edit-address-input" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} className="inp" /></Field></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
            <button data-testid="edit-save-btn" onClick={saveEdit} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Save</button>
          </div>
          <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;}`}</style>
        </Modal>
      )}

      {dischargeOpen && (
        <Modal onClose={() => setDischargeOpen(false)} title="Patient Discharge">
          <p className="text-sm text-slate-500 mb-3">{activeIpd ? <>IPD admission: <span className="font-mono">{activeIpd.reason || "—"}</span></> : <>OPD patient · last OPD No. <span className="font-mono">{data.opd[0]?.appointmentNumber}</span></>}</p>
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 block">Written Clinical Summary *</label>
          <textarea data-testid="discharge-summary-input" value={summary} onChange={(e) => setSummary(e.target.value)} rows={6}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[hsl(var(--brand))]" placeholder="Diagnosis, procedure, medications, instructions..." />
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 mt-4 block">Revisit Date (follow-up) *</label>
          <input data-testid="revisit-date-input" type="date" min={localDate()} value={revisitDate} onChange={(e) => setRevisitDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-[hsl(var(--brand))]" />
          <div className="text-xs text-slate-500 mt-2">A bilingual Hindi/English WhatsApp reminder will be scheduled for this date.</div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setDischargeOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
            <button data-testid="discharge-submit-btn" onClick={doDischarge} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Complete Discharge</button>
          </div>
        </Modal>
      )}

      {referralOpen && (
        <Modal onClose={() => setReferralOpen(false)} title="Referral">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Referring Doctor"><input data-testid="ref-doctor-input" value={refForm.referringDoctor} onChange={(e) => setRefForm({ ...refForm, referringDoctor: e.target.value })} className="inp" /></Field>
            <Field label="Center / Hospital"><input data-testid="ref-center-input" value={refForm.center} onChange={(e) => setRefForm({ ...refForm, center: e.target.value })} className="inp" /></Field>
            <Field label="Test / Service"><input data-testid="ref-test-input" value={refForm.testName} onChange={(e) => setRefForm({ ...refForm, testName: e.target.value })} className="inp" /></Field>
            <Field label="Notes"><input value={refForm.notes} onChange={(e) => setRefForm({ ...refForm, notes: e.target.value })} className="inp" /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setReferralOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
            <button data-testid="referral-submit-btn" onClick={createReferral} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Save & Notify</button>
          </div>
          <style>{`.inp{width:100%;padding:0.5rem 0.75rem;border:1px solid #e2e8f0;border-radius:0.5rem;}`}</style>
        </Modal>
      )}
    </div>
  );
}

function ActionBtn({ test, onClick, icon: Icon, label, sub, disabled }) {
  return (
    <button data-testid={test} disabled={disabled} onClick={onClick}
      className={`stat-card text-left ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-[hsl(var(--brand))]"}`}>
      <div className="w-10 h-10 rounded-lg bg-[hsl(var(--brand-light))] text-[hsl(var(--brand))] flex items-center justify-center mb-3"><Icon className="w-5 h-5" /></div>
      <p className="font-display font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
    </button>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 block">{label}</span>{children}</label>;
}

function HistoryTables({ data }) {
  const Section = ({ title, rows, columns }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="font-display font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-400">—</p> :
        <table className="w-full text-sm">
          <thead><tr className="text-xs uppercase tracking-wider text-slate-500">{columns.map((c) => <th key={c.k} className="text-left py-2">{c.label}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-slate-100">{columns.map((c) => <td key={c.k} className="py-2">{c.fn ? c.fn(r) : r[c.k] ?? "—"}</td>)}</tr>)}</tbody>
        </table>}
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Section title="OPD Visits" rows={data.opd} columns={[
        { k: "appointmentNumber", label: "OPD No." },
        { k: "doctor", label: "Doctor" },
        { k: "fee", label: "Fee", fn: (r) => `₹${Number(r.fee).toFixed(2)}` },
        { k: "visitDate", label: "Date", fn: (r) => new Date(r.visitDate).toLocaleDateString("en-IN") },
        { k: "revisitDate", label: "Revisit", fn: (r) => r.revisitDate || "—" },
      ]} />
      <Section title="IPD Admissions" rows={data.ipd} columns={[
        { k: "reason", label: "Reason" },
        { k: "room", label: "Room" },
        { k: "status", label: "Status" },
        { k: "admissionAt", label: "Admitted", fn: (r) => new Date(r.admissionAt).toLocaleDateString("en-IN") },
        { k: "revisitDate", label: "Revisit", fn: (r) => r.revisitDate || "—" },
      ]} />
      <Section title="Invoices" rows={data.bills} columns={[
        { k: "invoiceNumber", label: "Invoice" },
        { k: "total", label: "Total", fn: (r) => r.status === "cancelled" ? <span><s className="text-slate-400">₹{Number(r.total).toFixed(2)}</s> <span className="badge-soft bg-red-50 text-red-700">cancelled</span></span> : `₹${Number(r.total).toFixed(2)}` },
        { k: "invoiceDate", label: "Date", fn: (r) => new Date(r.invoiceDate).toLocaleDateString() },
      ]} />
      <Section title="Referrals" rows={data.referrals} columns={[
        { k: "referringDoctor", label: "Doctor" },
        { k: "center", label: "Center" },
        { k: "testName", label: "Test" },
        { k: "referralDate", label: "Date" },
      ]} />
    </div>
  );
}
