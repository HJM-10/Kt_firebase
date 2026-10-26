import useLiveRefresh from '../services/useLiveRefresh';

import { useEffect, useState } from 'react';

import api from '../api/axios';

import toast from 'react-hot-toast';

import PaymentModal from '../components/PaymentModal';

export default function MembershipPage() {

  const [membership, setMembership] = useState(null);

  const [payment, setPayment] = useState(null);

  const [busy, setBusy] = useState(false);

  const load = () => api.get('/membership/my').then(r => setMembership(r.data.data)).catch(() => toast.error('Could not load membership'));

  useEffect(() => { load(); }, []);

  useLiveRefresh('membership', load);
  useLiveRefresh('payments', load);

  const purchase = async tier => {

    setBusy(true);

    try { const r = await api.post('/membership/purchase', { tier }); if (r.data.data.paymentId) setPayment({ paymentId: r.data.data.paymentId, amount: r.data.data.amount }); await load(); }

    catch (e) { toast.error(e.response?.data?.message || 'Could not request membership'); }

    finally { setBusy(false); }

  };

  return <div><div className="page-header"><h1 className="page-title">Membership</h1><p className="page-subtitle">Your arena membership card and booking benefits</p></div>

    {membership && <div className="card mb-24"><h2>{membership.tier}</h2><p>{membership.cardNumber}</p><p>{membership.status}</p><p>{membership.endDate ? `Valid until ${new Date(membership.endDate).toLocaleDateString()}` : 'Basic card has no expiry'}</p><button className="btn btn-secondary" onClick={load}>Refresh status</button></div>}

    <div className="grid-3">{[['BASIC', 0, 0], ['SILVER', 1000, 10], ['GOLD', 2500, 20]].map(([tier, price, discount]) => <div key={tier} className="card"><h2>{tier}</h2><p>PKR {price}{price > 0 && ' / year'}</p><p className="mb-16">{discount}% off venue bookings</p><button className="btn btn-primary" disabled={busy} onClick={() => purchase(tier)}>{membership?.isActive && membership.tier === tier && tier !== 'BASIC' ? 'Renew' : 'Choose'} {tier}</button></div>)}</div>

    <p className="text-muted">Renewals add one year to your current expiry. Upgrades cost the full annual price and begin a new year when paid. Your current benefits stay active until payment.</p>

    {!!membership?.history?.length && <div className="card mt-24"><h2>Membership history</h2>{membership.history.map(h => <p key={h.id}>{h.kind} · {h.tier} · {h.payment?.status || h.status} · {new Date(h.createdAt).toLocaleDateString()}{h.endDate && ` · Until ${new Date(h.endDate).toLocaleDateString()}`}{h.status === 'PENDING' && h.payment?.status === 'PENDING' && <button className="btn btn-secondary" onClick={() => setPayment({paymentId: h.payment.id, amount: h.payment.amount})}>Complete payment</button>}</p>)}</div>}

    <PaymentModal isOpen={!!payment} {...payment} onClose={() => setPayment(null)} /></div>;

}
