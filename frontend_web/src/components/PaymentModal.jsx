import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function PaymentModal({ isOpen, onClose, amount, paymentId }) {
  const [loading, setLoading] = useState(false);
  if (!isOpen) return null;
  const pay = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/payments/checkout', { paymentId });
      const url = new URL(data.data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout address');
      window.location.assign(url.href);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to open Stripe checkout');
      setLoading(false);
    }
  };
  return <div className="modal-overlay"><div className="modal" role="dialog" aria-modal="true" aria-label="Complete payment">
    <h2>Complete payment</h2>
    <p>Amount due: Rs. {amount}</p>
    <p>Enter payment details securely on Stripe. Return to your bookings after checkout and refresh to see confirmation.</p>
    <button className="btn btn-primary" disabled={loading} onClick={pay}>{loading ? 'Opening…' : 'Continue to Stripe'}</button>
    <button className="btn" disabled={loading} onClick={onClose}>Close</button>
  </div></div>;
}
