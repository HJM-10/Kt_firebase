import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const BookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Walk-in booking modal state
  const [showModal, setShowModal] = useState(false);
  const [sports, setSports] = useState([]);
  const [venues, setVenues] = useState([]);
  const [slots, setSlots] = useState([]);
  const [bookingForm, setBookingForm] = useState({
    sportId: '', venueId: '', date: '', slotId: '', walkInName: '', walkInPhone: ''
  });

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings');
      setBookings(res.data.data);
    } catch (err) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async (id) => {
    try {
      await api.put(`/bookings/${id}/confirm`, { receivedInPerson: true });
      toast.success('Booking confirmed');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm booking');
    }
  };

  const handleOpenModal = async () => {
    try {
      const res = await api.get('/sports');
      setSports(res.data.data);
      setShowModal(true);
    } catch (err) { toast.error('Failed to load sports'); }
  };

  const handleSportChange = async (e) => {
    const sportId = e.target.value;
    setBookingForm({ ...bookingForm, sportId, venueId: '', slotId: '' });
    if (!sportId) { setVenues([]); return; }
    try {
      const res = await api.get(`/venues?sportId=${sportId}`);
      setVenues(res.data.data);
    } catch (err) {}
  };

  const fetchSlots = async (venueId, date) => {
    if (!venueId || !date) return;
    try {
      const res = await api.get(`/bookings/slots?venueId=${venueId}&date=${date}`);
      setSlots(res.data.data.filter(s => !s.isBooked));
    } catch (err) {}
  };

  const handleWalkInBooking = async (e) => {
    e.preventDefault();
    try {
      await api.post('/bookings', {
        slotId: bookingForm.slotId,
        walkInName: bookingForm.walkInName,
        walkInPhone: bookingForm.walkInPhone
      });
      toast.success('Walk-in booking successful');
      setShowModal(false);
      setBookingForm({ sportId: '', venueId: '', date: '', slotId: '', walkInName: '', walkInPhone: '' });
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    }
  };

  useLiveRefresh('bookings', fetchBookings);
  useEffect(() => { fetchBookings(); }, []);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">All Bookings</h1>
          <div className="page-subtitle">View all customer reservations</div>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>+ Book for Walk-in</button>
      </div>

      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{maxWidth: 500}}>
            <h2>Walk-in Booking</h2>
            <form onSubmit={handleWalkInBooking}>
              <div className="form-group">
                <label>Sport</label>
                <select className="form-control" value={bookingForm.sportId} onChange={handleSportChange} required>
                  <option value="">Select Sport</option>
                  {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Venue</label>
                <select className="form-control" value={bookingForm.venueId} onChange={(e) => {
                  setBookingForm({...bookingForm, venueId: e.target.value, slotId: ''});
                  fetchSlots(e.target.value, bookingForm.date);
                }} required>
                  <option value="">Select Venue</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" className="form-control" value={bookingForm.date} onChange={(e) => {
                  setBookingForm({...bookingForm, date: e.target.value, slotId: ''});
                  fetchSlots(bookingForm.venueId, e.target.value);
                }} required min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label>Available Slots</label>
                <select className="form-control" value={bookingForm.slotId} onChange={(e) => setBookingForm({...bookingForm, slotId: e.target.value})} required>
                  <option value="">Select Slot</option>
                  {slots.map(s => <option key={s.id} value={s.id}>{s.startTime} - {s.endTime}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Customer Name</label>
                <input type="text" className="form-control" value={bookingForm.walkInName} onChange={(e) => setBookingForm({...bookingForm, walkInName: e.target.value})} required placeholder="e.g. John Doe"/>
              </div>
              <div className="form-group">
                <label>Customer Phone</label>
                <input type="tel" className="form-control" value={bookingForm.walkInPhone} onChange={(e) => setBookingForm({...bookingForm, walkInPhone: e.target.value})} required placeholder="e.g. 03001234567"/>
              </div>
              <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24}}>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Booking</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loader-wrap"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Sport / Venue</th>
                <th>Date & Time</th>
                <th>Status</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td>#{b.id}</td>
                  <td>
                    <div style={{fontWeight: 600}}>{b.user?.name}</div>
                    <div className="text-muted" style={{fontSize: 12}}>{b.user?.email}</div>
                  </td>
                  <td>
                    <div style={{fontWeight: 600}}>{b.slot?.venue?.sport?.name}</div>
                    <div className="text-muted" style={{fontSize: 12}}>{b.slot?.venue?.name}</div>
                  </td>
                  <td>
                    <div>{new Date(b.slot?.date).toLocaleDateString()}</div>
                    <div className="text-muted" style={{fontSize: 12}}>{b.slot?.startTime} - {b.slot?.endTime}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${b.status === 'CONFIRMED' ? 'primary' : b.status === 'SCANNED' ? 'success' : 'danger'}`}>
                      {b.status}
                    </span>
                  </td>
                  <td style={{fontWeight: 700}}>Rs. {b.finalPrice}</td>
                  <td>
                    {b.status === 'PENDING_PAYMENT' && (
                      <button 
                        className="btn btn-sm" 
                        style={{background: 'var(--success)', border: 'none'}}
                        onClick={() => confirmBooking(b.id)}
                      >
                        Confirm
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan="7" className="text-center py-8">No bookings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
