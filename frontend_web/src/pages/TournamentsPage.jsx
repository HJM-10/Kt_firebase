import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Calendar, Users, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import SportIcon from '../components/SportIcon';
import PaymentModal from '../components/PaymentModal';
import ConfirmModal from '../components/ConfirmModal';
import useAuthStore from '../store/authStore';

const TournamentsPage = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  
  const [paymentData, setPaymentData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const [adminTournament, setAdminTournament] = useState(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAddRegForm, setShowAddRegForm] = useState(false);
  const [newRegData, setNewRegData] = useState({ teamName: '', userId: '', paymentStatus: 'PENDING', receivedInPerson: false, waiverReason: '' });
  const [users, setUsers] = useState([]);

  const [sports, setSports] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', sportId: '', format: 'KNOCKOUT', startDate: '', endDate: '', maxTeams: 8, entryFee: 0, description: ''
  });
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, id: null });
  const today = new Date().toISOString().split('T')[0];

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/tournaments');
      setTournaments(res.data.data);
    } catch (err) {
      toast.error('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const fetchSports = async () => {
    try {
      const res = await api.get('/sports');
      setSports(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useLiveRefresh('tournaments', fetchTournaments);
  useEffect(() => { 
    fetchTournaments(); 
    if (isAdmin) {
      fetchSports();
      fetchUsers();
    }
  }, [isAdmin]);

  const handleRegister = async (tournamentId) => {
    try {
      const res = await api.post(`/tournaments/${tournamentId}/register`, { teamName: `${user.name}'s Team` });
      const { paymentId } = res.data.data;
      
      if (paymentId) {
        setPaymentData({ 
          paymentId, 
          amount: tournaments.find(t => t.id === tournamentId).entryFee
        });
        setShowPayment(true);
      } else {
        toast.success('Successfully registered for tournament!');
        fetchTournaments();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to register');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    fetchTournaments();
  };

  const handleViewRegistrations = async (id) => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      if (res.data.success) {
        setAdminTournament(res.data.data);
        setShowAddRegForm(false);
        setNewRegData({ teamName: '', userId: '', paymentStatus: 'PENDING', receivedInPerson: false, waiverReason: '' });
        setShowAdminModal(true);
      }
    } catch (err) {
      toast.error('Failed to load tournament details');
    }
  };

  const handleManualRegister = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/tournaments/${adminTournament.id}/manual-register`, newRegData);
      toast.success('Registration added successfully');
      setShowAddRegForm(false);
      handleViewRegistrations(adminTournament.id); // refresh
      fetchTournaments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add registration');
    }
  };

  const handleCreateTournament = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/tournaments/${editingId}`, formData);
        toast.success('Tournament updated successfully');
      } else {
        await api.post('/tournaments', formData);
        toast.success('Tournament created successfully');
      }
      setShowCreateModal(false);
      setEditingId(null);
      fetchTournaments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save tournament');
    }
  };

  const handleEdit = (t) => {
    setFormData({
      name: t.name,
      sportId: t.sportId,
      format: t.format,
      startDate: t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '',
      endDate: t.endDate ? new Date(t.endDate).toISOString().split('T')[0] : '',
      maxTeams: t.maxTeams,
      entryFee: t.entryFee,
      description: t.description || ''
    });
    setEditingId(t.id);
    setShowCreateModal(true);
  };

  const handleOpenCreate = () => {
    setFormData({
      name: '', sportId: '', format: 'KNOCKOUT', startDate: '', endDate: '', maxTeams: 8, entryFee: 0, description: ''
    });
    setEditingId(null);
    setShowCreateModal(true);
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/tournaments/${deleteConfirm.id}`);
      toast.success('Tournament deleted successfully');
      setDeleteConfirm({ isOpen: false, id: null });
      fetchTournaments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete tournament');
      setDeleteConfirm({ isOpen: false, id: null });
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Tournaments</h1>
          <div className="page-subtitle">Join or manage upcoming events and tournaments</div>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            + Create Tournament
          </button>
        )}
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner"></div></div>
      ) : tournaments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"><Trophy size={48} className="text-muted" /></div>
          <div className="empty-title">No Tournaments</div>
          <div className="text-muted">There are no tournaments at the moment.</div>
        </div>
      ) : (
        <div className="grid-3">
          {tournaments.map(t => (
            <div key={t.id} className="tournament-card">
              <div className="tournament-card-body">
                <div className="tournament-sport-badge">
                  <SportIcon iconName={t.sport?.icon} size={14} /> {t.sport?.name}
                </div>
                <h3 className="tournament-name">{t.name}</h3>{t.champion && <p>Champion: {t.champion}</p>}
                
                <div className="tournament-meta mb-16">
                  <div className="tournament-meta-item"><Calendar size={14} /> {new Date(t.startDate).toLocaleDateString()}</div>
                  <div className="tournament-meta-item"><Users size={14} /> {t._count?.registrations} / {t.maxTeams} Teams</div>
                  <div className="tournament-meta-item"><Trophy size={14} /> {t.format}</div>
                </div>

                <div className="flex justify-between items-center mt-8 pt-16" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className={`badge badge-${t.status === 'UPCOMING' ? 'primary' : t.status === 'ONGOING' ? 'warning' : 'success'}`}>
                    {t.status}
                  </span>
                  
                  {!isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => handleViewRegistrations(t.id)}>Results & standings</button>}
                  {!isAdmin && t.status === 'UPCOMING' && !t.registrations?.length && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleRegister(t.id)}>
                      Register Now
                    </button>
                  )}
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleEdit(t)}>
                        Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>
                        Delete
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleViewRegistrations(t.id)}>
                        View Registrations
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {showAdminModal && adminTournament && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h2 className="modal-title">Registrations: {adminTournament.name}</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                {isAdmin && !showAddRegForm && adminTournament.status === 'UPCOMING' && (
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddRegForm(true)}>+ Add</button>
                )}
                <button className="modal-close" onClick={() => setShowAdminModal(false)}>×</button>
              </div>
            </div>
            
            {showAddRegForm && (
              <form onSubmit={handleManualRegister} style={{ padding: '16px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', border: '1px solid var(--border-focus)' }}>
                {newRegData.paymentStatus === 'PAID' && <label><input type="checkbox" required checked={newRegData.receivedInPerson} onChange={e => setNewRegData({ ...newRegData, receivedInPerson: e.target.checked })} /> I received this entry fee in person</label>}
                {newRegData.paymentStatus === 'FREE' && <label>Waiver reason<input className="form-input" required value={newRegData.waiverReason} onChange={e => setNewRegData({ ...newRegData, waiverReason: e.target.value })} /></label>}
                <h4 style={{ marginBottom: '12px', color: 'var(--primary-light)' }}>Manual Registration</h4>
                <div className="grid-3" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Team Name</label>
                    <input type="text" required className="form-input" placeholder="Enter team name" value={newRegData.teamName} onChange={e => setNewRegData({...newRegData, teamName: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Captain (User)</label>
                    <select className="form-input" value={newRegData.userId} onChange={e => setNewRegData({...newRegData, userId: e.target.value})}>
                      <option value="">-- Admin (Self) --</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Payment Status</label>
                    <select className="form-input" value={newRegData.paymentStatus} onChange={e => setNewRegData({...newRegData, paymentStatus: e.target.value})}>
                      <option value="PENDING">Pending payment</option><option value="PAID">Cash received</option>
                      <option value="FREE">FREE</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddRegForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Register Team</button>
                </div>
              </form>
            )}

            {adminTournament.champion && <h3>Champion: {adminTournament.champion}</h3>}
            {!!adminTournament.standings?.length && <div className="table-wrapper"><table><thead><tr><th>Team</th><th>Played</th><th>W / D / L</th><th>Difference</th><th>Points</th></tr></thead><tbody>{adminTournament.standings.map(r => <tr key={r.team}><td>{r.team}</td><td>{r.played}</td><td>{r.won} / {r.drawn} / {r.lost}</td><td>{r.difference}</td><td>{r.points}</td></tr>)}</tbody></table></div>}
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Captain</th>
                    <th>Payment Status</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTournament.registrations.map(r => (
                    <tr key={r.id}>
                      <td style={{fontWeight: 600}}>{r.teamName} · {r.status}</td>
                      <td>{r.user?.name}</td>
                      <td>
                        {r.payment ? (
                          <span className={`badge badge-${r.payment.status === 'PAID' ? 'success' : 'warning'}`}>
                            {r.payment.status}
                          </span>
                        ) : (
                          <span className="badge badge-secondary">FREE</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {adminTournament.registrations.length === 0 && (
                    <tr><td colSpan="3" className="text-center py-8">No registrations yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingId ? 'Edit Tournament' : 'Create Tournament'}</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form className="modal-form" onSubmit={handleCreateTournament}>
              <div className="form-group">
                <label className="form-label">Tournament Name</label>
                <input type="text" required className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Sport</label>
                  <select required className="form-input" value={formData.sportId} onChange={e => setFormData({...formData, sportId: e.target.value})}>
                    <option value="">Select Sport</option>
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Format</label>
                  <select className="form-input" value={formData.format} onChange={e => setFormData({...formData, format: e.target.value})}>
                    <option value="KNOCKOUT">Knockout</option>
                    <option value="LEAGUE">League</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" required min={today} className="form-input" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input type="date" min={formData.startDate || today} className="form-input" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Entry Fee (Rs.)</label>
                  <input type="number" required min="0" step="0.01" className="form-input" value={formData.entryFee} onChange={e => setFormData({...formData, entryFee: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Teams</label>
                  <input type="number" required min="2" className="form-input" value={formData.maxTeams} onChange={e => setFormData({...formData, maxTeams: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Tournament"
        message="Are you sure you want to delete this tournament? This action cannot be undone."
        confirmText="Delete"
        isDanger={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
};

export default TournamentsPage;
