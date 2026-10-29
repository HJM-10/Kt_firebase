import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Edit2, Trash2, Building2, DollarSign, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { Link } from 'react-router-dom';
import { PageHeading, SportPhoto, StatusBadge } from '../components/ArenaUI';
import { money } from '../utils/arena';

const VenuesPage = () => {
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSport, setFilterSport] = useState('');
  const [query, setQuery] = useState('');

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
      <PageHeading eyebrow="The clubhouse · Venues" title="A place for every game." description="Manage your courts, playing areas and venue equipment from one considered workspace." actions={<button className="btn btn-primary" onClick={() => openModal()}><Plus size={17} />Add venue</button>} />
      <div className="toolbar"><label className="toolbar-search"><span className="sr-only">Search venues</span><input className="form-input" placeholder="Search venue or sport…" value={query} onChange={e => setQuery(e.target.value)} /></label><select className="form-select" aria-label="Filter venues by sport" value={filterSport} onChange={e => setFilterSport(e.target.value)}><option value="">All sports</option>{sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><span className="text-muted">{venues.length} venues in this sport selection</span></div>
      {loading ? <div className="loader-wrap" role="status">Loading venues…</div> : <div className="venue-grid">{venues.filter(v => [v.name, v.sport?.name].some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase()))).map(venue => <article className="card venue-card" key={venue.id}><SportPhoto venue={venue} /><div className="venue-card-body"><div className="flex justify-between items-center"><span className="badge badge-primary">{venue.sport?.name}</span><StatusBadge status={venue.isActive ? 'CONFIRMED' : 'UNAVAILABLE'}>{venue.isActive ? 'Active venue' : 'Inactive'}</StatusBadge></div><h2>{venue.name}</h2><p>{venue.description || 'View sessions, equipment and playing details for this venue.'}</p><div className="venue-card-meta"><span><DollarSign size={13} />{money(venue.pricePerSlot)} / session</span>{venue.capacity && <span><Users size={13} />{venue.capacity} players</span>}<span>{venue.openingTime}–{venue.closingTime} PKT</span></div><div className="venue-card-actions"><Link className="btn btn-primary btn-sm" to={'/reserve?venueId=' + venue.id}>Manage sessions</Link><Link className="btn btn-secondary btn-sm" to={'/equipment?venueId=' + venue.id}>Equipment</Link><button className="icon-button" aria-label={'Edit ' + venue.name} title="Edit venue" onClick={() => openModal(venue)}><Edit2 size={16} /></button><button className="icon-button" aria-label={'Deactivate ' + venue.name} title="Deactivate venue" onClick={() => confirmDelete(venue.id)}><Trash2 size={16} /></button></div><Link className="venue-details-link" to={'/venues/' + venue.id}>View venue details →</Link></div></article>)}</div>}
      {!loading && !venues.some(v => [v.name, v.sport?.name].some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase()))) && <div className="card empty-state"><Building2 size={30} /><h3 className="mt-16">No matching venues</h3><p className="mt-8">Try another sport or search, or add a new venue.</p></div>}

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
