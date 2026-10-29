import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Trophy, Swords, Dumbbell, CalendarDays, CalendarCheck, LogOut, ScanLine, Settings, Users, Building2, Star, Wallet, TicketPercent, BarChart3, Bell, MessageSquare, Package2, X } from 'lucide-react';
import useAuthStore from '../store/authStore';
import { BrandMark } from './ArenaUI';
export const adminPages = [
  ['/', 'Overview', LayoutDashboard], ['/reserve', 'Schedule', CalendarDays], ['/bookings', 'Bookings', CalendarCheck], ['/venues', 'Venues', Building2], ['/equipment', 'Venue & gear', Package2], ['/payments', 'Payments', Wallet], ['/promo', 'Offers & discounts', TicketPercent], ['/reports', 'Reports', BarChart3],
];
const adminMore = [['/scan', 'Check entry pass', ScanLine], ['/users', 'Customers & staff', Users], ['/sports', 'Sports', Dumbbell], ['/tournaments', 'Tournaments', Trophy], ['/matches', 'Matches', Swords], ['/fixtures', 'Fixtures', CalendarDays], ['/events', 'Events', CalendarDays], ['/reviews', 'Reviews', Star], ['/complaints', 'Support', MessageSquare], ['/notifications', 'Notifications', Bell], ['/settings', 'Settings', Settings]];
export const customerPages = [['/', 'Overview', LayoutDashboard], ['/sports', 'Explore sports', Dumbbell], ['/reserve', 'Book a venue', CalendarDays], ['/my-bookings', 'My bookings', CalendarCheck], ['/equipment', 'Equipment & rentals', Package2], ['/payments', 'Payments & invoices', Wallet], ['/promo', 'Offers & discounts', TicketPercent], ['/membership', 'Membership', Star], ['/tournaments', 'Tournaments', Trophy], ['/matches', 'Matches', Swords], ['/events', 'Events', CalendarDays], ['/notifications', 'Notifications', Bell], ['/complaints', 'Support', MessageSquare], ['/settings', 'Settings', Settings]];
export const allAdminPages = [...adminPages, ...adminMore];
export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const admin = user?.role === 'ADMIN';
  const items = admin ? adminPages : customerPages;
  const renderLink = ([to, label, Icon]) => <NavLink key={to} to={to} end={to === '/'} onClick={onClose} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>;
  return <>
    {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`sidebar ${open ? 'is-open' : ''}`} id="site-navigation" aria-label="Main navigation">
      <div className="sidebar-logo"><NavLink to="/" className="brand-link" onClick={onClose}><span className="brand-mark"><BrandMark /></span><span><strong className="sidebar-logo-text">KT Smart Sport Hub</strong><span className="sidebar-logo-sub">{admin ? 'Arena Desk · Admin' : 'Your next game starts here'}</span></span></NavLink><button className="icon-button mobile-nav-close" aria-label="Close navigation" onClick={onClose}><X size={20} /></button></div>
      <nav className="sidebar-nav"><p className="sidebar-section-title">{admin ? 'Workspace' : 'Your clubhouse'}</p>{items.map(renderLink)}{admin && <><p className="sidebar-section-title">Club management</p>{adminMore.map(renderLink)}</>}</nav>
      <div className="sidebar-footer"><span className="sidebar-avatar">{user?.name?.charAt(0).toUpperCase() || 'K'}</span><div className="sidebar-identity"><strong className="sidebar-user-name">{user?.name}</strong><span className="sidebar-user-role">{admin ? 'Administrator' : 'Club member'}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => { logout(); navigate('/login'); }}><LogOut size={18} /></button></div>
    </aside>
  </>;
}
