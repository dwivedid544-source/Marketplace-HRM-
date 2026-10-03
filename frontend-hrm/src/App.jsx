import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import ActivateLicense from './pages/ActivateLicense';
import Layout from './components/Layout';
import PrivacyPolicy from './pages/PrivacyPolicy';
import LandingPage from './pages/landing/index';
import WhatsAppBadge from './components/WhatsAppBadge';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import Employees from './pages/admin/Employees';
import Attendance from './pages/admin/Attendance';
import LiveMonitor from './pages/admin/LiveMonitor';
import Payroll from './pages/admin/Payroll';
import EmailLogs from './pages/admin/EmailLogs';
import Reports from './pages/admin/Reports';
import Invoices from './pages/admin/Invoices';
import Settings from './pages/admin/Settings';
import Guide from './pages/admin/Guide';
import LeaveManagement from './pages/admin/LeaveManagement';
import GeoFencing from './pages/admin/GeoFencing';
import ClaimsManagement from './pages/admin/ClaimsManagement';
import KPIManagement from './pages/admin/KPIManagement';
import KioskSettings from './pages/admin/KioskSettings';
import SupportTickets from './pages/admin/SupportTickets';
import Backup from './pages/admin/Backup';
import AuditLogs from './pages/admin/AuditLogs';
import KioskMode from './pages/employee/KioskMode';
// Employee Pages
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import MyAttendance from './pages/employee/MyAttendance';
import MySalary from './pages/employee/MySalary';
import FaceAttendance from './pages/employee/FaceAttendance';
import MyLeaves from './pages/employee/MyLeaves';
import ApplyLeave from './pages/employee/ApplyLeave';
import MyClaims from './pages/employee/MyClaims';
import SubmitClaim from './pages/employee/SubmitClaim';
import MyKPI from './pages/employee/MyKPI';
import LocationCheck from './pages/employee/LocationCheck';
// Face Admin
import FaceRegistration from './pages/admin/FaceRegistration';

// Shared Pages
import Profile from './pages/shared/Profile';

// SuperAdmin Pages
import SADashboard from './pages/superadmin/Dashboard';
import SACompanies from './pages/superadmin/Companies';
import SARequests from './pages/superadmin/Requests';
import SAEnquiries from './pages/superadmin/Enquiries';
import SABilling from './pages/superadmin/Billing';
import SAPlans from './pages/superadmin/Plans';
import SAPaymentHistory from './pages/superadmin/PaymentHistory';
import SAAnalytics from './pages/superadmin/Analytics';
import SASettings from './pages/superadmin/Settings';
import SASupportTickets from './pages/superadmin/SupportTickets';

import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { UIProvider } from './context/UIContext';
import { SiteInfoProvider } from './context/SiteInfoContext';

import ErrorBoundary from './components/ErrorBoundary';

import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <ErrorBoundary>
      <SiteInfoProvider>
      <AuthProvider>
        <SettingsProvider>
          <UIProvider>
            <Router>
              <Routes>
                <Route path="/activate" element={<ActivateLicense />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Admin Routes */}
                <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><AdminDashboard /></Layout></ProtectedRoute>} />
                <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/employees" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Employees /></Layout></ProtectedRoute>} />
                <Route path="/admin/attendance" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Attendance /></Layout></ProtectedRoute>} />
                <Route path="/admin/live" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><LiveMonitor /></Layout></ProtectedRoute>} />
                <Route path="/admin/payroll" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Payroll /></Layout></ProtectedRoute>} />
                <Route path="/admin/email-logs" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><EmailLogs /></Layout></ProtectedRoute>} />
                <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Reports /></Layout></ProtectedRoute>} />
                <Route path="/admin/invoices" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Invoices /></Layout></ProtectedRoute>} />
                <Route path="/admin/guide" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Guide /></Layout></ProtectedRoute>} />
                <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Settings /></Layout></ProtectedRoute>} />
                <Route path="/admin/profile" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Profile type="admin" /></Layout></ProtectedRoute>} />
                <Route path="/admin/face-registration" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><FaceRegistration /></Layout></ProtectedRoute>} />
                <Route path="/admin/leaves" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><LeaveManagement /></Layout></ProtectedRoute>} />
                <Route path="/admin/geofencing" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><GeoFencing /></Layout></ProtectedRoute>} />
                <Route path="/admin/claims" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><ClaimsManagement /></Layout></ProtectedRoute>} />
                <Route path="/admin/kpi" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><KPIManagement /></Layout></ProtectedRoute>} />
                <Route path="/admin/kiosk-settings" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><KioskSettings /></Layout></ProtectedRoute>} />
                <Route path="/admin/support" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><SupportTickets /></Layout></ProtectedRoute>} />
                <Route path="/admin/backup" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><Backup /></Layout></ProtectedRoute>} />
                <Route path="/admin/audit-logs" element={<ProtectedRoute allowedRoles={['admin']}><Layout type="admin"><AuditLogs /></Layout></ProtectedRoute>} />

                {/* Employee Routes */}
                <Route path="/employee" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><EmployeeDashboard /></Layout></ProtectedRoute>} />
                <Route path="/employee/dashboard" element={<Navigate to="/employee" replace />} />
                <Route path="/employee/attendance" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><MyAttendance /></Layout></ProtectedRoute>} />
                <Route path="/employee/face-attendance" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><FaceAttendance /></Layout></ProtectedRoute>} />
                <Route path="/employee/leaves" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><MyLeaves /></Layout></ProtectedRoute>} />
                <Route path="/employee/leaves/apply" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><ApplyLeave /></Layout></ProtectedRoute>} />
                <Route path="/employee/claims" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><MyClaims /></Layout></ProtectedRoute>} />
                <Route path="/employee/claims/submit" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><SubmitClaim /></Layout></ProtectedRoute>} />
                <Route path="/employee/kpi" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><MyKPI /></Layout></ProtectedRoute>} />
                <Route path="/employee/location-check" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><LocationCheck /></Layout></ProtectedRoute>} />
                <Route path="/employee/salary" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><MySalary /></Layout></ProtectedRoute>} />
                <Route path="/employee/reports" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><Reports /></Layout></ProtectedRoute>} />
                <Route path="/employee/profile" element={<ProtectedRoute allowedRoles={['employee']}><Layout type="employee"><Profile type="employee" /></Layout></ProtectedRoute>} />

                {/* SuperAdmin Routes */}
                <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SADashboard /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/dashboard" element={<Navigate to="/superadmin" replace />} />
                <Route path="/superadmin/companies" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SACompanies /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/requests" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SARequests /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/plans" element={<Navigate to="/superadmin" replace />} />
                <Route path="/superadmin/billing" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SABilling /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/payments" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SAPaymentHistory /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/analytics" element={<Navigate to="/superadmin" replace />} />
                <Route path="/superadmin/settings" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SASettings /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/support" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><SASupportTickets /></Layout></ProtectedRoute>} />
                <Route path="/superadmin/profile" element={<ProtectedRoute allowedRoles={['superadmin']}><Layout type="superadmin"><Profile type="superadmin" /></Layout></ProtectedRoute>} />

                <Route path="/" element={<LandingPage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/kiosk" element={<KioskMode />} />
                <Route path="*" element={<div className="flex flex-col items-center justify-center h-screen bg-slate-50"><h1 className="text-4xl font-black text-slate-800">404</h1><p className="text-slate-500 font-medium mt-2">Page Not Found</p><a href="/login" className="mt-4 px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-colors">Go Home</a></div>} />
              </Routes>
              <WhatsAppBadge />
            </Router>
          </UIProvider>
        </SettingsProvider>
      </AuthProvider>
      </SiteInfoProvider>
    </ErrorBoundary>
  );
}

export default App;
