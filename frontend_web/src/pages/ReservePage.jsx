import { useCallback, useEffect, useState } from 'react';
import useLiveRefresh from '../services/useLiveRefresh';
import { validDay } from '../utils/arena';
import { PageHeading } from '../components/ArenaUI';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';
import { socket } from '../services/socket';
import useAuthStore from '../store/authStore';
import FormField from '../components/FormField';

export default function ReservePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN');
  const [venues, setVenues] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const loadRecommendations = useCallback(() => api.get('/recommendations/slots').then(r => setRecommendations(r.data.data)).catch(() => setRecommendations([])), []);
  useEffect(() => { loadRecommendations(); }, [loadRecommendations]);
  useLiveRefresh('recommendations', loadRecommendations);
  const [venueId, setVenueId] = useState(params.get('venueId') || '');
  const [date, setDate] = useState(validDay(params.get('date')) ? params.get('date') : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date()));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [payment, setPayment] = useState(null);
  const [times, setTimes] = useState({ startTime: '09:00', endTime: '10:00' });
  const loadVenues = useCallback(() => api.get('/venues').then(r => setVenues(r.data.data)).catch(() => toast.error('Could not load venues')), []);
  useEffect(() => { loadVenues(); }, [loadVenues]);
  useLiveRefresh('venues', loadVenues);
  useEffect(() => {
    if (!venueId) { setSlots([]); return; }
    let active = true;
    const load = async () => {
      setLoading(true);
      try { const r = await api.get('/bookings/slots', { params: { venueId, date } }); if (active) setSlots(r.data.data); }
      catch { if (active) toast.error('Could not load availability'); }
      finally { if (active) setLoading(false); }
    };
    load(); socket.connect(); socket.on('booking_updated', load); socket.on('connect', load);
    return () => { active = false; socket.off('booking_updated', load); socket.off('connect', load); };
  }, [venueId, date]);
  const reserve = async slotId => {
    setBusy(true);
    try {
      if (params.get('reschedule')) {
        await api.put(`/bookings/${params.get('reschedule')}/reschedule`, { slotId });
        toast.success('Booking rescheduled'); navigate('/my-bookings');
      } else {
        const r = await api.post('/bookings', { slotId, promoCode });
        toast.success(r.data.data.finalPrice > 0 ? 'Reserved. Payment is required to confirm.' : 'Booking confirmed');
        if (r.data.data.finalPrice > 0) setPayment({ paymentId: r.data.data.paymentId, amount: r.data.data.finalPrice });
        else navigate('/my-bookings');
      }
    } catch (e) { toast.error(e.response?.data?.message || 'Could not reserve this slot'); }
    finally { setBusy(false); }
  };
  const publish = async e => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/bookings/slots', { venueId, date, ...times }); const r = await api.get('/bookings/slots', { params: { venueId, date } }); setSlots(r.data.data); toast.success('Slot published'); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not publish slot'); }
    finally { setBusy(false); }
  };
  return <div>
    <PageHeading eyebrow="The arena · Sessions" title={params.get('reschedule') ? 'Reschedule booking' : isAdmin ? 'Schedule & sessions' : 'Book your next game.'} description="Published availability in Pakistan time. Choose a venue and day to see its sessions." />
    {!params.get('reschedule') && recommendations.length > 0 && <section className="mb-24"><h2 className="mb-16">Suggested for your next game</h2><div className="grid-3">{recommendations.map(s => <article className="card" key={s.id}><h3>{s.venue.name}</h3><p>{s.date.slice(0, 10)} · {s.startTime}–{s.endTime}</p><p className="text-muted">{s.recommendationReason}</p><button className="btn btn-secondary" onClick={() => { setVenueId(String(s.venueId)); setDate(s.date.slice(0, 10)); }}>View available sessions</button></article>)}</div></section>}
    <div className="card form-panel modal-form mb-24">
      <FormField label="Venue"><select className="form-input" value={venueId} onChange={e => setVenueId(e.target.value)}><option value="">Choose a venue</option>{venues.map(v => <option key={v.id} value={v.id}>{v.sport.name} · {v.name} · PKR {v.pricePerSlot}</option>)}</select></FormField>
      <FormField label="Date"><input className="form-input" type="date" value={date} min={new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date())} onInput={e => setDate(e.target.value)} /></FormField>
      {!params.get('reschedule') && <FormField label="Promo code" hint="Optional. Enter an arena promo code to apply a discount."><input className="form-input" value={promoCode} onChange={e => setPromoCode(e.target.value)} /></FormField>}
    </div>
    {venueId && <div className="card mb-24"><Link className="btn btn-secondary" to={`/venues/${venueId}`}>Venue details & equipment menu</Link></div>}
    {isAdmin && venueId && <form className="card form-panel modal-form mb-24" onSubmit={publish}><h2 className="form-section-title">Publish availability</h2><FormField label="Start time"><input type="time" className="form-input" required value={times.startTime} onChange={e => setTimes({ ...times, startTime: e.target.value })} /></FormField><FormField label="End time"><input type="time" className="form-input" required value={times.endTime} onChange={e => setTimes({ ...times, endTime: e.target.value })} /></FormField><div className="form-footer"><button className="btn btn-primary" disabled={busy}>Publish slot</button></div></form>}
    {loading ? <p role="status">Loading availability…</p> : venueId && slots.length === 0 ? <div className="empty-state">No slots have been published for this date.</div> : <div className="grid-3">{slots.map(s => {
      const unavailable = s.isBooked || new Date(`${s.date.slice(0, 10)}T${s.startTime}:00+05:00`) <= new Date();
      return <div className="card" key={s.id}><h3>{s.startTime} – {s.endTime}</h3><p className="text-muted mb-16">{s.isBooked ? 'Reserved' : unavailable ? 'Past slot' : 'Available'}</p><button className="btn btn-primary" disabled={busy || unavailable} onClick={() => reserve(s.id)}>{params.get('reschedule') ? 'Move here' : 'Reserve'}</button></div>;
    })}</div>}
    <PaymentModal isOpen={!!payment} {...payment} onClose={() => { setPayment(null); navigate('/my-bookings'); }} />
  </div>;
}
