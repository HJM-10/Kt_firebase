import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Edit2, Trash2, Activity } from 'lucide-react';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import { AVAILABLE_ICONS } from '../components/SportIcon';
import { SportPhoto } from '../components/ArenaUI';

const SportsPage = () => {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sportToDelete, setSportToDelete] = useState(null);
  const [formData, setFormData] = useState({ id: null, name: '', description: '', icon: 'Trophy' });

  const fetchSports = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sports');
      setSports(res.data.data);
    } catch (err) {
      toast.error('Failed to load sports');
    } finally {
      setLoading(false);
    }
  };

  useLiveRefresh('sports', fetchSports);
  useEffect(() => { fetchSports(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await api.put(`/sports/${formData.id}`, formData);
        toast.success('Sport updated!');
      } else {
        await api.post('/sports', formData);
        toast.success('Sport created!');
      }
      setModalOpen(false);
      fetchSports();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving sport');
    }
  };

  const confirmDelete = (id) => {
    setSportToDelete(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!sportToDelete) return;
    try {
      await api.delete(`/sports/${sportToDelete}`);
      toast.success('Sport deactivated');
      fetchSports();
    } catch (err) {
      toast.error('Failed to deactivate sport');
    } finally {
      setConfirmOpen(false);
      setSportToDelete(null);
    }
  };

  const openModal = (sport = null) => {
    if (sport) {
      setFormData({ id: sport.id, name: sport.name, description: sport.description || '', icon: sport.icon || 'Trophy' });
    } else {
      setFormData({ id: null, name: '', description: '', icon: 'Trophy' });
    }
    setModalOpen(true);
  };

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Sports</h1>
          <div className="page-subtitle">Manage available sports and venues</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={18} /> Add Sport
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner"></div></div>
      ) : sports.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Activity size={48} className="text-muted" /></div>
          <div className="empty-title">No Sports Available</div>
          <div className="text-muted">There are currently no active sports.</div>
        </div>
      ) : (
        <div className="grid-4">
          {sports.map(sport => (
            <div key={sport.id} className="sport-card">
              <SportPhoto venue={{ name: sport.name, sport: { name: sport.name }, imageUrl: sport.imageUrl }} className="sport-catalogue-photo" />
              <div className="sport-name">{sport.name}</div>
              <div className="sport-meta">{sport._count?.venues || 0} Venues • {sport._count?.tournaments || 0} Tournaments</div>
              
              {isAdmin && (
                <div className="flex gap-8 mt-8">
                  <button className="btn btn-secondary btn-sm" onClick={() => openModal(sport)}><Edit2 size={14}/></button>
                  <button className="btn btn-danger btn-sm" onClick={() => confirmDelete(sport.id)}><Trash2 size={14}/></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{formData.id ? 'Edit Sport' : 'New Sport'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input required className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Tennis" />
              </div>
              <div className="form-group">
                <label className="form-label">Icon</label>
                <select className="form-select" value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})}>
                  {AVAILABLE_ICONS.map(icon => (
                    <option key={icon} value={icon}>{icon}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3}></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{formData.id ? 'Save Changes' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmOpen}
        title="Delete Sport"
        message="Are you sure you want to deactivate this sport? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
        confirmText="Deactivate"
      />
    </div>
  );
};

export default SportsPage;
