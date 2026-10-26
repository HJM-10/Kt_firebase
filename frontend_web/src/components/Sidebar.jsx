import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Trophy, Swords, Dumbbell,
  CalendarCheck, QrCode, LogOut, ScanLine, Settings, Building, Users,
  Building2, Star, MapPin
} from 'lucide-react';
import useAuthStore from '../store/authStore';

const Sidebar = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = isAdmin
    ? [
        { to: '/', icon: <LayoutDashboard />, label: 'Dashboard' },
        { to: '/sports', icon: <Dumbbell />, label: 'Sports' },
        { to: '/reserve', icon: <CalendarCheck />, label: 'Book a Venue' },
        { to: '/tournaments', icon: <Trophy />, label: 'Tournaments' },
        { to: '/matches', icon: <Swords />, label: 'Matches' },
        { to: '/fixtures', icon: <Swords />, label: 'Generate Fixtures' },
        { to: '/bookings', icon: <CalendarCheck />, label: 'Bookings' },
        { to: '/venues', icon: <Building2 />, label: 'Venues' },
        { to: '/events', icon: <CalendarCheck />, label: 'Events' },
        { to: '/equipment', icon: <Dumbbell />, label: 'Equipment' },
        { to: '/payments', icon: <LayoutDashboard />, label: 'Payments' },
        { to: '/promo', icon: <ScanLine />, label: 'Promo Codes' },
        { to: '/reviews', icon: <Star />, label: 'Reviews' },
        { to: '/complaints', icon: <Settings />, label: 'Complaints' },
        { to: '/reports', icon: <LayoutDashboard />, label: 'Reports' },
        { to: '/settings', icon: <Settings />, label: 'Settings' },
      ]
    : [
        { to: '/', icon: <LayoutDashboard />, label: 'Dashboard' },
        { to: '/sports', icon: <Dumbbell />, label: 'Sports' },
        { to: '/reserve', icon: <CalendarCheck />, label: 'Book a Venue' },
        { to: '/tournaments', icon: <Trophy />, label: 'Tournaments' },
        { to: '/matches', icon: <Swords />, label: 'Matches' },
        { to: '/events', icon: <CalendarCheck />, label: 'Events' },
        { to: '/equipment', icon: <Dumbbell />, label: 'Equipment' },
        { to: '/my-bookings', icon: <CalendarCheck />, label: 'My Bookings' },
        { to: '/membership', icon: <Star />, label: 'Membership' },
        { to: '/payments', icon: <CalendarCheck />, label: 'Payments and Invoices' },
        { to: '/notifications', icon: <CalendarCheck />, label: 'Notifications' },
        { to: '/complaints', icon: <Settings />, label: 'Complaints' },
        { to: '/settings', icon: <Settings />, label: 'Settings' },
      ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon text-white" style={{ padding: 0, background: 'transparent' }}>
          <img src="/logo.jpg" alt="Smart Sports Hub Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
        </div>
        <div>
          <div className="sidebar-logo-text">Smart Sports Hub</div>
          <div className="sidebar-logo-sub">Management System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-title">Main</div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            {item.icon}
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="sidebar-section-title">Admin</div>
            <NavLink
              to="/scan"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <ScanLine size={18} />
              Scan Booking
            </NavLink>
            <NavLink
              to="/users"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Users size={18} />
              Manage Users
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">{user?.role}</div>
        </div>
        <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
