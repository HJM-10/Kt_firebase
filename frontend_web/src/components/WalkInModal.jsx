import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import api from '../api/axios';
import FormField from './FormField';
import { ErrorPanel } from './ArenaUI';
import { arenaDay, sessionStart } from '../utils/arena';
import useDialogFocus from '../services/useDialogFocus';
export default function WalkInModal({ initialDate, onClose, onCreated }) {
  const [form, setForm] = useState({ sportId: '', venueId: '', date: initialDate >= arenaDay() ? initialDate : arenaDay(), slotId: '', walkInName: '', walkInPhone: '' });
  const [sports, setSports] = useState([]), [venues, setVenues] = useState([]), [slots, setSlots] = useState([]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const locked = useRef(false);
  const dialogRef = useDialogFocus(true, onClose, busy);
  useEffect(() => { let active = true; api.get('/sports').then(r => { if (active) setSports(r.data.data.filter(s => s.isActive !== false)); }).catch(() => { if (active) setError('Sports could not load. Close and reopen to retry.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!form.sportId) return;
    let active = true;
    api.get('/venues', { params: { sportId: form.sportId } }).then(r => { if (active) setVenues(r.data.data.filter(v => v.isActive)); }).catch(() => { if (active) setError('Venues could not load. Choose the sport again.'); });
    return () => { active = false; };
  }, [form.sportId]);
  useEffect(() => {
    if (!form.venueId || !form.date) return;
    let active = true;
    api.get('/bookings/slots', { params: { venueId: form.venueId, date: form.date } }).then(r => { if (active) setSlots(r.data.data.filter(s => !s.isBooked && s.isAvailable !== false && sessionStart(s) > new Date())); }).catch(() => { if (active) setError('Sessions could not load. Choose the venue or date again.'); });
    return () => { active = false; };
  }, [form.venueId, form.date]);
  const create = async e => {
    e.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { const r = await api.post('/bookings', { slotId: Number(form.slotId), walkInName: form.walkInName.trim(), walkInPhone: form.walkInPhone.trim() }); onCreated(r.data.data); }
    catch (e) { setError(e.response?.data?.message || 'Could not reserve this session. Please retry.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <div className="modal-overlay"><section className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="walk-in-title"><div className="modal-header"><div><p className="eyebrow">Front desk</p><h2 id="walk-in-title">New walk-in reservation</h2></div><button className="icon-button" aria-label="Close walk-in form" disabled={busy} onClick={onClose}><X size={20} /></button></div><p className="mb-24">Reserve a published session. Record any cash payment separately after receiving it.</p>{error && <ErrorPanel message={error} />}<form className="modal-form" onSubmit={create}><div className="grid-2">
    <FormField label="Sport"><select className="form-select" required disabled={loading || busy} value={form.sportId} onChange={e => { setForm({ ...form, sportId: e.target.value, venueId: '', slotId: '' }); setVenues([]); setSlots([]); setError(''); }}><option value="">Choose a sport</option>{sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
    <FormField label="Venue"><select className="form-select" required disabled={!form.sportId || busy} value={form.venueId} onChange={e => { setForm({ ...form, venueId: e.target.value, slotId: '' }); setSlots([]); setError(''); }}><option value="">Choose a venue</option>{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></FormField>
    <FormField label="Date (Pakistan time)"><input className="form-input" type="date" required min={arenaDay()} value={form.date} disabled={busy} onInput={e => { setForm({ ...form, date: e.target.value, slotId: '' }); setSlots([]); setError(''); }} /></FormField>
    <FormField label="Published session"><select className="form-select" required disabled={!form.venueId || busy} value={form.slotId} onChange={e => setForm({ ...form, slotId: e.target.value })}><option value="">{slots.length ? 'Choose a session' : 'No open sessions'}</option>{slots.map(s => <option key={s.id} value={s.id}>{s.startTime}–{s.endTime}</option>)}</select></FormField>
    <FormField label="Customer name"><input className="form-input" autoComplete="name" required maxLength={100} disabled={busy} value={form.walkInName} onChange={e => setForm({ ...form, walkInName: e.target.value })} /></FormField>
    <FormField label="Customer phone"><input className="form-input" type="tel" autoComplete="tel" required maxLength={30} disabled={busy} value={form.walkInPhone} onChange={e => setForm({ ...form, walkInPhone: e.target.value })} /></FormField>
    </div><div className="modal-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy || !form.slotId}>{busy ? 'Reserving…' : 'Create reservation'}</button></div></form></section></div>;
}
