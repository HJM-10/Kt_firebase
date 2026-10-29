import { useEffect, useState } from 'react';
import { CalendarCheck, Dumbbell, Trophy } from 'lucide-react';
import useAuthStore from '../store/authStore';
import api from '../api/axios';
import { socket } from '../services/socket';
import { Joyride, STATUS } from 'react-joyride';
import { useNavigate } from 'react-router-dom';

const DashboardPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);

  const [runTour, setRunTour] = useState(false);
  const steps = [
    {
      target: '.workspace-header',
      content: 'This is the sidebar where you can navigate through the app. You can book venues, register for events, and manage equipment.',
      disableBeacon: true,
    },
    {
      target: '.stats-grid',
      content: 'Here is your dashboard overview showing all your quick stats and upcoming bookings.',
    },
    {
      target: '.page-header',
      content: 'You can check your personalized dashboard and quickly navigate to everything you need!',
    }
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (isAdmin) {
          const [bookingsRes, sportsRes, tournamentsRes, revenueRes] = await Promise.all([
            api.get('/bookings'),
            api.get('/sports'),
            api.get('/tournaments'),
            api.get('/reports/revenue')
          ]);
          setStats({
            totalBookings: bookingsRes.data.data.length,
            activeSports: sportsRes.data.data.length,
            tournaments: tournamentsRes.data.data.length,
            revenue: revenueRes.data.data.totalRevenue
          });
          setRecentBookings(bookingsRes.data.data.slice(0, 5));
        } else {
          const bookingsRes = await api.get('/bookings/my');
          setStats({
            myBookings: bookingsRes.data.data.length,
            upcoming: bookingsRes.data.data.filter(b => b.status === 'CONFIRMED' && new Date(b.slot.date) >= new Date()).length
          });
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();

    socket.connect();
    socket.on('booking_updated', fetchStats);
    socket.on('connect', fetchStats);
    socket.on('event_updated', fetchStats);
    socket.on('complaint_updated', fetchStats);

    return () => {
      socket.off('booking_updated', fetchStats);
      socket.off('connect', fetchStats);
      socket.off('event_updated', fetchStats);
      socket.off('complaint_updated', fetchStats);
    };
  }, [isAdmin]);

  useEffect(() => {
    // Only run tour once per user session or device
    const tourShown = localStorage.getItem('tourShown');
    if (!tourShown) {
      setRunTour(true);
    }
  }, []);

  const handleJoyrideCallback = (data) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem('tourShown', 'true');
      setRunTour(false);
    }
  };

  return (
    <div>
      <Joyride
        steps={steps}
        run={runTour}
        continuous={true}
        showSkipButton={true}
        showProgress={true}
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#174c36',
            backgroundColor: 'var(--bg-card)',
            textColor: 'var(--text)',
            arrowColor: 'var(--bg-card)',
          }
        }}
      />
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <div className="page-subtitle">Welcome back, {user?.name}</div>
      </div>

      {stats ? (
        <div className="stats-grid">
          {isAdmin ? (
            <>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}><CalendarCheck /></div>
                <div>
                  <div className="stat-value">{stats.totalBookings}</div>
                  <div className="stat-label">Total Bookings</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}><span>$</span></div>
                <div>
                  <div className="stat-value">PKR {stats.revenue}</div>
                  <div className="stat-label">Total Revenue</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}><Dumbbell /></div>
                <div>
                  <div className="stat-value">{stats.activeSports}</div>
                  <div className="stat-label">Active Sports</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--secondary)' }}><Trophy /></div>
                <div>
                  <div className="stat-value">{stats.tournaments}</div>
                  <div className="stat-label">Tournaments</div>
                </div>
              </div>

              <div style={{gridColumn: '1 / -1', marginTop: '24px'}}>
                <h3 style={{marginBottom: 16}}>Quick Actions</h3>
                <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                  <button className="btn btn-primary" onClick={() => navigate('/bookings')}>+ Book for Walk-in</button>
                  <button className="btn btn-outline" onClick={() => navigate('/scan')}>Scan QR</button>
                  <button className="btn btn-outline" onClick={() => navigate('/users')}>Manage Users</button>
                </div>
              </div>

              <div style={{gridColumn: '1 / -1', marginTop: '24px'}}>
                <h3 style={{marginBottom: 16}}>Recent Activity</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Venue</th>
                        <th>Status</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map(b => (
                        <tr key={b.id}>
                          <td>{b.user?.name}</td>
                          <td>{b.slot?.venue?.name}</td>
                          <td>
                            <span className={`badge badge-${b.status === 'CONFIRMED' ? 'primary' : b.status === 'SCANNED' ? 'success' : 'warning'}`}>
                              {b.status}
                            </span>
                          </td>
                          <td style={{fontWeight: 700}}>PKR {b.finalPrice}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
             <>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}><CalendarCheck /></div>
                <div>
                  <div className="stat-value">{stats.myBookings}</div>
                  <div className="stat-label">Total Bookings</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}><CalendarCheck /></div>
                <div>
                  <div className="stat-value">{stats.upcoming}</div>
                  <div className="stat-label">Upcoming Bookings</div>
                </div>
              </div>
             </>
          )}
        </div>
      ) : (
        <div className="loader-wrap"><div className="spinner"></div></div>
      )}
    </div>
  );
};

export default DashboardPage;
