import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import useAuthStore from '../store/authStore';
import useLiveRefresh from '../services/useLiveRefresh';
import PaymentModal from '../components/PaymentModal';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const blank = { name: '', description: '', sportId: '', venueId: '', pricePerSlot: 0, quantity: 1, brand: '', model: '', material: '', ballType: '', condition: '', imageUrl: '', isActive: true };
export default function EquipmentPage() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN');
  const [params] = useSearchParams();
  const [venueId, setVenueId] = useState(params.get('venueId') || '');
  const [dates, setDates] = useState({ rentalDate: today(), returnDate: today() });
  const [items, setItems] = useState([]), [rentals, setRentals] = useState([]), [venues, setVenues] = useState([]), [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState(null), [quantity, setQuantity] = useState(1), [payment, setPayment] = useState(null);
  const [editor, setEditor] = useState(null), [returning, setReturning] = useState(null), [damage, setDamage] = useState({ damagedQuantity: 0, damageNotes: '' }), [cancelling, setCancelling] = useState(null);
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    try {
      const [equipment, history] = await Promise.all([api.get('/equipment', { params: { ...dates, ...(venueId ? { venueId } : {}) } }), api.get(isAdmin ? '/equipment/rentals/all' : '/equipment/my-rentals')]);
      if (version !== loadVersion.current) return;
      setItems(equipment.data.data); setRentals(history.data.data); setError('');
    } catch (e) { if (version === loadVersion.current) setError(e.response?.data?.message || 'Could not load equipment. Please retry.'); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }, [dates, venueId, isAdmin]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { Promise.all([api.get('/venues'), api.get('/sports')]).then(([v, s]) => { setVenues(v.data.data); setSports(s.data.data); }).catch(() => setError('Could not load venue filters. Please reload.')); }, []);
  useLiveRefresh('equipment', load); useLiveRefresh('payments', load); useLiveRefresh('venues', load);
  const act = async fn => { if (busy) return; setBusy(true); try { await fn(); await load(); } catch (e) { toast.error(e.response?.data?.message || 'Could not save this change'); } finally { setBusy(false); } };
  const days = Math.max(1, Math.round((new Date(dates.returnDate) - new Date(dates.rentalDate)) / 86400000) + 1);
  const rent = e => { e.preventDefault(); act(async () => {
    const r = await api.post(`/equipment/${selection.id}/rent`, { ...dates, quantity: Number(quantity) });
    setSelection(null); toast.success(r.data.data.totalPrice ? 'Reserved for 30 minutes pending payment' : 'Rental confirmed');
    if (r.data.data.totalPrice) setPayment({ paymentId: r.data.data.paymentId, amount: r.data.data.totalPrice });
  }); };
  const save = e => { e.preventDefault(); act(async () => {
    const data = { ...editor, sportId: Number(editor.sportId), venueId: editor.venueId ? Number(editor.venueId) : null, quantity: Number(editor.quantity), pricePerSlot: Number(editor.pricePerSlot) };
    if (editor.id) await api.put(`/equipment/${editor.id}`, data); else await api.post('/equipment', data);
    setEditor(null); toast.success('Inventory saved');
  }); };
  return <div>
    <div className="page-header"><div><p className="page-subtitle">PLAY WITH THE RIGHT GEAR</p><h1 className="page-title">Equipment & rentals</h1><p className="page-subtitle">Explore venue inventory, compare specifications and reserve your equipment.</p></div>{isAdmin && <button className="btn btn-primary" onClick={() => setEditor({ ...blank })}>Add equipment</button>}</div>
    <div className="card mb-24"><div className="grid-3">
      <label className="form-group">Venue<select className="form-select" value={venueId} onChange={e => setVenueId(e.target.value)}><option value="">All venues & shared stock</option>{venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      <label className="form-group">Collection date<input className="form-input" type="date" min={today()} value={dates.rentalDate} onChange={e => setDates({ rentalDate: e.target.value, returnDate: e.target.value > dates.returnDate ? e.target.value : dates.returnDate })} /></label>
      <label className="form-group">Return date<input className="form-input" type="date" min={dates.rentalDate} value={dates.returnDate} onChange={e => setDates({ ...dates, returnDate: e.target.value })} /></label>
    </div><p className="text-muted">PKR per unit per day · Both dates included · Unpaid holds expire after 30 minutes. Cancel before collection day for a full refund; contact staff for same-day changes.</p></div>
    {error && <div className="card" role="alert">{error} <button className="btn btn-secondary" onClick={load}>Retry</button></div>}
    {loading ? <p role="status">Loading inventory…</p> : <div className="grid-3">{items.map(item => <article className="card" key={item.id}>
      <span className="badge badge-info">{item.sport?.name} · {item.venue?.name || 'Shared inventory'}</span><h2 style={{ margin: '16px 0 8px' }}>{item.name}</h2><p className="text-muted">{item.description || 'Ask staff for further equipment details.'}</p>
      <dl className="gear-specs">{[['Brand', item.brand], ['Model', item.model], ['Material / surface', item.material], ['Ball type', item.ballType], ['Condition', item.condition]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not specified'}</dd></div>)}</dl>
      <p><strong>PKR {item.pricePerSlot.toLocaleString()}</strong> / unit / day</p><p className="text-muted">{item.isActive ? `${item.availableQuantity ?? item.quantity} available for these dates` : 'Currently unavailable'}</p>
      <div className="flex gap-8">{isAdmin ? <button className="btn btn-secondary" onClick={() => setEditor({ ...blank, ...item })}>Edit inventory</button> : <button className="btn btn-primary" disabled={busy || !!error || !item.isActive || (item.availableQuantity ?? item.quantity) < 1} onClick={() => { setQuantity(1); setSelection(item); }}>Reserve equipment</button>}{item.venueId && <Link className="btn btn-secondary" to={`/venues/${item.venueId}`}>Venue details</Link>}</div>
    </article>)}</div>}
    {!loading && !items.length && !error && <div className="empty-state">No equipment listed for this venue. Try another venue or contact staff.</div>}
    <h2 style={{ margin: '32px 0 16px' }}>{isAdmin ? 'Rental desk' : 'My rentals'}</h2>
    <div className="card table-container"><table><thead><tr><th>Equipment</th><th>Dates & units</th><th>Rental / payment</th><th>Total</th><th>Actions</th></tr></thead><tbody>{rentals.map(r => <tr key={r.id}>
      <td><strong>{r.equipment.name}</strong><div className="text-muted">#{r.id} {r.user?.name}</div>{r.damageNotes && <p>Damage: {r.damageNotes} ({r.damagedQuantity} units)</p>}</td>
      <td>{r.rentalDate.slice(0, 10)} → {(r.returnDate || r.rentalDate).slice(0, 10)}<div>{r.quantity} units</div></td><td>{r.status.replaceAll('_', ' ')}<div className="text-muted">{r.payment?.status}{r.payment?.refunds?.some(f => f.status !== 'REFUNDED') && ' · Refund pending'}</div></td><td>PKR {r.totalPrice.toLocaleString()}</td>
      <td><div className="flex gap-8">{r.status === 'PENDING_PAYMENT' && !isAdmin && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => setPayment({ paymentId: r.payment.id, amount: r.totalPrice })}>Pay</button>}{['PENDING_PAYMENT', 'CONFIRMED'].includes(r.status) && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setCancelling(r)}>Cancel</button>}{isAdmin && r.status === 'CONFIRMED' && <button className="btn btn-primary btn-sm" onClick={() => { setReturning(r); setDamage({ damagedQuantity: 0, damageNotes: '' }); }}>Record return</button>}</div></td>
    </tr>)}</tbody></table>{!rentals.length && <p className="empty-state">No rentals yet.</p>}</div>
    {selection && <div className="modal-overlay"><form className="modal modal-form" onSubmit={rent} role="dialog" aria-modal="true" aria-label="Reserve equipment"><h2>{selection.name}</h2><p>{dates.rentalDate} → {dates.returnDate} · {days} days</p><label className="form-group">Units<input className="form-input" type="number" min="1" max={selection.availableQuantity} required value={quantity} onChange={e => setQuantity(e.target.value)} /></label><p className="stat-value">PKR {(selection.pricePerSlot * Number(quantity) * days).toLocaleString()}</p><p>Payment confirms the rental. Staff will record the return and inspect equipment for damage.</p><div className="modal-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setSelection(null)}>Back</button><button className="btn btn-primary" disabled={busy}>Reserve</button></div></form></div>}
    {editor && <div className="modal-overlay"><form className="modal modal-form inventory-editor" onSubmit={save} role="dialog" aria-modal="true" aria-label="Edit inventory"><h2>{editor.id ? 'Edit equipment' : 'Add equipment'}</h2><div className="grid-2">{[['name', 'Equipment name'], ['brand', 'Brand'], ['model', 'Model / size'], ['material', 'Material / surface'], ['ballType', 'Ball type'], ['condition', 'Condition'], ['description', 'Description'], ['imageUrl', 'Image URL']].map(([key, label]) => <label className="form-group" key={key}>{label}<input className="form-input" required={key === 'name'} value={editor[key] || ''} maxLength={191} onChange={e => setEditor({ ...editor, [key]: e.target.value })} /></label>)}
      <label className="form-group">Sport<select className="form-select" required value={editor.sportId} onChange={e => setEditor({ ...editor, sportId: e.target.value, venueId: '' })}><option value="">Choose sport</option>{sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="form-group">Venue<select className="form-select" value={editor.venueId || ''} onChange={e => setEditor({ ...editor, venueId: e.target.value })}><option value="">Shared inventory</option>{venues.filter(v => Number(v.sportId) === Number(editor.sportId)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
      {[['pricePerSlot', 'Daily rate (PKR)'], ['quantity', 'Rentable units']].map(([key, label]) => <label className="form-group" key={key}>{label}<input className="form-input" type="number" min="0" step={key === 'quantity' ? 1 : '0.01'} required value={editor[key]} onChange={e => setEditor({ ...editor, [key]: e.target.value })} /></label>)}</div><label><input type="checkbox" checked={editor.isActive} onChange={e => setEditor({ ...editor, isActive: e.target.checked })} /> Available for rental</label><div className="modal-actions"><button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setEditor(null)}>Close</button><button className="btn btn-primary" disabled={busy}>Save inventory</button></div></form></div>}
    {returning && <div className="modal-overlay"><form className="modal modal-form" role="dialog" aria-modal="true" aria-label="Record return" onSubmit={e => { e.preventDefault(); act(async () => { await api.post(`/equipment/rentals/${returning.id}/return`, damage); setReturning(null); toast.success('Return recorded'); }); }}><h2>Inspect & return · {returning.equipment.name}</h2><label>Damaged units<input type="number" className="form-input" min="0" max={returning.quantity} required value={damage.damagedQuantity} onChange={e => setDamage({ ...damage, damagedQuantity: Number(e.target.value) })} /></label><label>Inspection notes<textarea className="form-input" maxLength={4000} required={damage.damagedQuantity > 0} value={damage.damageNotes} onChange={e => setDamage({ ...damage, damageNotes: e.target.value })} /></label><p>Damaged units are removed from rentable inventory. No automatic damage charge is applied.</p><div className="modal-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setReturning(null)}>Back</button><button className="btn btn-primary" disabled={busy}>Record return</button></div></form></div>}
    <ConfirmModal isOpen={!!cancelling} title="Cancel rental?" message="This releases your equipment. Paid amounts enter the refund queue; staff handles cash refunds." onConfirm={() => act(async () => { await api.post(`/equipment/rentals/${cancelling.id}/cancel`); setCancelling(null); toast.success('Rental cancelled'); })} onCancel={() => { if (!busy) setCancelling(null); }} confirmText="Cancel rental" />
    <PaymentModal isOpen={!!payment} {...payment} onClose={() => { setPayment(null); load(); }} onSuccess={() => { setPayment(null); load(); }} />
  </div>;
}
