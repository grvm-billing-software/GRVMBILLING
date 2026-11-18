import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Pill, AlertTriangle, BedDouble, Users, Receipt, Clock, CalendarClock } from "lucide-react";
import { Link } from "react-router-dom";
import { DueToday } from "../components/DueToday";

const STAT = [
  { key: "medicineCount", label: "Medicines", icon: Pill, color: "text-[hsl(var(--brand))]", bg: "bg-[hsl(var(--brand-light))]" },
  { key: "lowStockCount", label: "Low stock", icon: AlertTriangle, color: "text-amber-700", bg: "bg-amber-50" },
  { key: "nearExpiryCount", label: "Near expiry", icon: Clock, color: "text-orange-700", bg: "bg-orange-50" },
  { key: "expiredCount", label: "Expired", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
  { key: "admittedCount", label: "Admitted (IPD)", icon: BedDouble, color: "text-teal-700", bg: "bg-teal-50" },
  { key: "todayOpdCount", label: "Today OPD", icon: Users, color: "text-indigo-700", bg: "bg-indigo-50" },
  { key: "dueTodayCount", label: "Due today", icon: CalendarClock, color: "text-rose-700", bg: "bg-rose-50" },
];

export default function Dashboard() {
  const [data, setData] = useState({ recentBills: [] });
  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)); }, []);
  return (
    <div className="p-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900" data-testid="dashboard-title">Hospital Dashboard</h1>
          <p className="text-slate-500 mt-1">Live view of inventory, patients, and revenue</p>
        </div>
        <Link to="/opd/register" data-testid="quick-register-btn"
          className="px-5 py-2.5 rounded-lg bg-[hsl(var(--brand))] text-white font-semibold hover:bg-[hsl(var(--brand-hover))]">
          + Register OPD Patient
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        {STAT.map(({ key, label, icon: Icon, color, bg }) => (
          <div key={key} className="stat-card" data-testid={`stat-${key}`}>
            <div className={`w-10 h-10 ${bg} ${color} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">{label}</p>
            <p className="font-display text-2xl font-bold text-slate-900 mt-1">{data[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <DueToday />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="stat-card lg:col-span-2">
          <h3 className="font-display text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[hsl(var(--brand))]" /> Recent Invoices
          </h3>
          {(!data.recentBills || data.recentBills.length === 0) ? (
            <p className="text-slate-400 text-sm">No invoices yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentBills.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{b.invoiceNumber}</p>
                    <p className="font-medium text-slate-900">{b.patientName}</p>
                  </div>
                  <p className={`font-display text-lg font-bold ${b.status === "cancelled" ? "line-through text-slate-400" : "text-slate-900"}`}>₹{Number(b.total).toFixed(2)}{b.status === "cancelled" && <span className="ml-2 badge-soft bg-red-50 text-red-700 no-underline">cancelled</span>}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="stat-card">
          <h3 className="font-display text-lg font-semibold text-slate-900 mb-4">This month</h3>
          <p className="text-xs uppercase tracking-wider text-slate-500">Revenue</p>
          <p className="font-display text-4xl font-bold text-[hsl(var(--brand))] mt-2">₹{Number(data.monthlyBilling || 0).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
