import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect } from 'react';
import axios from '../api/axios';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';
import PaymentModal from '../components/PaymentModal';

const EquipmentPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [paymentData, setPaymentData] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const [rentals, setRentals] = useState([]);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [sports, setSports] = useState([]);

  // Create Equipment state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', description: '', sportId: '', pricePerSlot: 0, quantity: 1, imageUrl: ''
  });

  const fetchEquipment = async () => {
    try {
      const res = await axios.get('/equipment');
      if (res.data.success) {
        setEquipment(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load equipment');
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

  useLiveRefresh('equipment', fetchEquipment);
  useEffect(() => {
    fetchEquipment();
    if (isAdmin) fetchSports();
  }, [isAdmin]);

  const handleRent = async (equipmentId, price) => {
    const rentDate = new Date();
    rentDate.setHours(rentDate.getHours() + 1); // Rent for next hour
    try {
      const res = await axios.post(`/equipment/${equipmentId}/rent`, {
        quantity: 1,
        rentalDate: rentDate.toISOString()
      });
      if (res.data.success) {
        if (price > 0 && res.data.data.paymentId) {
          setPaymentData({
            paymentId: res.data.data.paymentId,
            amount: price
          });
          setShowPayment(true);
        } else {
          toast.success('Rental request created.');
          fetchEquipment();
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rental failed');
    }
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    fetchEquipment();
  };

  const handleViewRentals = async () => {
    try {
      const res = await axios.get('/equipment/rentals/all');
      if (res.data.success) {
        setRentals(res.data.data);
        setShowAdminModal(true);
      }
    } catch (err) {
      toast.error('Failed to load rentals');
    }
  };

  const handleCreateEquipment = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/equipment', formData);
      toast.success('Equipment created successfully');
      setShowCreateModal(false);
      fetchEquipment();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create equipment');
    }
  };

  if (loading) return <div className="p-6 text-white text-center">Loading equipment...</div>;

  return (
    <div className="p-6 text-white h-full overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
          Equipment Rental
        </h1>
        {isAdmin && (
          <div className="flex gap-4">
            <button 
              onClick={handleViewRentals}
              className="btn btn-secondary"
            >
              View Active Rentals
            </button>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary"
            >
              + Add Equipment
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {equipment.map(item => (
          <div key={item.id} className="card flex-col">
            <div className="h-40 bg-white/5 rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-white/10">
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
              ) : (
                <span className="text-4xl">🏅</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mb-1">{item.name}</h3>
            <p className="text-gray-400 text-sm mb-3 line-clamp-2">{item.description}</p>
            
            <div className="mt-auto pt-4 border-t border-white/10">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Price per slot</div>
                  <div className="text-xl font-bold text-emerald-400">Rs. {item.pricePerSlot}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Available</div>
                  <div className="text-sm text-white font-medium">{item.quantity} units</div>
                </div>
              </div>

              {!isAdmin && (
                <button 
                  onClick={() => handleRent(item.id, item.pricePerSlot)}
                  className="btn btn-primary btn-full mt-4"
                  disabled={!item.isActive || item.quantity < 1}
                >
                  {!item.isActive || item.quantity < 1 ? 'Unavailable' : 'Rent Now'}
                </button>
              )}
            </div>
          </div>
        ))}
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

      {showAdminModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-4xl shadow-2xl relative">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">All Equipment Rentals</h2>
              <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            
            <div className="overflow-auto max-h-[60vh]">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10 sticky top-0">
                  <tr>
                    <th className="px-4 py-3">Equipment</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rentals.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-white">{r.equipment?.name}</td>
                      <td className="px-4 py-3">{r.user?.name}</td>
                      <td className="px-4 py-3">{r.quantity}</td>
                      <td className="px-4 py-3">{new Date(r.rentalDate).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${r.status === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rentals.length === 0 && (
                    <tr><td colSpan="5" className="text-center py-8 text-gray-500">No active rentals</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#1a1a2e] border border-white/10 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">Add New Equipment</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">&times;</button>
            </div>
            <form onSubmit={handleCreateEquipment} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Equipment Name</label>
                <input type="text" required className="form-input w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Sport</label>
                <select required className="form-select w-full" value={formData.sportId} onChange={e => setFormData({...formData, sportId: e.target.value})}>
                  <option value="" className="text-black">Select Sport</option>
                  {sports.map(s => <option key={s.id} value={s.id} className="text-black">{s.name}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Price Per Slot ($)</label>
                  <input type="number" required min="0" step="0.01" className="form-input w-full" value={formData.pricePerSlot} onChange={e => setFormData({...formData, pricePerSlot: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input type="number" required min="1" className="form-input w-full" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Image URL</label>
                <input type="url" className="form-input w-full" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input w-full" rows="2" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Equipment</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentPage;
