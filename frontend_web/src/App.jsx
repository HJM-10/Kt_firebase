import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SportsPage = lazy(() => import('./pages/SportsPage'));
const TournamentsPage = lazy(() => import('./pages/TournamentsPage'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage'));
const ScanBookingPage = lazy(() => import('./pages/ScanBookingPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const EventsPage = lazy(() => import('./pages/EventsPage'));
const EquipmentPage = lazy(() => import('./pages/EquipmentPage'));
const ComplaintsPage = lazy(() => import('./pages/ComplaintsPage'));
const PromoCodesPage = lazy(() => import('./pages/PromoCodesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentHistoryPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const VenueDetailsPage = lazy(() => import('./pages/VenueDetailsPage'));
const VenuesPage = lazy(() => import('./pages/VenuesPage'));
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'));
const ReservePage = lazy(() => import('./pages/ReservePage'));
const BookingQrPage = lazy(() => import('./pages/BookingQrPage'));
const MembershipPage = lazy(() => import('./pages/MembershipPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const FixturesPage = lazy(() => import('./pages/FixturesPage'));

function App() {
  return (
    <Router><Suspense fallback={<div className="loader-wrap" role="status">Loading page…</div>}>
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' } }} />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="sports" element={<SportsPage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
          <Route path="matches" element={<MatchesPage />} />
          <Route path="my-bookings" element={<MyBookingsPage />} />
          <Route path="reserve" element={<ReservePage />} />
          <Route path="membership" element={<MembershipPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="my-bookings/:id/qr" element={<BookingQrPage />} />
          <Route path="settings" element={<SettingsPage />} />
          
          <Route path="events" element={<EventsPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          
          {/* Admin Routes */}
          <Route path="bookings" element={<ProtectedRoute adminOnly><BookingsPage /></ProtectedRoute>} />
          <Route path="fixtures" element={<ProtectedRoute adminOnly><FixturesPage /></ProtectedRoute>} />
          <Route path="scan" element={<ProtectedRoute adminOnly><ScanBookingPage /></ProtectedRoute>} />
          <Route path="promo" element={<PromoCodesPage />} />
          <Route path="venues/:id" element={<VenueDetailsPage />} />
          <Route path="reports" element={<ProtectedRoute adminOnly><ReportsPage /></ProtectedRoute>} />
          <Route path="venues" element={<ProtectedRoute adminOnly><VenuesPage /></ProtectedRoute>} />
          <Route path="reviews" element={<ProtectedRoute adminOnly><ReviewsPage /></ProtectedRoute>} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="users" element={<ProtectedRoute adminOnly><UsersPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense></Router>
  );
}

export default App;
