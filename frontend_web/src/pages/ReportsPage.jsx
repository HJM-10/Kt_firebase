import useLiveRefresh from '../services/useLiveRefresh';
import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Users, Calendar, DollarSign, Wallet, Undo2 } from 'lucide-react';
import { PageHeading, StatCard, ErrorPanel } from '../components/ArenaUI';
import { money } from '../utils/arena';

const ReportsPage = () => {
  const [range, setRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({ from: '', to: '' });
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [utilization, setUtilization] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [error, setError] = useState('');
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
      setError('');
      setRevenue(revRes.data.data);
      setBookings(bookRes.data.data);
      setUtilization(utilRes.data.data);
      setCustomers(custRes.data.data);
    } catch {
      if (version === requestVersion.current) setError('The requested report could not load. Any previous figures shown are from the last successful update. Please retry.');
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
    <div>
      <PageHeading eyebrow="Finance · Reports" title="A clear view of your club." description="Receipts, refunds and court utilization, with dates and definitions you can rely on." actions={<button onClick={handleExport} disabled={!!error} className="btn btn-secondary"><BarChart3 size={17} />Export bookings</button>} />
{error && <ErrorPanel message={error} onRetry={fetchReports} />}
<form className="card modal-form mb-24" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); setRange(values); setApplied(values); }}><div className="grid-3"><label>From<input className="form-input" type="date" name="from" value={range.from} onInput={e => setRange({ ...range, from: e.target.value })} /></label><label>Through<input className="form-input" type="date" name="to" min={range.from} value={range.to} onInput={e => setRange({ ...range, to: e.target.value })} /></label><button className="btn btn-primary">Apply dates</button></div><p className="text-muted">Pakistan calendar days. Revenue uses payment receipt and refund completion dates; booking counts and export use creation dates; utilization uses session dates.</p></form><div className="financial-grid"><StatCard icon={Wallet} value={money(revenue?.grossRevenue)} label="Gross receipts" /><StatCard icon={Undo2} value={money(revenue?.refundedAmount)} label="Completed refunds" /><StatCard icon={DollarSign} value={money(revenue?.totalRevenue)} label="Net revenue" /></div><div className="notice-panel"><span><strong>{money(revenue?.pendingRefunds)}</strong> pending refunds</span><span>Pending refunds are shown separately and reduce net revenue when completed.</span></div>
      <div className="stats-grid"><StatCard icon={TrendingUp} value={((utilization?.utilizationRate || 0).toFixed(1)) + '%'} label="Court utilization by minutes" note={(utilization?.bookedSlots || 0) + ' of ' + (utilization?.totalSlots || 0) + ' eligible sessions confirmed'} /><StatCard icon={Users} value={customers?.totalCustomers || 0} label="Customers through end date" /><StatCard icon={Calendar} value={(bookings?.statusCounts?.CONFIRMED || 0) + (bookings?.statusCounts?.SCANNED || 0)} label="Confirmed or checked-in bookings" /></div>
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
                <div className="text-emerald-400 font-bold">{money(c.totalSpent)}</div>
              </div>
            ))}
            {(!customers?.topCustomers || customers.topCustomers.length === 0) && (
              <div className="text-center text-gray-400 py-4">No customer data yet.</div>
            )}
          </div>
        </div>
        
        <div className="card">
          <h2 className="text-xl font-bold mb-6 text-white border-b border-white/10 pb-4">Net revenue by month</h2>
          <div className="space-y-4">
            {revenue?.revenueByMonth && Object.keys(revenue.revenueByMonth).length > 0 ? (
              Object.keys(revenue.revenueByMonth).sort().reverse().map(month => (
                <div key={month} className="revenue-item">
                  <div className="revenue-item-header">
                    <div className="font-bold text-white">{month}</div>
                    <div className="text-emerald-400 font-bold">{money(revenue.revenueByMonth[month])}</div>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full" 
                      style={{ height: 6, borderRadius: 4, background: revenue.revenueByMonth[month] < 0 ? 'var(--danger)' : 'var(--primary)', width: `${Math.min(100, Math.abs(revenue.revenueByMonth[month]) / Math.max(1, ...Object.values(revenue.revenueByMonth).map(Math.abs)) * 100)}%` }}
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
