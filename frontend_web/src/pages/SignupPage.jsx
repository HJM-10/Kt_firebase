import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandMark } from '../components/ArenaUI';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';

const SignupPage = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await register(form.name, form.email, form.password, form.phone);
      toast.success(`Welcome to Smart Sports Hub, ${user.name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
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
          <div className="auth-title">Create Account</div>
          <div className="auth-subtitle">Join Smart Sports Hub today</div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text" className="form-input" placeholder="John Doe"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email" className="form-input" placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number (Optional)</label>
            <input
              type="tel" className="form-input" placeholder="+1 234 567 8900"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password" className="form-input" placeholder="••••••••"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg mt-8" disabled={loading}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>

          <div className="auth-divider mt-8">
            Already have an account? <Link to="/login" className="auth-link">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;
