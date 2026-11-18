import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { OpdSlip } from "../components/OpdSlip";

export default function OPDRegister() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ patientName: "", age: "", gender: "Male", contact: "", doctor: "", notes: "" });
  const [defaultFee, setDefaultFee] = useState(300);
  const [fee, setFee] = useState(300);
  const [settings, setSettings] = useState({});
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const nav = useNavigate();
  useEffect(() => { api.get("/settings").then((r) => { setSettings(r.data); setDefaultFee(r.data.defaultOpdFee ?? 300); setFee(r.data.defaultOpdFee ?? 300); }); }, []);
  const next = () => {
    if (!form.patientName.trim() || form.age === "" || !form.contact) {
      toast.error("Name, age and contact number are required");
      return;
    }
    if (Number(form.age) < 0 || Number(form.age) > 130) return toast.error("Please enter a valid age");
    const digits = form.contact.replace(/\D/g, ""); if (!(digits.length === 10 || (digits.length === 12 && digits.startsWith("91")))) return toast.error("Please enter a valid 10-digit mobile number");
    setStep(2);
  };
  const submit = async () => {
    if (fee === "" || Number(fee) < 0) return toast.error("Please enter a valid charge");
    setSaving(true);
    try {
      const { data } = await api.post("/opd-visits", { ...form, age: Number(form.age), fee: Number(fee), visitDate: new Date().toISOString() });
      toast.success(`OPD No. ${data.appointmentNumber} registered. WhatsApp message queued.`);
      setSaved(data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Could not register patient");
    }
    setSaving(false);
  };
  if (saved) return <OpdSlip visit={saved} settings={settings} onClose={() => nav(`/patients/${saved.patientId}`)} />;
  return (
    <div className="p-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-slate-900 mb-1" data-testid="opd-register-title">Register OPD Patient</h1>
      <p className="text-slate-500 mb-6">Two-step registration</p>
      <div className="flex gap-2 mb-6">
        <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-[hsl(var(--brand))]" : "bg-slate-200"}`} />
        <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-[hsl(var(--brand))]" : "bg-slate-200"}`} />
      </div>

      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Step 1 · Patient Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Patient Name *"><input data-testid="opd-name-input" value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} className="input" /></Field>
            <Field label="Age *"><input data-testid="opd-age-input" type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} className="input" /></Field>
            <Field label="Gender *">
              <select data-testid="opd-gender-input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="input">
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </Field>
            <Field label="Mobile Number *"><input data-testid="opd-contact-input" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="10-digit mobile" className="input" /></Field>
            <Field label="Doctor"><input data-testid="opd-doctor-input" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} className="input" /></Field>
            <Field label="Notes"><input data-testid="opd-notes-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" /></Field>
          </div>
          <div className="flex justify-end pt-2">
            <button data-testid="opd-next-btn" onClick={next} className="btn-primary inline-flex items-center gap-2">Next <ArrowRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Step 2 · Confirm Charges</h2>
          <div className="bg-[hsl(var(--brand-light))] rounded-lg p-4 flex items-center justify-between">
            <div><p className="text-xs uppercase tracking-wider text-slate-500">Default OPD Charge</p><p className="font-display text-2xl font-bold text-[hsl(var(--brand))]">₹{Number(defaultFee).toFixed(2)}</p></div>
            <div className="text-xs text-slate-500">You can override below for this patient</div>
          </div>
          <Field label="Patient-Specific Charge (₹) *">
            <input data-testid="opd-fee-input" type="number" value={fee} onChange={(e) => setFee(e.target.value)} className="input" />
          </Field>
          <div className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg p-3">
            After saving, a bilingual WhatsApp confirmation (with appointment & charge) will be queued for <span className="font-mono">{form.contact || "—"}</span>.
          </div>
          <div className="flex items-center justify-between pt-2">
            <button data-testid="opd-back-btn" onClick={() => setStep(1)} className="btn-ghost inline-flex items-center gap-2"><ArrowLeft className="w-4 h-4" /> Back</button>
            <button data-testid="opd-save-btn" disabled={saving} onClick={submit} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"><Check className="w-4 h-4" /> Save & Notify</button>
          </div>
        </div>
      )}

      <style>{`
        .input { width:100%; padding:0.6rem 0.9rem; border:1px solid #e2e8f0; border-radius:0.5rem; background:#fff; outline:none; }
        .input:focus { border-color:hsl(var(--brand)); box-shadow:0 0 0 3px hsl(var(--brand-light)); }
        .btn-primary { background:hsl(var(--brand)); color:#fff; padding:0.65rem 1.2rem; border-radius:0.5rem; font-weight:600; }
        .btn-primary:hover { background:hsl(var(--brand-hover)); }
        .btn-ghost { padding:0.65rem 1.2rem; border-radius:0.5rem; border:1px solid #e2e8f0; font-weight:600; background:#fff; }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1 block">{label}</span>{children}</label>;
}
