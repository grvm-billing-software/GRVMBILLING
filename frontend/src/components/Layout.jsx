import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  LayoutDashboard, Pill, UserPlus, BedDouble, Receipt, Send,
  Users, CalendarCheck, FileBarChart2, MessageCircle, LogOut, Hospital, Settings as SettingsIcon, Search
} from "lucide-react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, test: "nav-dashboard" },
  { to: "/patients", label: "Patients", icon: Search, test: "nav-patients" },
  { to: "/opd", label: "OPD Visits", icon: UserPlus, test: "nav-opd" },
  { to: "/ipd", label: "IPD Admissions", icon: BedDouble, test: "nav-ipd" },
  { to: "/medicines", label: "Medicines", icon: Pill, test: "nav-medicines" },
  { to: "/billing", label: "Billing / Invoices", icon: Receipt, test: "nav-billing" },
  { to: "/referrals", label: "Referrals", icon: Send, test: "nav-referrals" },
  { to: "/whatsapp", label: "WhatsApp Outbox", icon: MessageCircle, test: "nav-whatsapp" },
  { to: "/staff", label: "Staff", icon: Users, test: "nav-staff" },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, test: "nav-attendance" },
  { to: "/reports", label: "Reports", icon: FileBarChart2, test: "nav-reports" },
  { to: "/settings", label: "Settings", icon: SettingsIcon, test: "nav-settings" },
];

export default function Layout({ children }) {
  const loc = useLocation();
  const nav = useNavigate();
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    localStorage.removeItem("session_token");
    nav("/login");
  };
  return (
    <div className="min-h-screen flex bg-[hsl(var(--surface))]">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="px-6 py-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--brand))] text-white flex items-center justify-center">
              <Hospital className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display font-bold text-slate-900 leading-tight">GRVM Medical Centre</h1>
              <p className="text-xs text-slate-500">Billing & Reception</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = loc.pathname === n.to || (n.to !== "/" && loc.pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} data-testid={n.test}
                className={`sidebar-link ${active ? "active" : ""}`}>
                <Icon className="w-4 h-4" />
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <button data-testid="logout-btn" onClick={logout}
            className="sidebar-link w-full text-slate-600 hover:text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
