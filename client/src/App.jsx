import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import { AdminLockProvider } from './context/AdminLockContext';
import AdminLockedRoute from './components/AdminLockedRoute';

// Public Pages
const HomePage = lazy(() => import('./pages/public/HomePage'));
const AboutPage = lazy(() => import('./pages/public/AboutPage'));
const TermsPage = lazy(() => import('./pages/public/TermsPage'));
const Ambassadors = lazy(() => import('./pages/Ambassadors'));

// Auth Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));

// Dashboard Pages
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const Packages = lazy(() => import('./pages/dashboard/Packages'));
const Subscriptions = lazy(() => import('./pages/dashboard/Subscriptions'));
const CreateSubscription = lazy(() => import('./pages/dashboard/CreateSubscription'));
const UploadReceipt = lazy(() => import('./pages/dashboard/UploadReceipt'));
const Wallet = lazy(() => import('./pages/dashboard/Wallet'));
const Transactions = lazy(() => import('./pages/dashboard/Transactions'));
const Support = lazy(() => import('./pages/dashboard/Support'));
const KYC = lazy(() => import('./pages/dashboard/KYC'));
const BankDetails = lazy(() => import('./pages/dashboard/BankDetails'));
const WithdrawPage = lazy(() => import('./pages/dashboard/WithdrawPage'));
const Settings = lazy(() => import('./pages/dashboard/Settings'));
const Referrals = lazy(() => import('./pages/dashboard/Referrals'));
const VerifyMembership = lazy(() => import('./pages/VerifyMembership'));
const VerifyDeposit = lazy(() => import('./pages/VerifyDeposit'));

// Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const KYCQueue = lazy(() => import('./pages/admin/KYCQueue'));
const MembersPage = lazy(() => import('./pages/admin/MembersPage'));
const SupportTicketsPage = lazy(() => import('./pages/admin/SupportTicketsPage'));
const AdminPayouts = lazy(() => import('./pages/admin/AdminPayouts'));
const DefaultersPage = lazy(() => import('./pages/admin/DefaultersPage'));
const ReconciliationPage = lazy(() => import('./pages/admin/ReconciliationPage'));
const BroadcastPage = lazy(() => import('./pages/admin/BroadcastPage'));
const AdminAmbassadors = lazy(() => import('./pages/admin/AdminAmbassadors'));
const AdminCashflow = lazy(() => import('./pages/admin/AdminCashflow'));
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'));
const AdminReferrals = lazy(() => import('./pages/admin/AdminReferrals'));
const AdminSecurity = lazy(() => import('./pages/admin/AdminSecurity'));
const EligibilityQueue = lazy(() => import('./pages/admin/EligibilityQueue'));

const LoadingSpinner = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
    <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #800020', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
  </div>
);

const AppLayout = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const hidePublicNav = isAdminRoute || isDashboardRoute;

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: isAdminRoute ? '#f4f6f9' : (isDashboardRoute ? '#f4f7f6' : '#fff') }}>
      {!hidePublicNav && <Navbar />}
      <main className="main-content" style={{ flexGrow: 1 }}>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/verify-membership" element={<VerifyMembership />} />
            <Route path="/verify-deposit" element={<VerifyDeposit />} />
            <Route path="/ambassadors" element={<Ambassadors />} />

            {/* User Dashboard Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardHome />} />
              <Route path="packages" element={<Packages />} />
              <Route path="packages/subscribe" element={<CreateSubscription />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="receipt" element={<UploadReceipt />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="support" element={<Support />} />
              <Route path="kyc" element={<KYC />} />
              <Route path="bank-details" element={<BankDetails />} />
              <Route path="withdraw" element={<WithdrawPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="referrals" element={<Referrals />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly={true}>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="security" element={<AdminSecurity />} />
              <Route path="kyc-queue" element={<AdminLockedRoute pageName="kyc-queue" title="KYC Requests"><KYCQueue /></AdminLockedRoute>} />
              <Route path="members" element={<AdminLockedRoute pageName="members" title="User Management"><MembersPage /></AdminLockedRoute>} />
              <Route path="tickets" element={<AdminLockedRoute pageName="tickets" title="Support Tickets"><SupportTicketsPage /></AdminLockedRoute>} />
              <Route path="payouts" element={<AdminLockedRoute pageName="payouts" title="Payout Management"><AdminPayouts /></AdminLockedRoute>} />
              <Route path="defaulters" element={<AdminLockedRoute pageName="defaulters" title="Defaulters List"><DefaultersPage /></AdminLockedRoute>} />
              <Route path="reconciliation" element={<AdminLockedRoute pageName="reconciliation" title="Financial Report"><ReconciliationPage /></AdminLockedRoute>} />
              <Route path="broadcast" element={<AdminLockedRoute pageName="broadcast" title="Broadcast Notifications"><BroadcastPage /></AdminLockedRoute>} />
              <Route path="ambassadors" element={<AdminLockedRoute pageName="ambassadors" title="Ambassadors"><AdminAmbassadors /></AdminLockedRoute>} />
              <Route path="cashflow" element={<AdminLockedRoute pageName="cashflow" title="Cash Flow Statement"><AdminCashflow /></AdminLockedRoute>} />
              <Route path="plans" element={<AdminLockedRoute pageName="plans" title="Savings Plans"><AdminPlans /></AdminLockedRoute>} />
              <Route path="eligibility-queue" element={<AdminLockedRoute pageName="eligibility" title="Eligibility Review"><EligibilityQueue /></AdminLockedRoute>} />
              <Route path="referrals" element={<AdminLockedRoute pageName="referrals" title="Referral Audits"><AdminReferrals /></AdminLockedRoute>} />
            </Route>
          </Routes>
        </Suspense>
      </main>
      {!hidePublicNav && <Footer />}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AdminLockProvider>
          <AppLayout />
        </AdminLockProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
