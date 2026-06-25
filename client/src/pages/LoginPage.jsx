import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/errorUtils';
import toast, { Toaster } from 'react-hot-toast';
import './LoginPage.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' } }} />
      <div className="auth-bg-orbs">
        <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
      </div>

      <motion.div className="auth-hero" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
        <div className="auth-hero-logo">
          <div className="auth-logo-icon">B</div>
          <span className="auth-logo-text">Bank<span>Flow</span></span>
        </div>
        <h1>Secure Banking,<br /><span>Simplified.</span></h1>
        <p>Manage your finances with enterprise-grade security and a beautiful interface.</p>
        <div className="auth-hero-features">
          <div className="auth-feature"><span className="feature-dot green" />Real-time transactions</div>
          <div className="auth-feature"><span className="feature-dot blue" />Advanced fraud detection</div>
          <div className="auth-feature"><span className="feature-dot purple" />Analytics dashboard</div>
        </div>
      </motion.div>

      <motion.div className="auth-form-container" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Welcome Back</h2>
          <p className="auth-subtitle">Sign in to your BankFlow account</p>

          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>

          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input type={showPw ? 'text' : 'password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <><span>Sign In</span><ArrowRight size={18} /></>}
          </button>

          <p className="auth-footer-text">
            Don&apos;t have an account? <Link to="/register">Sign Up</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
