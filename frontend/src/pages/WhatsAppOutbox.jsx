import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Send, CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";

const STATUS_STYLE = {
  queued: "bg-amber-50 text-amber-700",
  scheduled: "bg-blue-50 text-blue-700",
  sent: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

const CAT_LABEL = {
  opd_register: "OPD Registered",
  discharge_summary: "Discharge",
  referral: "Referral",
  revisit_reminder: "Revisit Reminder",
  invoice: "Invoice",
  manual: "Manual",
};

export default function WhatsAppOutbox() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState("all");
  const load = () => api.get(`/whatsapp/messages${filter === "all" ? "" : `?status=${filter}`}`).then((r) => setList(r.data));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter]);
  const markSent = async (id) => { await api.post(`/whatsapp/messages/${id}/mark-sent`); toast.success("Marked sent"); load(); };
  const markFailed = async (id) => { await api.post(`/whatsapp/messages/${id}/mark-failed`, { error: "Manual mark" }); load(); };
  const sendNow = (m) => { if (!m.waLink) return toast.error("No valid number"); window.open(m.waLink, "_blank"); };
  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="wa-title">WhatsApp Outbox</h1>
        <p className="text-slate-500 mt-1">Bilingual Hindi/English messages · click-to-send via your WhatsApp Web</p>
      </header>
      <div className="flex gap-2 mb-4">
        {["all","queued","scheduled","sent","failed"].map((s) => (
          <button key={s} data-testid={`wa-filter-${s}`} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === s ? "bg-[hsl(var(--brand))] text-white" : "bg-slate-100 text-slate-600"}`}>{s}</button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((m) => (
          <div key={m.id} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`badge-soft ${STATUS_STYLE[m.status]}`}>
                    {m.status === "sent" && <CheckCircle className="w-3 h-3" />}
                    {m.status === "failed" && <XCircle className="w-3 h-3" />}
                    {m.status === "queued" && <Clock className="w-3 h-3" />}
                    {m.status === "scheduled" && <Clock className="w-3 h-3" />}
                    {m.status}
                  </span>
                  <span className="text-xs font-medium text-slate-500">{CAT_LABEL[m.category] || m.category}</span>
                  <span className="text-xs text-slate-400">· {new Date(m.createdAt).toLocaleString()}</span>
                  {m.scheduledFor && <span className="text-xs text-blue-700">· for {new Date(m.scheduledFor).toLocaleString()}</span>}
                </div>
                <p className="font-medium text-slate-900">{m.patientName || "—"} <span className="text-xs font-mono text-slate-500 ml-2">{m.toNumber}</span></p>
                <pre className="text-xs text-slate-600 mt-2 whitespace-pre-wrap font-sans">{m.body}</pre>
                {m.error && <p className="text-xs text-red-600 mt-2">Error: {m.error}</p>}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button data-testid={`wa-send-${m.id}`} onClick={() => sendNow(m)}
                  className="px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:brightness-110">
                  <Send className="w-3.5 h-3.5" /> Send on WhatsApp <ExternalLink className="w-3 h-3" />
                </button>
                {m.status !== "sent" && <button data-testid={`wa-mark-sent-${m.id}`} onClick={() => markSent(m.id)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium">Mark sent</button>}
                {m.status !== "failed" && <button onClick={() => markFailed(m.id)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-red-600">Mark failed</button>}
              </div>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-slate-400 py-12">No messages.</p>}
      </div>
    </div>
  );
}
