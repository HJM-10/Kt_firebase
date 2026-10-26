import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Clock, MapPin, CalendarCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/ConfirmModal';
import SportIcon from '../components/SportIcon';
import PaymentModal from '../components/PaymentModal';

const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState(null);
  
  const [paymentData, setPaymentData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);
  
  // Review state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState({ venueId: null, bookingId: null, rating: 5, comment: '' });

  const navigate = useNavigate();

  const openReviewModal = (booking) => {
    setReviewData({
      venueId: booking.slot.venue.id,
      bookingId: booking.id,
      rating: 5,
      comment: ''
    });
    setReviewModalOpen(true);
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/venues/${reviewData.venueId}/reviews`, {
        rating: reviewData.rating,
        comment: reviewData.comment,
        bookingId: reviewData.bookingId
      });
      toast.success('Review submitted successfully');
      setReviewModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/bookings/my');
      setBookings(res.data.data);
    } catch (err) {
      toast.error('Failed to load your bookings');
    } finally {
      setLoading(false);
    }
  };

  useLiveRefresh('bookings', fetchBookings);
  useEffect(() => { fetchBookings(); }, []);

  const confirmCancel = (id) => {
    setBookingToCancel(id);
    setConfirmOpen(true);
  };

  const handleCancel = async () => {
    if (!bookingToCancel) return;
    try {
      await api.put(`/bookings/${bookingToCancel}/cancel`);
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setConfirmOpen(false);
      setBookingToCancel(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">My Bookings</h1>
        <div className="page-subtitle">Your reserved slots and history. Unpaid holds expire after 30 minutes. Cancel or reschedule at least 2 hours before start; cancellation queues a full refund. Rescheduling keeps the same venue, duration and original price. All session times are Pakistan time.</div>
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner"></div></div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><CalendarCheck size={48} className="text-muted" /></div>
          <div className="empty-title">No Bookings Yet</div>
          <button className="btn btn-primary" onClick={() => navigate('/reserve')}>Book a venue</button>
        </div>
      ) : (
        <div className="grid-3">
          {bookings.map(b => (
            <div key={b.id} className="card">
              <div className="flex justify-between items-center mb-16">
                <span className={`badge badge-${b.status === 'CONFIRMED' ? 'primary' : b.status === 'SCANNED' ? 'success' : 'danger'}`}>
                  {b.status}
                </span>
                <span className="text-muted">#{b.id}</span>
              </div>
              
              <h3 style={{fontSize: 18, fontWeight: 700, marginBottom: 16}}>
                <SportIcon iconName={b.slot?.venue?.sport?.icon} size={18} className="mr-8" /> 
                {b.slot?.venue?.sport?.name}
              </h3>

              <div className="flex-col gap-8 mb-24">
                <div className="flex items-center gap-8 text-muted"><MapPin size={16} /> {b.slot?.venue?.name}</div>
                <div className="flex items-center gap-8 text-muted"><Calendar size={16} /> {new Date(b.slot?.date).toLocaleDateString()}</div>
                <div className="flex items-center gap-8 text-muted"><Clock size={16} /> {b.slot?.startTime} - {b.slot?.endTime}</div>
              </div>

              <div className="flex justify-between items-center mt-16 pt-16" style={{ borderTop: '1px solid var(--border)' }}>
                <div style={{fontWeight: 700, fontSize: 18}}>Rs. {b.finalPrice}</div>
                
                <div className="flex gap-8">
                  {['CONFIRMED', 'PENDING_PAYMENT'].includes(b.status) && <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/reserve?venueId=${b.slot.venueId}&reschedule=${b.id}`)}>Reschedule</button>}
                  {(() => {
                    const slotDateTime = new Date(`${b.slot.date.split('T')[0]}T${b.slot.startTime}:00`);
                    const now = new Date();
                    const hoursDifference = (slotDateTime - now) / (1000 * 60 * 60);
                    const canCancel = hoursDifference >= 2;

                    return (
                      <>
                        {b.status === 'PENDING_PAYMENT' && b.payment && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => {
                              setPaymentData({
                                paymentId: b.payment.id,
                                amount: b.finalPrice
                              });
                              setShowPayment(true);
                            }}>
                              Pay Now
                            </button>
                            {canCancel && (
                              <button className="btn btn-danger btn-sm" onClick={() => confirmCancel(b.id)}>
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                        {b.status === 'CONFIRMED' && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/my-bookings/${b.id}/qr`)}>
                              Show QR
                            </button>
                            {canCancel && (
                              <button className="btn btn-danger btn-sm" onClick={() => confirmCancel(b.id)}>
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                  {b.status === 'SCANNED' && (
                    <button className="btn btn-secondary btn-sm bg-yellow-600 hover:bg-yellow-700" onClick={() => openReviewModal(b)}>
                      Rate Experience
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmOpen}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        onConfirm={handleCancel}
        onCancel={() => setConfirmOpen(false)}
        confirmText="Cancel Booking"
      />

      {/* Review Modal */}
      {reviewModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <h2 className="text-xl font-bold text-white mb-4">Rate Your Experience</h2>
            <form onSubmit={submitReview} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewData({...reviewData, rating: star})}
                      className={`text-2xl transition-colors ${reviewData.rating >= star ? 'text-yellow-400' : 'text-gray-600'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Comment</label>
                <textarea 
                  value={reviewData.comment}
                  onChange={e => setReviewData({...reviewData, comment: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white h-24 resize-none focus:border-blue-500 outline-none"
                  placeholder="Tell us about your experience..."
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setReviewModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPayment && paymentData && (
        <PaymentModal 
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          amount={paymentData.amount}
          paymentId={paymentData.paymentId}
          paymentIntentId={paymentData.paymentIntentId}
          onSuccess={() => {
            setShowPayment(false);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
};

export default MyBookingsPage;
