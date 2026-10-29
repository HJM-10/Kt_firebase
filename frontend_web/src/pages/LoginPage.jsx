import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/ArenaUI';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [firebaseAvailable, setFirebaseAvailable] = useState(false), [firebase, setFirebase] = useState(false), [existingPassword, setExistingPassword] = useState('');
  useEffect(() => { api.get('/auth/providers').then(r => setFirebaseAvailable(r.data.data.firebase)).catch(() => {}); }, []);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.email, form.password, firebase, existingPassword);
      toast.success(`Welcome back, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <span className="brand-mark"><BrandMark /></span>
          </div>
          <div className="auth-title">Welcome Back</div>
          <div className="auth-subtitle">Sign in to Smart Sports Hub</div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {firebaseAvailable && <label><input type="checkbox" checked={firebase} onChange={e => setFirebase(e.target.checked)} /> Sign in with my verified Firebase account</label>}
          {firebase && <label className="form-label">Existing local password (only when linking an existing account)<input type="password" autoComplete="current-password" className="form-input" value={existingPassword} onChange={e => setExistingPassword(e.target.value)} /><small>New verified Firebase users become customers. Existing staff access requires proof of the local account.</small></label>}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email Address</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button id="login-btn" type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="auth-divider">
            Don't have an account? <Link to="/signup" className="auth-link">Sign up</Link>
          </div>

        </form>
      </div>
    </div>
  );
};

export default LoginPage;
