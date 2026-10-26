import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import axios from '../api/axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';

const EventsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [paymentData, setPaymentData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const [adminEvent, setAdminEvent] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [sports, setSports] = useState([]);

  // Create Event state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', description: '', sportId: '', startDate: '', endDate: '', type: 'CAMP', fee: 0, maxParticipants: 50, venue: ''
  });

  const fetchEvents = async () => {
    try {
      const res = await axios.get('/events');
      if (res.data.success) {
        setEvents(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const fetchSports = async () => {
    try {
      const res = await axios.get('/sports');
      setSports(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useLiveRefresh('events', fetchEvents);
  useEffect(() => {
    fetchEvents();
    if (isAdmin) fetchSports();
  }, [isAdmin]);

  const handleRegister = async (eventId, fee) => {
    try {
      const res = await axios.post(`/events/${eventId}/register`);
      if (res.data.success) {
        if (fee > 0 && res.data.data.paymentId) {
          setPaymentData({
            paymentId: res.data.data.paymentId,
            amount: fee
          });
          setShowPayment(true);
        } else {
          toast.success('Successfully registered for event!');
          fetchEvents();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    fetchEvents();
  };

  const handleViewAttendees = async (id) => {
    try {
      const res = await axios.get(`/events/${id}`);
      if (res.data.success) {
        setAdminEvent(res.data.data);
        setShowAdminModal(true);
      }
    } catch (err) {
      toast.error('Failed to load event details');
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/events', { ...formData, startDate: new Date(`${formData.startDate}:00+05:00`).toISOString(), endDate: formData.endDate ? new Date(`${formData.endDate}:00+05:00`).toISOString() : null });
      toast.success('Event created successfully');
      setShowCreateModal(false);
      fetchEvents();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create event');
    }
  };

  const cancelRegistration = async (eventId, regId) => { try { const r = await axios.post(`/events/${eventId}/registrations/${regId}/cancel`); toast.success(r.data.message); fetchEvents(); if (showAdminModal) handleViewAttendees(eventId); } catch (e) { toast.error(e.response?.data?.message || 'Could not cancel registration'); } };
  const attend = async regId => { try { await axios.post(`/events/${adminEvent.id}/registrations/${regId}/attend`); toast.success('Attendance recorded'); handleViewAttendees(adminEvent.id); } catch (e) { toast.error(e.response?.data?.message || 'Could not record attendance'); } };
  const cancelEvent = async () => { try { await axios.put(`/events/${adminEvent.id}`, { status: 'CANCELLED' }); toast.success('Event cancelled; refunds queued'); setShowAdminModal(false); fetchEvents(); } catch (e) { toast.error(e.response?.data?.message || 'Could not cancel event'); } };
  if (loading) return <div className="p-6 text-white text-center">Loading events...</div>;

  return (
    <div className="p-6 text-white h-full overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
          Events & Training Camps
        </h1>
        {isAdmin && (
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            + Create Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map(event => (
          <div key={event.id} className="card flex-col">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">{event.name}</h3>
                <span className="inline-block px-2 py-1 bg-white/10 rounded text-xs text-blue-300 border border-white/5">
                  {event.type}
                </span>
              </div>
              <div className="text-2xl">{event.sport?.icon}</div>
            </div>
            
            <p className="text-gray-400 text-sm mb-4 line-clamp-2">{event.description}</p>
            
            <div className="space-y-2 text-sm text-gray-300 mb-6">
              <div className="flex justify-between">
                <span>Start:</span>
                <span className="text-white">{new Date(event.startDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Venue:</span>
                <span className="text-white">{event.venue}</span>
              </div>
              <div className="flex justify-between">
                <span>Fee:</span>
                <span className="text-emerald-400 font-bold">{event.fee > 0 ? `Rs. ${event.fee}` : 'Free'}</span>
              </div>
              <div className="flex justify-between">
                <span>Participants:</span>
                <span className="text-white">{event._count?.registrations || 0} {event.maxParticipants ? `/ ${event.maxParticipants}` : ''}</span>
              </div>
            </div>

            <div className="mt-auto pt-4">
              {!isAdmin && !!event.registrations?.length && <div><p>Registered · {event.registrations[0].payment?.status || 'FREE'}</p><button className="btn btn-secondary" onClick={() => cancelRegistration(event.id, event.registrations[0].id)}>Cancel registration</button><p>Cancel at least 2 hours before start for a full refund.</p></div>}
              {!isAdmin && !event.registrations?.length && (
                <button 
                  onClick={() => handleRegister(event.id, event.fee)}
                  className="btn btn-primary btn-full"
                  disabled={event.status !== 'UPCOMING' || (event.maxParticipants && event._count?.registrations >= event.maxParticipants)}
                >
                  {event.status !== 'UPCOMING' ? 'Closed' : 'Register Now'}
                </button>
              )}
              {isAdmin && (
                <button 
                  onClick={() => handleViewAttendees(event.id)}
                  className="btn btn-secondary btn-full"
                >
                  View Attendees
                </button>
              )}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 bg-white/5 rounded-xl border border-white/10">
            No events available at the moment.
          </div>
        )}
      </div>

      {showPayment && paymentData && (
        <PaymentModal 
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          amount={paymentData.amount}
          paymentId={paymentData.paymentId}
          paymentIntentId={paymentData.paymentIntentId}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {showAdminModal && adminEvent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-2xl shadow-2xl relative">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">Attendees: {adminEvent.name}</h2>
              <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            
            {adminEvent.status !== 'CANCELLED' && <button className="btn btn-danger" onClick={() => { if (window.confirm('Cancel this event and queue full refunds for all paid attendees?')) cancelEvent(); }}>Cancel event and refund entries</button>}
            <div className="overflow-auto max-h-96">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Registration Date</th>
                    <th className="px-4 py-3">Payment</th><th>Attendance / actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {adminEvent.registrations.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-white">{r.user?.name}<p>{r.status}</p></td>
                      <td className="px-4 py-3">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {r.payment ? (
                          <span className={`px-2 py-1 rounded text-xs font-bold ${r.payment.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {r.payment.status}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded text-xs font-bold bg-gray-500/20 text-gray-400">FREE</span>
                        )}
                      </td>
                      <td>{r.attendedAt ? `Attended ${new Date(r.attendedAt).toLocaleString()}` : r.status === 'ACTIVE' && <div><button className="btn btn-secondary btn-sm" onClick={() => attend(r.id)}>Check in</button><button className="btn btn-secondary btn-sm" onClick={() => cancelRegistration(adminEvent.id, r.id)}>Cancel entry</button></div>}</td>
                    </tr>
                  ))}
                  {adminEvent.registrations.length === 0 && (
                    <tr><td colSpan="3" className="text-center py-8 text-gray-500">No attendees yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">Create Event / Training Camp</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Event Name</label>
                <input type="text" required className="form-input w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Sport</label>
                  <select required className="form-select w-full" value={formData.sportId} onChange={e => setFormData({...formData, sportId: e.target.value})}>
                    <option value="" className="text-black">Select Sport</option>
                    {sports.map(s => <option key={s.id} value={s.id} className="text-black">{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-select w-full" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                    <option value="CAMP">Training Camp</option>
                    <option value="TRAINING">Training</option>
                    <option value="COACHING">Coaching</option>
                    <option value="LEAGUE">League</option>
                    <option value="FRIENDLY">Friendly</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="datetime-local" required className="form-input w-full" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input type="datetime-local" className="form-input w-full" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Registration Fee (Rs.)</label>
                  <input type="number" required min="0" step="0.01" className="form-input w-full" value={formData.fee} onChange={e => setFormData({...formData, fee: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Participants</label>
                  <input type="number" required min="1" className="form-input w-full" value={formData.maxParticipants} onChange={e => setFormData({...formData, maxParticipants: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Venue</label>
                <input type="text" required className="form-input w-full" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input w-full" rows="3" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsPage;
