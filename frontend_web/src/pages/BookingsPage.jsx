import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Clock3, Plus, Search, CheckCheck, RefreshCw, ArrowUpRight } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import useLiveRefresh from '../services/useLiveRefresh';
import { ErrorPanel, PageHeading, SportPhoto, StatCard, StatusBadge } from '../components/ArenaUI';
import ConfirmModal from '../components/ConfirmModal';
import WalkInModal from '../components/WalkInModal';
import { arenaDay, filterBookings, money, validDay } from '../utils/arena';
export default function BookingsPage() {
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(validDay(params.get('date')) ? params.get('date') : '');
  const [bookings, setBookings] = useState([]), [query, setQuery] = useState(''), [status, setStatus] = useState('ALL');
  const [selectedId, setSelectedId] = useState(Number(params.get('booking')) || null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [walkIn, setWalkIn] = useState(params.get('walkIn') === '1'), [confirming, setConfirming] = useState(null), [busy, setBusy] = useState(false), [hasMore, setHasMore] = useState(false);
  const version = useRef(0), page = useRef(1), lock = useRef(false);
  const load = useCallback(async () => {
    const request = ++version.current; setLoading(true);
    try {
      const r = date ? await api.get('/reports/arena-desk', { params: { date } }) : await api.get('/bookings', { params: { page: 1, limit: 100 } });
      if (request !== version.current) return;
      const rows = date ? r.data.data.bookings : r.data.data;
      setBookings(rows); page.current = 1; setHasMore(!date && rows.length === 100); setError('');
    } catch (e) { if (request === version.current) setError(e.response?.data?.message || 'Bookings could not load. Please retry.'); }
    finally { if (request === version.current) setLoading(false); }
  }, [date]);
  useEffect(() => { void load(); }, [load]);
  useLiveRefresh('bookings', load);
  const loadMore = async () => {
    if (loading) return; const request = version.current; setLoading(true);
    try { const r = await api.get('/bookings', { params: { page: page.current + 1, limit: 100 } }); if (request !== version.current) return; const ids = new Set(bookings.map(b => b.id)); setBookings(prev => [...prev, ...r.data.data.filter(b => !ids.has(b.id))]); page.current++; setHasMore(r.data.data.length === 100); }
    catch { setError('More bookings could not load. Please retry.'); } finally { setLoading(false); }
  };
  const changeDate = value => { setBookings([]); setSelectedId(null); setDate(value); };
  const closeWalkIn = () => { setWalkIn(false); if (params.has('walkIn')) { const next = new URLSearchParams(params); next.delete('walkIn'); setParams(next, { replace: true }); } };
  const rows = filterBookings(bookings, { query, status });
  const selected = rows.find(b => b.id === selectedId) || rows[0];
  const confirmCash = async () => {
    if (lock.current || !confirming) return; lock.current = true; setBusy(true);
    try { await api.put(`/bookings/${confirming.id}/confirm`, { receivedInPerson: true }); toast.success('Cash received and booking confirmed'); setConfirming(null); await load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not record payment'); } finally { lock.current = false; setBusy(false); }
  };
  return <div><PageHeading eyebrow="Front desk · Reservations" title="Every booking, in its place." description="Find a reservation, review its payment and help the next player get on court." actions={<><button className="btn btn-secondary" disabled={loading} onClick={load}><RefreshCw size={16} />Refresh</button><button className="btn btn-primary" onClick={() => setWalkIn(true)}><Plus size={17} />New walk-in</button></>} />
    <div className="stats-grid"><StatCard icon={CalendarCheck} value={bookings.length} label={date ? 'Bookings on selected day' : 'Bookings loaded'} /><StatCard icon={Clock3} value={bookings.filter(b => b.status === 'PENDING_PAYMENT').length} label="Awaiting payment in view" tone="brass" /><StatCard icon={CheckCheck} value={bookings.filter(b => ['CONFIRMED', 'SCANNED'].includes(b.status)).length} label="Confirmed or checked in" /></div>
    {error && <ErrorPanel message={error} onRetry={load} />}
    <div className="toolbar"><div className="toolbar-search"><Search size={16} /><input className="form-input" aria-label="Search bookings" placeholder="Customer, booking ID or venue…" value={query} onChange={e => setQuery(e.target.value)} /></div><label className="sr-only" htmlFor="booking-date">Filter bookings by date</label><input id="booking-date" className="form-input" type="date" value={date} onInput={e => changeDate(e.target.value)} /><button className="btn btn-secondary btn-sm" onClick={() => changeDate('')}>All dates</button><button className="btn btn-secondary btn-sm" onClick={() => changeDate(arenaDay())}>Today</button></div>
    <div className="segmented-tabs mb-24" aria-label="Booking status filters">{['ALL', 'PENDING_PAYMENT', 'CONFIRMED', 'SCANNED', 'CANCELLED'].map(s => <button key={s} className={status === s ? 'active' : ''} aria-pressed={status === s} onClick={() => setStatus(s)}>{{ ALL: 'All bookings', PENDING_PAYMENT: 'Awaiting payment', CONFIRMED: 'Confirmed', SCANNED: 'Checked in', CANCELLED: 'Cancelled' }[s]}</button>)}</div>
    <div className="booking-workspace"><section className="table-wrapper booking-table" aria-label="Bookings"><table><thead><tr><th>Reference / time</th><th>Customer</th><th>Venue</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.map(b => <tr className={selected?.id === b.id ? 'selected' : ''} key={b.id} onClick={() => setSelectedId(b.id)}><td><button className="record-button" onClick={() => setSelectedId(b.id)} aria-label={`View booking ${b.id}`}>#{b.id} · {b.slot?.startTime}</button><p className="text-muted">{String(b.slot?.date).slice(0, 10)}</p></td><td><strong>{b.user?.name}</strong><p className="text-muted">{b.user?.email || b.user?.phone || 'Walk-in customer'}</p></td><td>{b.slot?.venue?.name}<p className="text-muted">{b.slot?.venue?.sport?.name}</p></td><td>{money(b.finalPrice)}</td><td><StatusBadge status={b.status} /></td></tr>)}</tbody></table>{loading && !bookings.length ? <p className="empty-state" role="status">Loading reservations…</p> : !rows.length && <div className="empty-state"><h3>No matching bookings</h3><p className="mt-8">Try a different day, search or status filter.</p></div>}<div className="load-more"><span>{rows.length} matching · {bookings.length} loaded{date && ` · ${date}`}</span>{hasMore && <button className="btn btn-secondary btn-sm" disabled={loading} onClick={loadMore}>{loading ? 'Loading…' : 'Load more'}</button>}</div></section>
      <aside className="card booking-detail" aria-label="Booking details">{selected ? <><div className="panel-heading"><h2>Booking #{selected.id}</h2><ArrowUpRight size={17} /></div><StatusBadge status={selected.status} /><SportPhoto venue={selected.slot?.venue} /><h3>{selected.slot?.venue?.name}</h3><dl><div><dt>Customer</dt><dd>{selected.user?.name}<br /><small>{selected.user?.phone || selected.user?.email}</small></dd></div><div><dt>Session · Pakistan time</dt><dd>{String(selected.slot?.date).slice(0, 10)}<br />{selected.slot?.startTime}–{selected.slot?.endTime}</dd></div><div><dt>Booking amount</dt><dd><strong>{money(selected.finalPrice)}</strong></dd></div>{selected.notes && <div><dt>Notes</dt><dd>{selected.notes}</dd></div>}</dl><div className="modal-form">
        {selected.status === 'PENDING_PAYMENT' && <button className="btn btn-primary btn-full" disabled={busy || !!error} onClick={() => setConfirming(selected)}>Record cash received</button>}<Link className="btn btn-secondary btn-full" to={`/payments?bookingId=${selected.id}`}>Review payments</Link>{['CONFIRMED', 'SCANNED'].includes(selected.status) && <Link className="btn btn-secondary btn-full" to={`/my-bookings/${selected.id}/qr`}>View entry pass</Link>}<Link className="btn btn-secondary btn-full" to="/scan">Check entry pass</Link></div><p className="section-note">Cash confirmation requires money received in person. Entry passes remain subject to the server’s check-in window.</p></> : <div className="empty-state">Select a booking to see its details.</div>}</aside>
    </div>
    {walkIn && <WalkInModal initialDate={date || arenaDay()} onClose={closeWalkIn} onCreated={booking => { closeWalkIn(); toast.success(booking.status === 'PENDING_PAYMENT' ? 'Reserved. Payment is required to confirm.' : 'Booking confirmed'); setSelectedId(booking.id); const bookingDate = String(booking.slot?.date || '').slice(0, 10); if (date && validDay(bookingDate) && bookingDate !== date) { setBookings([]); setDate(bookingDate); } else void load(); }} />}
    <ConfirmModal isOpen={!!confirming} title="Record cash received?" message={`Confirm that you have received ${money(confirming?.finalPrice)} in person for booking #${confirming?.id}. This confirms the reservation.`} confirmText={busy ? 'Recording…' : 'Money received'} onConfirm={confirmCash} onCancel={() => { if (!busy) setConfirming(null); }} busy={busy} />
  </div>;
}
