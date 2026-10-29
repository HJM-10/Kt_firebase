import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useLiveRefresh from '../services/useLiveRefresh';
const blank = { code: '', discountType: 'PERCENTAGE', discountValue: '', maxUses: '', perCustomerLimit: 1, minOrderAmount: '', expiresAt: '' };
export default function PromoCodesPage() {
  const admin = useAuthStore(s => s.user?.role === 'ADMIN');
  const [promos, setPromos] = useState([]), [form, setForm] = useState(blank), [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { const r = await api.get('/promo'); setPromos(r.data.data); setError(''); } catch { setError('Could not load offers. Please retry.'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]); useLiveRefresh('promo', load); useLiveRefresh('bookings', load);
  const save = async e => {
    e.preventDefault(); setBusy(true);
    try { await api.post('/promo', { ...form, discountValue: Number(form.discountValue), perCustomerLimit: Number(form.perCustomerLimit), maxUses: form.maxUses ? Number(form.maxUses) : null, minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null, expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59+05:00`).toISOString() : null }); setForm(blank); toast.success('Offer created'); await load(); }
    catch (e) { toast.error(e.response?.data?.message || 'Could not create offer'); } finally { setBusy(false); }
  };
  const toggle = async p => { setBusy(true); try { await api.patch(`/promo/${p.id}`, { isActive: !p.isActive }); await load(); } catch { toast.error('Could not update offer'); } finally { setBusy(false); } };
  return <div><div className="page-header"><h1 className="page-title">Promo codes & discounts</h1><p className="page-subtitle">Save on your next court booking. Membership savings apply first; promo savings apply to the remaining price.</p></div>
    {admin && <form className="card modal-form mb-24" onSubmit={save}><h2>Create an offer</h2><div className="grid-3">{[['code', 'Promo code', 'text'], ['discountValue', 'Discount value', 'number'], ['maxUses', 'Total use limit (optional)', 'number'], ['perCustomerLimit', 'Uses per customer', 'number'], ['minOrderAmount', 'Minimum booking value (PKR)', 'number'], ['expiresAt', 'Last valid date (Pakistan time)', 'date']].map(([key, label, type]) => <label className="form-group" key={key}>{label}<input className="form-input" type={type} required={['code', 'discountValue', 'perCustomerLimit'].includes(key)} min={key === 'minOrderAmount' ? 0 : 1} max={key === 'discountValue' && form.discountType === 'PERCENTAGE' ? 100 : undefined} step={['discountValue', 'minOrderAmount'].includes(key) ? '0.01' : undefined} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}<label className="form-group">Discount type<select className="form-select" value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })}><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed PKR</option></select></label></div><button disabled={busy} className="btn btn-primary">Create offer</button></form>}
    <div className="card mb-24"><p>Enter your code when booking a venue. The minimum applies to the original venue price. A cancelled or expired reservation restores your promo allowance. Discounts never exceed the payable booking amount.</p></div>
    {error && <div className="card" role="alert">{error} <button className="btn btn-secondary" onClick={load}>Retry</button></div>}{loading ? <p role="status">Loading offers…</p> : <div className="grid-3">{promos.map(p => {
      const available = p.available ?? (p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date()) && (p.maxUses == null || p.usedCount < p.maxUses));
      return <article className="card" key={p.id}><span className={`badge ${available ? 'badge-success' : 'badge-danger'}`}>{available ? 'Available' : 'Unavailable'}</span><h2 style={{ margin: '16px 0' }}>{p.discountType === 'PERCENTAGE' ? `${p.discountValue}% off` : `PKR ${p.discountValue} off`}</h2><p className="promo-code">{p.code}</p><p>Minimum booking: PKR {p.minOrderAmount || 0}</p><p>{p.perCustomerLimit} uses per customer{p.remainingUses !== undefined && ` · ${p.remainingUses} remaining`}</p><p className="text-muted">{p.expiresAt ? `Expires ${new Date(p.expiresAt).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}` : 'No expiry date'}</p>{admin ? <><p>{p.usedCount} / {p.maxUses ?? 'Unlimited'} total uses</p><button disabled={busy} className="btn btn-secondary" onClick={() => toggle(p)}>{p.isActive ? 'Deactivate' : 'Activate'}</button></> : available && <Link className="btn btn-primary" to={`/reserve?promo=${encodeURIComponent(p.code)}`}>Use this offer</Link>}</article>;
    })}</div>}{!loading && !error && !promos.length && <div className="empty-state">No offers available right now. Check back soon.</div>}
  </div>;
}
