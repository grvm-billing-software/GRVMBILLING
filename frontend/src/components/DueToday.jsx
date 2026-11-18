import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Phone, MessageCircle, CalendarClock, Check } from "lucide-react";

const waLink = (num, name) => {
  let d = (num || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(`नमस्ते ${name} 🙏 आज आपकी फॉलो-अप जांच है। / Hello ${name}, your follow-up visit is today.`)}`;
};

export const DueToday = ({ onCount }) => {
  const [list, setList] = useState([]);
  const load = () => api.get("/followups/today").then((r) => { setList(r.data); onCount && onCount(r.data.length); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  const toggle = async (f) => {
    try { await api.post(`/followups/${f.kind}/${f.id}/called`, { called: !f.called }); load(); }
    catch { toast.error("Could not update"); }
  };
  return (
    <div className="stat-card mb-6" data-testid="due-today-list">
      <h3 className="font-display text-lg font-semibold text-slate-900 mb-1 flex items-center gap-2">
        <CalendarClock className="w-5 h-5 text-rose-600" /> Patients due today ({list.length})
      </h3>
      <p className="text-xs text-slate-500 mb-4">Follow-up date is today: please call them</p>
      {list.length === 0 ? <p className="text-sm text-slate-400">No follow-ups due today.</p> : (
        <div className="divide-y divide-slate-100">
          {list.map((f) => (
            <div key={`${f.kind}-${f.id}`} className="flex items-center gap-4 py-3" data-testid={`due-row-${f.id}`}>
              <div className="flex-1 min-w-0">
                {f.patientId ? <Link to={`/patients/${f.patientId}`} className="font-medium text-slate-900 hover:underline">{f.patientName}</Link> : <p className="font-medium">{f.patientName}</p>}
                <span className="badge-soft bg-slate-100 text-slate-600 ml-2 uppercase">{f.kind}</span>
                <p className="text-xs text-slate-500"><span className="font-mono">{f.patientContact || "no number"}</span>{f.doctor && ` · ${f.doctor}`}{f.reason && ` · ${f.reason}`}</p>
              </div>
              {f.patientContact && <a data-testid={`due-call-${f.id}`} href={`tel:${f.patientContact}`} className="px-3 py-1.5 rounded-lg bg-[hsl(var(--brand))] text-white text-xs font-semibold inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Call</a>}
              {f.patientContact && <a href={waLink(f.patientContact, f.patientName)} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold inline-flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>}
              <button data-testid={`due-called-${f.id}`} onClick={() => toggle(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border ${f.called ? "bg-green-50 border-green-200 text-green-700" : "border-slate-200 text-slate-600"}`}>
                <Check className="w-3.5 h-3.5" /> {f.called ? "Called" : "Mark called"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
