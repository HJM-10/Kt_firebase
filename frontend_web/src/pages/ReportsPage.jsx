import { useState, useEffect } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import { BarChart3, TrendingUp, Users, Calendar, DollarSign } from 'lucide-react';

const ReportsPage = () => {
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState(null);
  const [utilization, setUtilization] = useState(null);
  const [customers, setCustomers] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const [revRes, bookRes, utilRes, custRes] = await Promise.all([
        axios.get('/reports/revenue'),
        axios.get('/reports/bookings'),
        axios.get('/reports/utilization'),
        axios.get('/reports/customers')
      ]);
      
      setRevenue(revRes.data.data);
      setBookings(bookRes.data.data);
      setUtilization(utilRes.data.data);
      setCustomers(custRes.data.data);
    } catch (err) {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleExport = async () => {
    try {
      const response = await axios.get('/reports/export/bookings', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'bookings.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Export downloaded');
    } catch (err) {
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

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.2)', color: 'var(--success)' }}><DollarSign size={24} /></div>
          <div>
            <div className="stat-value">Rs. {revenue?.totalRevenue?.toLocaleString() || 0}</div>
            <div className="stat-label">Total Revenue</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(6,182,212,0.2)', color: 'var(--secondary)' }}><TrendingUp size={24} /></div>
          <div>
            <div className="stat-value">{utilization?.utilizationRate?.toFixed(1) || 0}%</div>
            <div className="stat-label">{utilization?.bookedSlots} / {utilization?.totalSlots} slots booked</div>
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
            <div className="stat-label">Completed Bookings</div>
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
