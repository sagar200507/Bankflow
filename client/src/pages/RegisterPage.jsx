import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, Phone, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/errorUtils';
import toast, { Toaster } from 'react-hot-toast';
import './LoginPage.css';


export default function RegisterPage() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const getStrength = () => {
    const p = form.password;
    if (!p) return { level: 0, text: '', color: '' };
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[@$!%*?&#]/.test(p)) s++;
    if (s <= 1) return { level: 25, text: 'Weak', color: 'var(--danger)' };
    if (s === 2) return { level: 50, text: 'Fair', color: 'var(--accent-amber)' };
    if (s === 3) return { level: 75, text: 'Good', color: 'var(--accent-blue)' };
    return { level: 100, text: 'Strong', color: 'var(--accent-green)' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (form.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register({ firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone || undefined, password: form.password });
      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength();

  return (
    <div className="auth-page">
      <Toaster position="top-right" toastOptions={{ style: { background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--card-border)' } }} />
      <div className="auth-bg-orbs"><div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" /></div>

      <motion.div className="auth-hero" initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
        <div className="auth-hero-logo">
          <div className="auth-logo-icon">B</div>
          <span className="auth-logo-text">Bank<span>Flow</span></span>
        </div>
        <h1>Start Your<br /><span>Banking Journey.</span></h1>
        <p>Create your account in seconds and experience modern digital banking.</p>
        <div className="auth-hero-features">
          <div className="auth-feature"><span className="feature-dot green" />Free account creation</div>
          <div className="auth-feature"><span className="feature-dot blue" />Enterprise-grade security</div>
          <div className="auth-feature"><span className="feature-dot purple" />Instant fund transfers</div>
        </div>
      </motion.div>

      <motion.div className="auth-form-container" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join BankFlow today</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group"><User className="input-icon" size={18} /><input placeholder="First name" value={form.firstName} onChange={update('firstName')} required /></div>
            <div className="input-group"><User className="input-icon" size={18} /><input placeholder="Last name" value={form.lastName} onChange={update('lastName')} required /></div>
          </div>
          <div className="input-group"><Mail className="input-icon" size={18} /><input type="email" placeholder="Email address" value={form.email} onChange={update('email')} required /></div>
          <div className="input-group"><Phone className="input-icon" size={18} /><input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={update('phone')} /></div>
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={update('password')} required />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          {form.password && (
            <>
              <div className="pw-strength"><div className="pw-strength-bar" style={{ width: `${strength.level}%`, background: strength.color }} /></div>
              <div className="pw-strength-text" style={{ color: strength.color }}>{strength.text}</div>
            </>
          )}
         {form.password && (
  <div className="password-rules">
    <div className={/[A-Z]/.test(form.password) ? "valid" : "invalid"}>
      {/[A-Z]/.test(form.password) ?<CheckCircle size={16} /> : <XCircle size={16} />} One uppercase letter
    </div>

    <div className={/[a-z]/.test(form.password) ? "valid" : "invalid"}>
      {/[a-z]/.test(form.password) ? <CheckCircle size={16} /> : <XCircle size={16} />} One lowercase letter
    </div>

    <div className={/\d/.test(form.password) ? "valid" : "invalid"}>
      {/\d/.test(form.password) ? <CheckCircle size={16} /> : <XCircle size={16} />} One number
    </div>

    <div className={/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "valid" : "invalid"}>
      {/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? <CheckCircle size={16} /> : <XCircle size={16} />} One special character
    </div>

    <div className={form.password.length >= 8 ? "valid" : "invalid"}>
      {form.password.length >= 8 ? <CheckCircle size={16} /> : <XCircle size={16} />} Minimum 8 characters
    </div>
  </div>
)}
          <div className="input-group"><Lock className="input-icon" size={18} /><input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <span className="spinner" /> : <><span>Create Account</span><ArrowRight size={18} /></>}
          </button>
          <p className="auth-footer-text">Already have an account? <Link to="/login">Sign In</Link></p>
        </form>
      </motion.div>
    </div>
  );
}
