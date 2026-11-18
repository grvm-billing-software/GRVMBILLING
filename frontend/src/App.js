import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Medicines from "./pages/Medicines";
import OPD from "./pages/OPD";
import OPDRegister from "./pages/OPDRegister";
import IPD from "./pages/IPD";
import IPDAdmit from "./pages/IPDAdmit";
import PatientProfile from "./pages/PatientProfile";
import Billing from "./pages/Billing";
import Referrals from "./pages/Referrals";
import Staff from "./pages/Staff";
import Attendance from "./pages/Attendance";
import Reports from "./pages/Reports";
import WhatsAppOutbox from "./pages/WhatsAppOutbox";
import Settings from "./pages/Settings";
import Patients from "./pages/Patients";
import Layout from "./components/Layout";
import "./App.css";

function Protected({ children }) {
  const token = localStorage.getItem("session_token");
  if (!token) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <div className="App">
      <Toaster richColors position="bottom-right" />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/medicines" element={<Protected><Medicines /></Protected>} />
          <Route path="/opd" element={<Protected><OPD /></Protected>} />
          <Route path="/opd/register" element={<Protected><OPDRegister /></Protected>} />
          <Route path="/ipd" element={<Protected><IPD /></Protected>} />
          <Route path="/ipd/admit" element={<Protected><IPDAdmit /></Protected>} />
          <Route path="/patients" element={<Protected><Patients /></Protected>} />
          <Route path="/patients/:id" element={<Protected><PatientProfile /></Protected>} />
          <Route path="/billing" element={<Protected><Billing /></Protected>} />
          <Route path="/referrals" element={<Protected><Referrals /></Protected>} />
          <Route path="/staff" element={<Protected><Staff /></Protected>} />
          <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
          <Route path="/reports" element={<Protected><Reports /></Protected>} />
          <Route path="/whatsapp" element={<Protected><WhatsAppOutbox /></Protected>} />
          <Route path="/settings" element={<Protected><Settings /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}
