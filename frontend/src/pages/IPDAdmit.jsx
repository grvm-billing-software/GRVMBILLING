import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function IPDAdmit() {
  const [params] = useSearchParams();
  const pid = params.get("patientId");
  const nav = useNavigate();
  const [form, setForm] = useState({ patientName: "", patientContact: "", room: "", doctor: "", reason: "" });

  useEffect(() => {
    if (pid) api.get(`/patients/${pid}`).then((r) => {
      setForm((f) => ({ ...f, patientName: r.data.patient.name, patientContact: r.data.patient.contact }));
    });
  }, [pid]);

  const submit = async () => {
    if (!form.patientName) return toast.error("Patient name is required");
    try {
      const { data } = await api.post("/ipd-admissions", { ...form, patientId: pid || null, admissionAt: new Date().toISOString() });
      toast.success("Admitted to IPD");
      if (pid) nav(`/patients/${pid}`); else nav("/ipd");
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not admit"); }
  };
  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-slate-900 mb-6">Admit to IPD</h1>
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <Field label="Patient Name *"><input data-testid="ipd-name-input" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} className="inp" /></Field>
        <Field label="Contact"><input data-testid="ipd-contact-input" value={form.patientContact} onChange={(e) => setForm({ ...form, patientContact: e.target.value })} className="inp" /></Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Room"><input data-testid="ipd-room-input" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className="inp" /></Field>
          <Field label="Doctor"><input data-testid="ipd-doctor-input" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} className="inp" /></Field>
        </div>
        <Field label="Reason / Diagnosis"><textarea data-testid="ipd-reason-input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="inp" /></Field>
        <div className="flex justify-end gap-2">
          <button onClick={() => nav(-1)} className="px-4 py-2 rounded-lg border border-slate-200">Cancel</button>
          <button data-testid="ipd-save-btn" onClick={submit} className="px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold">Admit</button>
        </div>
      </div>
      <style>{`.inp{width:100%;padding:0.6rem 0.9rem;border:1px solid #e2e8f0;border-radius:0.5rem;background:#fff;}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 block">{label}</span>{children}</label>;
}
