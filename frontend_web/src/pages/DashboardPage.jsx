import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck, Clock3, Plus, RefreshCw, ScanLine, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import useAuthStore from '../store/authStore';
import useLiveRefresh from '../services/useLiveRefresh';
import CustomerDashboard from './CustomerDashboard';
import { ErrorPanel, PageHeading, PanelHeading, StatCard, StatusBadge } from '../components/ArenaUI';
import { arenaDay, validDay, money } from '../utils/arena';
import CourtTimeline from '../components/CourtTimeline';
function AdminDashboard() {
  const [date, setDate] = useState(arenaDay());
  const [data, setData] = useState(null), [receipts, setReceipts] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [venueFilter, setVenueFilter] = useState('');
  const version = useRef(0);
  const load = useCallback(async () => {
    if (!validDay(date)) return;
    const request = ++version.current;
    setLoading(true);
    try {
      const [desk, revenue] = await Promise.all([api.get('/reports/arena-desk', { params: { date } }), api.get('/reports/revenue', { params: { from: date, to: date } })]);
      if (request !== version.current) return;
      setData(desk.data.data); setReceipts(revenue.data.data); setError('');
    } catch (e) { if (request === version.current) setError(e.response?.data?.message || 'The desk could not refresh. Please retry.'); }
    finally { if (request === version.current) setLoading(false); }
  }, [date]);
  useEffect(() => { void load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [load]);
  useLiveRefresh('reports', load);
  const ready = data?.date === date;
  const bookings = ready ? data.bookings : [];
  const pending = bookings.filter(b => b.status === 'PENDING_PAYMENT');
  const arrivals = bookings.filter(b => b.status === 'CONFIRMED' && (date !== arenaDay() || new Date(`${date}T${b.slot.endTime}:00+05:00`) > new Date())).slice(0, 5);
  const venues = ready ? data.venues.filter(v => !venueFilter || String(v.id) === venueFilter) : [];
  const shiftDay = direction => { const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + direction); setDate(next.toISOString().slice(0, 10)); };
  return <div className="arena-dashboard">
    <PageHeading eyebrow="Overview · Arena Desk" title="Your arena, at a glance." description="The whole matchday, beautifully in view. Courts, arrivals and everything that needs your attention." actions={<><Link className="btn btn-secondary" to="/scan"><ScanLine size={17} />Check entry pass</Link><Link className="btn btn-primary" to={`/bookings?walkIn=1&date=${date}`}><Plus size={17} />Add walk-in</Link></>} />
    {error && <ErrorPanel message={ready ? `${error} Showing the last successful update.` : error} onRetry={load} />}
    {!ready ? <div className="loader-wrap" role="status">{loading ? 'Loading your arena…' : 'Choose a valid date and retry.'}</div> : <>
      <div className="stats-grid overview-stats"><StatCard icon={CalendarCheck} value={data.summary.bookings} label={date === arenaDay() ? 'Bookings today' : 'Bookings on this day'} /><StatCard icon={Wallet} value={money(receipts?.grossRevenue)} label="Gross receipts" note="Before completed refunds" /><StatCard icon={Clock3} value={data.summary.pendingBookings} label="Awaiting payment" tone="brass" /></div>
      <div className="desk-layout arena-overview"><div className="desk-main"><section className="card"><PanelHeading title="Today's schedule"><Link to={`/reserve?date=${date}`}>Manage sessions<ArrowUpRight size={14} /></Link></PanelHeading><div className="toolbar"><div className="toolbar-actions"><button className="icon-button" aria-label="Previous day" onClick={() => shiftDay(-1)} disabled={!validDay(date)}><ChevronLeft size={18} /></button><label className="sr-only" htmlFor="desk-date">Schedule date</label><input id="desk-date" type="date" className="form-input" value={date} onInput={e => { if (validDay(e.target.value)) setDate(e.target.value); }} /><button className="icon-button" aria-label="Next day" onClick={() => shiftDay(1)} disabled={!validDay(date)}><ChevronRight size={18} /></button><button className="btn btn-secondary btn-sm" onClick={() => setDate(arenaDay())}>Today</button></div><span className="toolbar-spacer" /><select className="form-select" aria-label="Filter schedule by venue" value={venueFilter} onChange={e => setVenueFilter(e.target.value)}><option value="">All venues</option>{data?.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><button className="icon-button" aria-label="Refresh overview" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? 'refreshing' : ''} /></button></div><CourtTimeline maxRows={3} key={date} venues={venues} date={date} /></section>
        <section className="card"><PanelHeading title="Next bookings"><Link to={`/bookings?date=${date}`}>View all<ArrowUpRight size={14} /></Link></PanelHeading><div className="table-wrapper"><table><thead><tr><th>Time</th><th>Customer</th><th>Venue</th><th>Amount</th><th>Status</th></tr></thead><tbody>{bookings.slice(0, 4).map(b => <tr key={b.id}><td>{b.slot.startTime}–{b.slot.endTime}</td><td><Link to={`/bookings?date=${date}&booking=${b.id}`}>{b.user?.name}</Link></td><td>{b.slot.venue.name}</td><td>{money(b.finalPrice)}</td><td><StatusBadge status={b.status} /></td></tr>)}</tbody></table>{!bookings.length && <p className="empty-state">No bookings recorded for this day.</p>}</div></section>
      </div><aside className="desk-aside"><section className="card"><PanelHeading title={date === arenaDay() ? 'Next arrivals' : 'Confirmed bookings'}><Link to={`/bookings?date=${date}`}>View all<ArrowUpRight size={14} /></Link></PanelHeading>{arrivals.length ? arrivals.map(b => <Link className="arrival-row" key={b.id} to={`/bookings?date=${date}&booking=${b.id}`}><span className="avatar player-avatar">{b.user?.name?.split(" ").filter(n => n !== "Demo").map(n => n[0]).slice(0, 2).join("")}</span><div><strong>{b.user?.name}</strong><p>{b.slot.venue.name}</p><p>{b.slot.startTime}–{b.slot.endTime}</p></div><span className="arrival-time">{b.slot.startTime}</span></Link>) : <p className="text-muted">No upcoming arrivals for this day.</p>}</section>
        <section className="card"><PanelHeading title="Attention queue"><Clock3 size={17} /></PanelHeading>{pending.length ? pending.slice(0, 4).map(b => <div className="arrival-row" key={b.id}><div><strong>{b.user?.name}</strong><p>{b.slot.venue.name} · {b.slot.startTime}</p><p>{money(b.finalPrice)}</p><StatusBadge status={b.status} /></div><Link className="btn btn-secondary btn-sm" to={`/bookings?date=${date}&booking=${b.id}`}>Review</Link></div>) : <p className="text-muted">No booking payments waiting for this day.</p>}<Link className="btn btn-secondary btn-full mt-16" to="/payments">Open payment desk</Link></section>
        <section className="card"><PanelHeading title="Venue & gear studio"><Link to="/equipment"><ArrowUpRight size={17} /></Link></PanelHeading><p className="text-muted">Keep equipment ready, review rentals and record returns.</p><Link className="btn btn-secondary btn-full mt-16" to="/equipment">Open studio</Link></section>
      </aside></div><p className="section-note">Updated {new Date(data.generatedAt).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: '2-digit', minute: '2-digit' })} Pakistan time · Gross receipts use payment receipt dates. Completed and pending refunds are shown in Reports.</p>
    </>}
  </div>;
}
export default function DashboardPage() {
  const admin = useAuthStore(s => s.user?.role === 'ADMIN');
  return admin ? <AdminDashboard /> : <CustomerDashboard />;
}
