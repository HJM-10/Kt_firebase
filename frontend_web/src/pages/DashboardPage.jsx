import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck, Clock3, Plus, RefreshCw, ScanLine, Wallet, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/axios';
import useAuthStore from '../store/authStore';
import useLiveRefresh from '../services/useLiveRefresh';
import CustomerDashboard from './CustomerDashboard';
import { ErrorPanel, PageHeading, PanelHeading, SportPhoto, StatCard, StatusBadge } from '../components/ArenaUI';
import { arenaDay, validDay, money, minutes, slotState, timelineBounds } from '../utils/arena';
function DailySchedule({ venues, date }) {
  const scrollRef = useRef(null);
  const rows = venues.filter(v => v.slots?.length);
  const { start, end } = timelineBounds(rows);
  const duration = Math.max(60, end - start);
  const hours = Array.from({ length: duration / 60 }, (_, i) => start + i * 60);
  const booked = rows.flatMap(v => v.slots).filter(s => s.bookings?.some(b => ['CONFIRMED', 'PENDING_PAYMENT', 'SCANNED'].includes(b.status)));
  const first = booked.length ? Math.min(...booked.map(s => minutes(s.startTime))) : start;
  const scheduleKey = rows.map(v => v.id).join(',');
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollLeft = Math.max(0, (first - start - 60) / 60 * 94); }, [date, scheduleKey, start, first]);
  if (!rows.length) return <div className="empty-state"><CalendarCheck size={30} /><h3 className="mt-16">No published sessions for this day</h3><p className="mt-8">Choose another date, or publish availability from Schedule.</p><Link className="btn btn-secondary mt-16" to={`/reserve?date=${date}`}>Manage sessions</Link></div>;
  return <><div className="schedule-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="Published court schedule, scroll horizontally for more times"><div className="schedule-chart" style={{ minWidth: Math.max(760, hours.length * 94 + 158) }}><div className="schedule-axis">{hours.map(h => <span key={h}>{String(h / 60).padStart(2, '0')}:00</span>)}</div>{rows.map(venue => <div className="schedule-row" key={venue.id}><Link className="schedule-venue" to={`/venues/${venue.id}`}><SportPhoto venue={venue} className="small" showLabel={false} /><span><strong>{venue.name}</strong><small>{venue.sport?.name}</small></span></Link><div className="schedule-track" style={{ '--hour-width': `${100 / hours.length}%` }}>{venue.slots.map(slot => {
    const state = slotState(slot);
    return <Link key={slot.id} className={`session-block session-${state.status.toLowerCase()}`} style={{ left: `${(minutes(slot.startTime) - start) / duration * 100}%`, width: `calc(${(minutes(slot.endTime) - minutes(slot.startTime)) / duration * 100}% - 4px)` }} to={state.booking ? `/bookings?date=${date}&booking=${state.booking.id}` : `/reserve?venueId=${venue.id}&date=${date}`} title={`${venue.name} · ${slot.startTime}–${slot.endTime} · ${state.label}`}><strong>{state.label}</strong><small>{slot.startTime}–{slot.endTime}</small><StatusBadge status={state.status} /></Link>;
  })}</div></div>)}</div></div><div className="schedule-legend">{['CONFIRMED', 'PENDING_PAYMENT', 'SCANNED', 'OPEN', 'UNAVAILABLE'].map(s => <StatusBadge key={s} status={s} />)}</div><p className="section-note">Only published sessions are shown. Empty timeline space does not indicate bookable availability.</p></>;
}
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
  return <div>
    <PageHeading eyebrow="Overview · Arena Desk" title="Your arena, at a glance." description="A little clarity for a busy day. Keep sessions, arrivals and payments in view." actions={<><Link className="btn btn-secondary" to="/scan"><ScanLine size={17} />Check entry pass</Link><Link className="btn btn-primary" to={`/bookings?walkIn=1&date=${date}`}><Plus size={17} />Add walk-in</Link></>} />
    {error && <ErrorPanel message={ready ? `${error} Showing the last successful update.` : error} onRetry={load} />}
    <div className="toolbar"><div className="toolbar-actions"><button className="icon-button" aria-label="Previous day" onClick={() => shiftDay(-1)} disabled={!validDay(date)}><ChevronLeft size={18} /></button><label className="sr-only" htmlFor="desk-date">Schedule date</label><input id="desk-date" type="date" className="form-input" value={date} onInput={e => { if (validDay(e.target.value)) setDate(e.target.value); }} /><button className="icon-button" aria-label="Next day" onClick={() => shiftDay(1)} disabled={!validDay(date)}><ChevronRight size={18} /></button><button className="btn btn-secondary btn-sm" onClick={() => setDate(arenaDay())}>Today</button></div><span className="toolbar-spacer" /><select className="form-select" aria-label="Filter schedule by venue" value={venueFilter} onChange={e => setVenueFilter(e.target.value)}><option value="">All venues</option>{data?.venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select><button className="icon-button" aria-label="Refresh overview" onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? 'refreshing' : ''} /></button></div>
    {!ready ? <div className="loader-wrap" role="status">{loading ? 'Loading your arena…' : 'Choose a valid date and retry.'}</div> : <>
      <div className="stats-grid overview-stats"><StatCard icon={CalendarCheck} value={data.summary.bookings} label="Bookings on this day" /><StatCard icon={Wallet} value={money(receipts?.grossRevenue)} label="Gross receipts on this day" note="Before completed refunds" /><StatCard icon={Clock3} value={data.summary.pendingBookings} label="Bookings awaiting payment" tone="brass" /></div>
      <div className="desk-layout"><div className="desk-main"><section className="card"><PanelHeading title="Daily court schedule"><Link to={`/reserve?date=${date}`}>Manage sessions<ArrowUpRight size={14} /></Link></PanelHeading><DailySchedule venues={venues} date={date} /></section>
        <section className="card"><PanelHeading title="Day’s bookings"><Link to={`/bookings?date=${date}`}>View all<ArrowUpRight size={14} /></Link></PanelHeading><div className="table-wrapper"><table><thead><tr><th>Time</th><th>Customer</th><th>Venue</th><th>Amount</th><th>Status</th></tr></thead><tbody>{bookings.slice(0, 6).map(b => <tr key={b.id}><td>{b.slot.startTime}–{b.slot.endTime}</td><td><Link to={`/bookings?date=${date}&booking=${b.id}`}>{b.user?.name}</Link></td><td>{b.slot.venue.name}</td><td>{money(b.finalPrice)}</td><td><StatusBadge status={b.status} /></td></tr>)}</tbody></table>{!bookings.length && <p className="empty-state">No bookings recorded for this day.</p>}</div></section>
      </div><aside className="desk-aside"><section className="card"><PanelHeading title={date === arenaDay() ? 'Next arrivals' : 'Confirmed bookings'}><Link to={`/bookings?date=${date}`}>View all<ArrowUpRight size={14} /></Link></PanelHeading>{arrivals.length ? arrivals.map(b => <Link className="arrival-row" key={b.id} to={`/bookings?date=${date}&booking=${b.id}`}><span className="avatar">{b.user?.name?.charAt(0)}</span><div><strong>{b.user?.name}</strong><p>{b.slot.venue.name}</p><p>{b.slot.startTime}–{b.slot.endTime}</p></div><ArrowUpRight size={15} /></Link>) : <p className="text-muted">No upcoming arrivals for this day.</p>}</section>
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
