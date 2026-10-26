import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
export default function BookingQrPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get(`/bookings/${id}/qr`).then(r => setData(r.data.data)).catch(e => setError(e.response?.data?.message || 'Could not load QR code')); }, [id]);
  return <div className="card text-center"><h1>Booking #{id}</h1>{error ? <p role="alert">{error}</p> : !data ? <p>Loading…</p> : <>
    {data.qrCode && <img src={data.qrCode} alt={`Check-in QR for booking ${id}`} width="260" />}
    <p>{data.entryPass.message}</p>
    {data.qrCode && <p>Arrive during your booked session, before {new Date(data.entryPass.expiresAt).toLocaleTimeString('en-PK', { timeZone: 'Asia/Karachi', hour: 'numeric', minute: '2-digit' })} PKT. The pass expires when the session ends and can be used once.</p>}
  </>}</div>;
}
