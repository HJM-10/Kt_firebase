import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Edit2, Trash2, Building2, DollarSign, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

const VenuesPage = () => {
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSport, setFilterSport] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [venueToDelete, setVenueToDelete] = useState(null);
  const [formData, setFormData] = useState({
    id: null, name: '', description: '', sportId: '', capacity: '', pricePerSlot: '', imageUrl: '', openingTime: '06:00', closingTime: '23:00', closedWeekdays: [], closures: [], isActive: true
  });

  const fetchVenues = async () => {
    try {
      setLoading(true);
      const params = filterSport ? { sportId: filterSport } : {};
      const res = await api.get('/venues', { params });
      setVenues(res.data.data);
    } catch {
      toast.error('Failed to load venues');
    } finally {
      setLoading(false);
    }
  };

  const fetchSports = async () => {
    try {
      const res = await api.get('/sports');
      setSports(res.data.data);
    } catch { /* silent */ }
  };

  useLiveRefresh('venues', fetchVenues);
  useEffect(() => { fetchSports(); }, []);
  useEffect(() => { fetchVenues(); }, [filterSport]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        sportId: parseInt(formData.sportId),
        capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
        pricePerSlot: formData.pricePerSlot ? parseFloat(formData.pricePerSlot) : 0,
        imageUrl: formData.imageUrl || undefined,
        openingTime: formData.openingTime, closingTime: formData.closingTime, closedWeekdays: formData.closedWeekdays, isActive: formData.isActive,
        closures: formData.closures.map(c => ({ reason: c.reason, startAt: new Date(`${c.startAt}:00+05:00`).toISOString(), endAt: new Date(`${c.endAt}:00+05:00`).toISOString() })),
      };
      if (formData.id) {
        await api.put(`/venues/${formData.id}`, payload);
        toast.success('Venue updated!');
      } else {
        await api.post('/venues', payload);
        toast.success('Venue created!');
      }
      setModalOpen(false);
      fetchVenues();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving venue');
    }
  };

  const confirmDelete = (id) => {
    setVenueToDelete(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!venueToDelete) return;
    try {
      await api.delete(`/venues/${venueToDelete}`);
      toast.success('Venue deactivated');
      fetchVenues();
    } catch {
      toast.error('Failed to deactivate venue');
    } finally {
      setConfirmOpen(false);
      setVenueToDelete(null);
    }
  };

  const openModal = (venue = null) => {
    if (venue) {
      setFormData({
        id: venue.id,
        name: venue.name,
        description: venue.description || '',
        sportId: venue.sportId?.toString() || '',
        capacity: venue.capacity?.toString() || '',
        pricePerSlot: venue.pricePerSlot?.toString() || '',
        imageUrl: venue.imageUrl || '',
        openingTime: venue.openingTime, closingTime: venue.closingTime, closedWeekdays: venue.closedWeekdays || [], isActive: venue.isActive,
        closures: (venue.closures || []).map(c => ({ ...c, startAt: new Date(new Date(c.startAt).getTime() + 18000000).toISOString().slice(0,16), endAt: new Date(new Date(c.endAt).getTime() + 18000000).toISOString().slice(0,16) })),
      });
    } else {
      setFormData({ id: null, name: '', description: '', sportId: '', capacity: '', pricePerSlot: '', imageUrl: '', openingTime: '06:00', closingTime: '23:00', closedWeekdays: [], closures: [], isActive: true });
    }
    setModalOpen(true);
  };

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Venues</h1>
          <div className="page-subtitle">Manage courts and playing areas for each sport</div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <Plus size={18} /> Add Venue
        </button>
      </div>

      {/* Filter */}
      <div style={{ marginBottom: '1.5rem' }}>
        <select
          className="form-select"
          style={{ width: 220 }}
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
        >
          <option value="">All Sports</option>
          {sports.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner" /></div>
      ) : venues.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Building2 size={48} className="text-muted" /></div>
          <div className="empty-title">No Venues Found</div>
          <div className="text-muted">Add a venue to get started.</div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sport</th>
                <th><DollarSign size={14} style={{ display: 'inline' }} /> Price / Slot</th>
                <th><Users size={14} style={{ display: 'inline' }} /> Capacity</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {venues.map(venue => (
                <tr key={venue.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{venue.name}</div>
                    {venue.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {venue.description.slice(0, 60)}{venue.description.length > 60 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-primary">{venue.sport?.name}</span>
                  </td>
                  <td>Rs. {venue.pricePerSlot?.toFixed(0)}<p>{venue.openingTime}–{venue.closingTime} PKT</p></td>
                  <td>{venue.capacity ?? '—'}</td>
                  <td>
                    <span className={`badge ${venue.isActive ? 'badge-success' : 'badge-danger'}`}>
                      {venue.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-8">
                      <button className="btn btn-secondary btn-sm" onClick={() => openModal(venue)}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => confirmDelete(venue.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{formData.id ? 'Edit Venue' : 'New Venue'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="grid-2">{['openingTime', 'closingTime'].map(key => <label key={key}>{key === 'openingTime' ? 'Opens (Pakistan time)' : 'Closes (Pakistan time)'}<input type="time" className="form-input" required value={formData[key]} onChange={e => setFormData({ ...formData, [key]: e.target.value })} /></label>)}</div>
              <fieldset><legend>Closed weekdays</legend><div className="flex gap-8">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, i) => <label key={day}><input type="checkbox" checked={formData.closedWeekdays.includes(i)} onChange={e => setFormData({ ...formData, closedWeekdays: e.target.checked ? [...formData.closedWeekdays, i] : formData.closedWeekdays.filter(d => d !== i) })} />{day}</label>)}</div></fieldset>
              <label><input type="checkbox" checked={formData.isActive} onChange={e => setFormData({ ...formData, isActive: e.target.checked })} /> Facility active</label>
              <fieldset><legend>Closures (Pakistan time)</legend>{formData.closures.map((closure, i) => <div key={i} className="card">{['startAt', 'endAt', 'reason'].map(key => <label key={key}>{key === 'startAt' ? 'From' : key === 'endAt' ? 'Until' : 'Reason'}<input className="form-input" required type={key === 'reason' ? 'text' : 'datetime-local'} value={closure[key]} onChange={e => setFormData({ ...formData, closures: formData.closures.map((c, n) => n === i ? { ...c, [key]: e.target.value } : c) })} /></label>)}<button type="button" className="btn btn-secondary" onClick={() => setFormData({ ...formData, closures: formData.closures.filter((_, n) => n !== i) })}>Remove closure</button></div>)}<button type="button" className="btn btn-secondary" onClick={() => setFormData({ ...formData, closures: [...formData.closures, { startAt: '', endAt: '', reason: '' }] })}>Add closure</button></fieldset>

              <div className="form-group">
                <label className="form-label">Venue Name *</label>
                <input
                  required
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Main Cricket Ground A"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Sport *</label>
                <select
                  required
                  className="form-select"
                  value={formData.sportId}
                  onChange={e => setFormData({ ...formData, sportId: e.target.value })}
                >
                  <option value="">Select a sport</option>
                  {sports.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="venue-price">Price per Slot (Rs.)</label>
                  <input
                    id="venue-price"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-input"
                    value={formData.pricePerSlot}
                    onChange={e => setFormData({ ...formData, pricePerSlot: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="venue-capacity">Capacity (players)</label>
                  <input
                    id="venue-capacity"
                    type="number"
                    min="1"
                    step="1"
                    className="form-input"
                    value={formData.capacity}
                    onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                    placeholder="e.g. 22"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Optional details about this venue"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Image URL</label>
                <input
                  className="form-input"
                  value={formData.imageUrl}
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{formData.id ? 'Save Changes' : 'Create Venue'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmOpen}
        title="Deactivate Venue"
        message="Are you sure you want to deactivate this venue? Existing bookings will not be affected."
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        confirmText="Deactivate"
      />
    </div>
  );
};

export default VenuesPage;
