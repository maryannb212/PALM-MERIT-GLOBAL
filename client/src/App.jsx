import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/public/HomePage';
import AboutPage from './pages/public/AboutPage';
import TermsPage from './pages/public/TermsPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import DashboardHome from './pages/dashboard/DashboardHome';
import Packages from './pages/dashboard/Packages';
import Subscriptions from './pages/dashboard/Subscriptions';
import CreateSubscription from './pages/dashboard/CreateSubscription';
import UploadStatement from './pages/dashboard/UploadStatement';
import Wallet from './pages/dashboard/Wallet';
import Transactions from './pages/dashboard/Transactions';
import Support from './pages/dashboard/Support';
import KYC from './pages/dashboard/KYC';
import BankDetails from './pages/dashboard/BankDetails';
import WithdrawPage from './pages/dashboard/WithdrawPage';
import Settings from './pages/dashboard/Settings';
import AdminDashboard from './pages/admin/AdminDashboard';
import KYCQueue from './pages/admin/KYCQueue';
import MembersPage from './pages/admin/MembersPage';
import SupportTicketsPage from './pages/admin/SupportTicketsPage';
import AdminPayouts from './pages/admin/AdminPayouts';
import DefaultersPage from './pages/admin/DefaultersPage';
import ReconciliationPage from './pages/admin/ReconciliationPage';
import BroadcastPage from './pages/admin/BroadcastPage';
import VerifyMembership from './pages/VerifyMembership';
import VerifyDeposit from './pages/VerifyDeposit';
import Ambassadors from './pages/Ambassadors';
import AdminAmbassadors from './pages/admin/AdminAmbassadors';
import AdminCashflow from './pages/admin/AdminCashflow';


import AdminLogin from './pages/admin/AdminLogin';
import DashboardLayout from './components/DashboardLayout';

const AppLayout = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isDashboardRoute = location.pathname.startsWith('/dashboard');
  const hidePublicNav = isAdminRoute || isDashboardRoute;

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: isAdminRoute ? '#f4f6f9' : (isDashboardRoute ? '#f4f7f6' : '#fff') }}>
      {!hidePublicNav && <Navbar />}
      <main className="main-content" style={{ flexGrow: 1 }}>
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
            <Route path="statement" element={<UploadStatement />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="support" element={<Support />} />
            <Route path="kyc" element={<KYC />} />
            <Route path="bank-details" element={<BankDetails />} />
            <Route path="withdraw" element={<WithdrawPage />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={
            <ProtectedRoute adminOnly={true}>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="kyc-queue" element={<KYCQueue />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="tickets" element={<SupportTicketsPage />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="defaulters" element={<DefaultersPage />} />
            <Route path="reconciliation" element={<ReconciliationPage />} />
            <Route path="broadcast" element={<BroadcastPage />} />
            <Route path="ambassadors" element={<AdminAmbassadors />} />
            <Route path="cashflow" element={<AdminCashflow />} />
          </Route>
        </Routes>
      </main>
      {!hidePublicNav && <Footer />}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
