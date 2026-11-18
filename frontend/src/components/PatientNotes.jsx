import { useEffect, useState } from "react";
import { api, localDate } from "../lib/api";
import { toast } from "sonner";
import { Camera, Trash2, Loader2 } from "lucide-react";

const Photo = ({ id, name }) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let u;
    api.get(`/files/${id}`, { responseType: "blob" }).then((r) => { u = URL.createObjectURL(r.data); setUrl(u); }).catch(() => {});
    return () => u && URL.revokeObjectURL(u);
  }, [id]);
  if (!url) return <div className="w-28 h-28 rounded-lg bg-slate-100 animate-pulse" />;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={name} className="w-28 h-28 object-cover rounded-lg border border-slate-200 hover:opacity-90" /></a>;
};

export const PatientNotes = ({ patientId, notes, onChange }) => {
  const [date, setDate] = useState(localDate());
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!description.trim() && files.length === 0) return toast.error("Add a description or a photo");
    const fd = new FormData();
    fd.append("date", date);
    fd.append("description", description);
    files.forEach((f) => fd.append("files", f));
    setSaving(true);
    try {
      await api.post(`/patients/${patientId}/notes`, fd);
      toast.success("Record saved");
      setDescription(""); setFiles([]);
      onChange();
    } catch (err) { toast.error(err?.response?.data?.detail || "Could not save"); }
    setSaving(false);
  };
  const remove = async (id) => {
    if (!window.confirm("Remove this record?")) return;
    await api.delete(`/patients/${patientId}/notes/${id}`);
    onChange();
  };
  const byDate = notes.reduce((acc, n) => ((acc[n.date] = acc[n.date] || []).push(n), acc), {});

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6" data-testid="patient-notes">
      <h3 className="font-display font-semibold mb-3 flex items-center gap-2"><Camera className="w-4 h-4 text-[hsl(var(--brand))]" /> Photos & Notes (date-wise)</h3>
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-5">
        <input data-testid="note-date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg" />
        <textarea data-testid="note-description-input" rows={1} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="md:col-span-5 px-3 py-2 border border-slate-200 rounded-lg" />
        <label className="md:col-span-3 px-3 py-2 border border-dashed border-slate-300 rounded-lg text-sm text-slate-600 cursor-pointer truncate">
          {files.length ? `${files.length} photo(s) selected` : "Choose photos"}
          <input data-testid="note-photos-input" type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...e.target.files])} />
        </label>
        <button data-testid="note-save-btn" disabled={saving} onClick={save} className="md:col-span-2 px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
        </button>
      </div>
      {notes.length === 0 ? <p className="text-sm text-slate-400">No photos or notes yet.</p> : (
        <div className="space-y-5">
          {Object.keys(byDate).sort().reverse().map((d) => (
            <div key={d}>
              <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--brand))] mb-2">{new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
              <div className="space-y-3 border-l-2 border-[hsl(var(--brand-light))] pl-4">
                {byDate[d].map((n) => (
                  <div key={n.id} data-testid={`note-${n.id}`} className="flex gap-3 items-start">
                    <div className="flex-1">
                      {n.description && <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{n.description}</p>}
                      <div className="flex flex-wrap gap-2">{n.photos.map((p) => <Photo key={p.id} id={p.id} name={p.filename} />)}</div>
                    </div>
                    <button onClick={() => remove(n.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
