import { useState, useEffect } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { Users, Mail, Phone, Calendar, DollarSign, Activity } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deactivateConfirm, setDeactivateConfirm] = useState({ isOpen: false, id: null });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/users');
      setUsers(res.data.data);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      toast.success('Role updated');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update role');
    }
  };

  const handleDeactivate = (userId) => {
    setDeactivateConfirm({ isOpen: true, id: userId });
  };

  const confirmDeactivate = async () => {
    try {
      await api.delete(`/users/${deactivateConfirm.id}`);
      toast.success('User deactivated successfully');
      setDeactivateConfirm({ isOpen: false, id: null });
      fetchUsers();
    } catch (err) {
      toast.error('Failed to deactivate user');
      setDeactivateConfirm({ isOpen: false, id: null });
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <div className="page-subtitle">View and manage all registered accounts</div>
      </div>

      {loading ? (
        <div className="loader-wrap"><div className="spinner"></div></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>User Details</th>
                <th>Role</th>
                <th>Status</th>
                <th>Contact Info</th>
                <th>Activity Stats</th>
                <th>Total Spent</th>
                <th>Joined Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '50%', 
                        background: 'rgba(99,102,241,0.15)', color: '#6366F1',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      {u.name}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${u.role === 'ADMIN' ? 'primary' : 'secondary'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${u.isActive ? 'success' : 'danger'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px'}}>
                      <Mail size={14} className="text-muted"/> {u.email}
                    </div>
                    {u.phone && (
                      <div style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <Phone size={14} className="text-muted"/> {u.phone}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{fontSize: 13, display: 'flex', gap: '12px'}}>
                      <div title="Total Bookings"><Activity size={14} className="text-muted"/> {u._count.bookings}</div>
                      <div title="Total Payments"><DollarSign size={14} className="text-muted"/> {u._count.payments}</div>
                    </div>
                  </td>
                  <td style={{fontWeight: 700, color: 'var(--success)'}}>
                    ${u.totalSpent?.toFixed(2)}
                  </td>
                  <td>
                    <div style={{fontSize: 13, display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <Calendar size={14} className="text-muted"/>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select 
                        className="form-input" 
                        style={{ padding: '4px 8px', fontSize: 13, width: 'auto' }}
                        value={u.role}
                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                        disabled={!u.isActive}
                      >
                        <option value="CUSTOMER">Customer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      {u.isActive && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeactivate(u.id)}>
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="8" className="text-center py-8">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        isOpen={deactivateConfirm.isOpen}
        title="Deactivate User"
        message="Are you sure you want to deactivate this user? This will cancel their upcoming bookings."
        confirmText="Deactivate"
        isDanger={true}
        onConfirm={confirmDeactivate}
        onCancel={() => setDeactivateConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
};

export default UsersPage;
