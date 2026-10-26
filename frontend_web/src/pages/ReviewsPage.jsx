import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Star, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

const StarRating = ({ rating }) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        size={14}
        fill={i <= rating ? '#f59e0b' : 'none'}
        color={i <= rating ? '#f59e0b' : 'var(--text-muted)'}
      />
    ))}
  </div>
);

const ReviewsPage = () => {
  const [removing, setRemoving] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reviews');
      setReviews(res.data.data);
    } catch {
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reviews</h1>
          <div className="page-subtitle">Customer feedback and venue ratings</div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
        <div className="stat-card">
          <div className="stat-label">Total Reviews</div>
          <div className="stat-value">{reviews.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Average Rating</div>
          <div className="stat-value">{avgRating} / 5</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">5-Star Reviews</div>
          <div className="stat-value">{reviews.filter(r => r.rating === 5).length}</div>
        </div>
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner" /></div>
      ) : reviews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><MessageSquare size={48} className="text-muted" /></div>
          <div className="empty-title">No Reviews Yet</div>
          <div className="text-muted">Customer reviews will appear here after they complete bookings.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Venue</th>
                <th>Rating</th>
                <th>Comment</th>
                <th>Date</th><th>Moderation</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(review => (
                <tr key={review.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{review.user?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{review.user?.email}</div>
                  </td>
                  <td>{review.venue?.name}</td>
                  <td><StarRating rating={review.rating} /></td>
                  <td>
                    <span style={{ color: review.comment ? 'inherit' : 'var(--text-muted)' }}>
                      {review.comment || '(no comment)'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </td>
                  <td><button className="btn btn-danger" onClick={() => setRemoving(review.id)}>Remove review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmModal isOpen={removing !== null} title="Remove review" message="Remove this review from the venue's public feedback?" isDanger onCancel={() => setRemoving(null)} onConfirm={async () => { try { await api.delete(`/reviews/${removing}`); setRemoving(null); fetchReviews(); } catch { toast.error('Could not remove review'); } }} />
    </div>
  );
};

export default ReviewsPage;
