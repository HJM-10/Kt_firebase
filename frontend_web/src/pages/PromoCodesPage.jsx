import { useState, useEffect } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

const PromoCodesPage = () => {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const fetchPromos = async () => {
    try {
      const res = await axios.get('/promo');
      if (res.data.success) {
        setPromos(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/promo', {
        code: code.toUpperCase(),
        discountType,
        discountValue: parseFloat(discountValue),
        maxUses: maxUses ? parseInt(maxUses) : null,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : null,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
      });
      if (res.data.success) {
        toast.success('Promo code created');
        fetchPromos();
        setCode(''); setDiscountValue(''); setMaxUses(''); setMinOrderAmount(''); setExpiresAt('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create promo code');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await axios.patch(`/promo/${id}`, { isActive: !currentStatus });
      toast.success('Status updated');
      fetchPromos();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  if (loading) return <div className="p-6 text-white text-center">Loading...</div>;

  return (
    <div className="p-6 text-white h-full overflow-auto">
      <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-rose-400 mb-8">
        Promo Codes Management
      </h1>

      <div>
        <div className="card mb-24">
          <h2 className="text-xl font-bold mb-16">Create New Code</h2>
          <form onSubmit={handleCreate} className="grid-3 items-center">
            <div className="form-group">
              <label className="form-label">Code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} required className="form-input uppercase" placeholder="e.g. SUMMER20" />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="form-select">
                <option value="PERCENTAGE" className="text-black">Percentage (%)</option>
                <option value="FIXED" className="text-black">Fixed Amount (Rs)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Value</label>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} required className="form-input" placeholder="20" min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Max Uses</label>
              <input type="number" value={maxUses} onChange={e => setMaxUses(e.target.value)} className="form-input" placeholder="Unlimited" min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Min Order (Rs)</label>
              <input type="number" value={minOrderAmount} onChange={e => setMinOrderAmount(e.target.value)} className="form-input" placeholder="0" min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date (Optional)</label>
              <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="form-input" />
            </div>
            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary btn-full">
                Create Code
              </button>
            </div>
          </form>
        </div>

        <div>
          <div className="card overflow-hidden" style={{ padding: 0 }}>
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Usage</th>
                  <th className="px-6 py-4">Expiry</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {promos.map(promo => (
                  <tr key={promo.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold text-white">{promo.code}</td>
                    <td className="px-6 py-4 text-emerald-400">
                      {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}%` : `Rs. ${promo.discountValue}`}
                    </td>
                    <td className="px-6 py-4">
                      {promo.usedCount} / {promo.maxUses || '∞'}
                    </td>
                    <td className="px-6 py-4">
                      {promo.expiresAt ? new Date(promo.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${promo.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {promo.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => toggleStatus(promo.id, promo.isActive)}
                        className="btn btn-secondary btn-sm"
                      >
                        Toggle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {promos.length === 0 && (
              <div className="p-8 text-center text-gray-400">No promo codes created yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoCodesPage;
