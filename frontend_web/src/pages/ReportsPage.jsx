import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';

const ReportsPage = () => {
  const [range, setRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [utilization, setUtilization] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);

  const fetchReports = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const [revRes, bookRes, utilRes, custRes] = await Promise.all([
        axios.get('/reports/revenue', { params: applied }),
        axios.get('/reports/bookings', { params: applied }),
        axios.get('/reports/utilization', { params: applied }),
        axios.get('/reports/customers', { params: applied })
      ]);
      
      if (version !== requestVersion.current) return;
      setRevenue(revRes.data.data);
      setBookings(bookRes.data.data);
      setUtilization(utilRes.data.data);
      setCustomers(custRes.data.data);
    } catch {
      if (version === requestVersion.current) toast.error('Failed to load reports');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);
  useLiveRefresh('reports', fetchReports);

  const handleExport = async () => {
    try {
      const response = await axios.get('/reports/export/bookings', { responseType: 'blob', params: applied });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'bookings.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Failed to export data');
    }
  };
  if (loading) return <div className="p-6 text-white text-center">Gathering analytics...</div>;

  return (
    <div className="p-6 text-white h-full overflow-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
            Analytics & Reports
          </h1>
          <p className="text-gray-400 mt-1">Platform performance and insights</p>
        </div>
        <button 
          onClick={handleExport}
          className="btn btn-secondary"
        >
          <BarChart3 size={18} /> Export Data
        </button>
      </div>

<form className="card modal-form mb-24" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); setRange(values); setApplied(values); }}><div className="grid-3"><label>From<input className="form-input" type="date" name="from" value={range.from} onChange={e => setRange({ ...range, from: e.target.value })} /></label><label>Through<input className="form-input" type="date" name="to" min={range.from} value={range.to} onChange={e => setRange({ ...range, to: e.target.value })} /></label><button className="btn btn-primary">Apply dates</button></div><p className="text-muted">Pakistan calendar days. Revenue uses payment receipt and refund completion dates; booking counts and export use creation dates; utilization uses session dates.</p></form><div className="card mb-24"><p>Gross receipts: PKR {revenue?.grossRevenue?.toLocaleString() || 0} · Completed refunds: PKR {revenue?.refundedAmount?.toLocaleString() || 0} · Pending refunds: PKR {revenue?.pendingRefunds?.toLocaleString() || 0}</p></div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--success)' }}><DollarSign size={24} /></div>
          <div>
            <div className="stat-value">Rs. {revenue?.totalRevenue?.toLocaleString() || 0}</div>
            <div className="stat-label">Net Revenue</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(6,182,212,0.2)', color: 'var(--secondary)' }}><TrendingUp size={24} /></div>
          <div>
            <div className="stat-value">{utilization?.utilizationRate?.toFixed(1) || 0}%</div>
            <div className="stat-label">{utilization?.bookedSlots} / {utilization?.totalSlots} confirmed slots · rate weighted by minutes</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.2)', color: 'var(--primary-light)' }}><Users size={24} /></div>
          <div>
            <div className="stat-value">{customers?.totalCustomers || 0}</div>
            <div className="stat-label">Total Customers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--warning)' }}><Calendar size={24} /></div>
          <div>
            <div className="stat-value">
              {(bookings?.statusCounts?.CONFIRMED || 0) + (bookings?.statusCounts?.SCANNED || 0)}
            </div>
            <div className="stat-label">Confirmed / Checked-in Bookings</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4">Top Spending Customers</h2>
          <div className="space-y-4">
            {customers?.topCustomers?.map((c, i) => (
              <div key={i} className="list-item">
                <div className="list-item-left">
                  <div className="avatar">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white">{c.user.name}</div>
                    <div className="text-xs text-gray-400">{c.user.email}</div>
                  </div>
                </div>
                <div className="text-emerald-400 font-bold">Rs. {c.totalSpent.toLocaleString()}</div>
              </div>
            ))}
            {(!customers?.topCustomers || customers.topCustomers.length === 0) && (
              <div className="text-center text-gray-400 py-4">No customer data yet.</div>
            )}
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4">Revenue by Month</h2>
          <div className="space-y-4">
            {revenue?.revenueByMonth && Object.keys(revenue.revenueByMonth).length > 0 ? (
              Object.keys(revenue.revenueByMonth).sort().reverse().map(month => (
                <div key={month} className="revenue-item">
                  <div className="revenue-item-header">
                    <div className="font-bold text-white">{month}</div>
                    <div className="text-emerald-400 font-bold">Rs. {revenue.revenueByMonth[month].toLocaleString()}</div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(100, (revenue.revenueByMonth[month] / revenue.totalRevenue) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-4">No revenue data yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
