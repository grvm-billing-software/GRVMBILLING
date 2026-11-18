import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Hospital, Loader2 } from "lucide-react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (localStorage.getItem("session_token")) nav("/", { replace: true });
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { password });
      if (data.authenticated && data.token) {
        localStorage.setItem("session_token", data.token);
        toast.success("Welcome back!");
        nav("/", { replace: true });
      } else {
        toast.error(data.message || "Login failed");
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Wrong password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--surface))] grain-bg">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-[hsl(var(--brand))] text-white flex items-center justify-center">
              <Hospital className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-slate-900">GRVM Medical Centre</h1>
              <p className="text-sm text-slate-500">Reception sign-in</p>
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-1 block">Password</label>
              <input
                data-testid="login-password-input"
                type="password" autoFocus
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-[hsl(var(--brand))] focus:ring-2 focus:ring-[hsl(var(--brand-light))] outline-none transition"
                placeholder="Enter staff password"
              />
            </div>
            <button
              data-testid="login-submit-btn"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold hover:bg-[hsl(var(--brand-hover))] transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Sign in to Dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
