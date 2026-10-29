import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu, Search, CalendarDays, Bell, ArrowUpRight } from 'lucide-react';
import Sidebar, { allAdminPages, customerPages } from './Sidebar';
import useAuthStore from '../store/authStore';
import { ThemeToggle } from './ArenaUI';
export default function Layout() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [date, setDate] = useState(new Date());
  const location = useLocation();
  const user = useAuthStore(s => s.user);
  const pages = user?.role === 'ADMIN' ? allAdminPages : customerPages;
  const matches = query.trim() ? pages.filter(([to, label]) => `${label} ${to}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  useEffect(() => {
    const timer = setInterval(() => setDate(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!open) return;
    const escape = e => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'Tab') {
        const items = [...document.querySelectorAll('#site-navigation a[href], #site-navigation button:not(:disabled)')].filter(el => el.getClientRects().length);
        const index = items.indexOf(document.activeElement);
        if (e.shiftKey && index <= 0) { e.preventDefault(); items.at(-1)?.focus(); }
        else if (!e.shiftKey && (index < 0 || index === items.length - 1)) { e.preventDefault(); items[0]?.focus(); }
      }
    };
    const prior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => document.querySelector('.mobile-nav-close')?.focus());
    document.addEventListener('keydown', escape);
    return () => { cancelAnimationFrame(frame); document.body.style.overflow = prior; document.removeEventListener('keydown', escape); document.querySelector('.mobile-nav-toggle')?.focus(); };
  }, [open]);
  const closeNavigation = () => { setOpen(false); setQuery(''); };
  return <div className="app-layout">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <Sidebar open={open} onClose={closeNavigation} />
    <div className="main-content" inert={open}>
      <header className="workspace-header">
        <button className="icon-button mobile-nav-toggle" aria-label="Open navigation" aria-controls="site-navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={21} /></button>
        <div className="workspace-search"><Search size={18} aria-hidden="true" /><input aria-label="Find a page" placeholder="Find a page, venue tools or reports…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') setQuery(''); }} />
          {query.trim() && <div className="search-results" aria-label="Page search results">{matches.length ? matches.map(([to, label, Icon]) => <Link key={to} to={to} onClick={closeNavigation}><Icon size={17} /><span>{label}</span><ArrowUpRight size={15} /></Link>) : <p>No pages found. Try “bookings” or “equipment”.</p>}</div>}
        </div>
        <div className="workspace-tools"><span className="header-date"><CalendarDays size={16} /><span>{new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', weekday: 'short', day: 'numeric', month: 'short' }).format(date)}</span></span><ThemeToggle /><Link className="icon-button" to="/notifications" aria-label="Notifications"><Bell size={19} /></Link><Link to="/settings" className="header-user"><span className="sidebar-avatar">{user?.name?.charAt(0) || 'K'}</span><span><strong>{user?.name?.split(' ')[0] || 'Member'}</strong><small>{user?.role === 'ADMIN' ? 'Administrator' : 'Member'}</small></span></Link></div>
      </header>
      <main className="page-content" id="main-content" tabIndex={-1} key={location.pathname}><Outlet /></main>
      <footer className="workspace-footer"><span>KT Smart Sport Hub</span><span>All session times in Pakistan time · PKR</span></footer>
    </div>
  </div>;
}
