import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, ArrowLeft, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage } from '../utils/errorUtils';
import './LoginPage.css';

export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Clear form errors/state when switching tabs
  useEffect(() => {
    setForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
    setShowPw(false);
    setErrorMsg('');
  }, [currentTab]);

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  const update = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
    if (errorMsg) setErrorMsg(''); // clear error when user types
  };

  const getStrength = () => {
    const p = form.password;
    if (!p) return { level: 0, text: '', color: '' };
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[@$!%*?&#]/.test(p)) s++;
    if (s <= 1) return { level: 25, text: 'Weak', color: 'var(--danger)' };
    if (s === 2) return { level: 50, text: 'Fair', color: 'var(--amber)' };
    if (s === 3) return { level: 75, text: 'Good', color: 'var(--sky)' };
    return { level: 100, text: 'Strong', color: 'var(--mint)' };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    // Client-side validation for empty fields
    if (!form.email || !form.password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    setLoading(true);

    try {
      if (currentTab === 'register') {
        if (!form.firstName || !form.lastName) {
          setErrorMsg('First and last name are required.');
          setLoading(false);
          return;
        }
        if (form.password !== form.confirmPassword) {
          setErrorMsg('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (form.password.length < 8) {
          setErrorMsg('Password must be at least 8 characters.');
          setLoading(false);
          return;
        }
        await register({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password
        });
      } else {
        await login(form.email, form.password);
      }
      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(getErrorMessage(err, currentTab === 'register' ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength();

  return (
    <div className="auth-split-layout">
      {/* ── Left Side (Form) ─────────────────────────────────────── */}
      <div className="auth-left">
        <div className="auth-left__container">
          
          {/* Header */}
          <div className="auth-header">
            <Link to="/" className="back-link">
              <ArrowLeft size={16} /> Back to home
            </Link>
            
            <Link to="/" className="auth-logo mt-6 block">
              <div className="flex items-center gap-2">
                <div className="auth-logo-icon">B</div>
                <span className="auth-logo-text">Bank<span>Flow</span></span>
              </div>
            </Link>
          </div>

          <div className="auth-form-wrapper">
            <h1 className="auth-title">
              {currentTab === 'login' ? 'Welcome back' : 'Create an account'}
            </h1>
            <p className="auth-subtitle">
              {currentTab === 'login' 
                ? 'Enter your details to access your dashboard.' 
                : 'Start managing your finances with BankFlow today.'}
            </p>

            {/* Tabs */}
            <div className="auth-tabs">
              <button 
                className={`auth-tab ${currentTab === 'login' ? 'active' : ''}`}
                onClick={() => setTab('login')}
                type="button"
              >
                Log in
              </button>
              <button 
                className={`auth-tab ${currentTab === 'register' ? 'active' : ''}`}
                onClick={() => setTab('register')}
                type="button"
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="auth-form">
              <AnimatePresence mode="wait">
                {currentTab === 'register' && (
                  <motion.div 
                    key="register-fields"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="auth-form-group"
                  >
                    <div className="input-row">
                      <div className="input-group">
                        <User className="input-icon" size={18} />
                        <input placeholder="First name" value={form.firstName} onChange={update('firstName')} required={currentTab === 'register'} />
                      </div>
                      <div className="input-group">
                        <User className="input-icon" size={18} />
                        <input placeholder="Last name" value={form.lastName} onChange={update('lastName')} required={currentTab === 'register'} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="input-group">
                <Mail className="input-icon" size={18} />
                <input type="email" placeholder="Email address" value={form.email} onChange={update('email')} required />
              </div>

              <div className="input-group">
                <Lock className="input-icon" size={18} />
                <input type={showPw ? 'text' : 'password'} placeholder="Password" value={form.password} onChange={update('password')} required />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <AnimatePresence>
                {currentTab === 'register' && form.password && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="pw-strength">
                      <div className="pw-strength-bar" style={{ width: `${strength.level}%`, background: strength.color }} />
                    </div>
                    
                    <div className="password-rules">
                      <div className={/[A-Z]/.test(form.password) ? "valid" : "invalid"}>
                        {/[A-Z]/.test(form.password) ?<CheckCircle size={14} /> : <XCircle size={14} />} One uppercase letter
                      </div>
                      <div className={/[a-z]/.test(form.password) ? "valid" : "invalid"}>
                        {/[a-z]/.test(form.password) ? <CheckCircle size={14} /> : <XCircle size={14} />} One lowercase letter
                      </div>
                      <div className={/\d/.test(form.password) ? "valid" : "invalid"}>
                        {/\d/.test(form.password) ? <CheckCircle size={14} /> : <XCircle size={14} />} One number
                      </div>
                      <div className={/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? "valid" : "invalid"}>
                        {/[!@#$%^&*(),.?":{}|<>]/.test(form.password) ? <CheckCircle size={14} /> : <XCircle size={14} />} One special character
                      </div>
                      <div className={form.password.length >= 8 ? "valid" : "invalid"}>
                        {form.password.length >= 8 ? <CheckCircle size={14} /> : <XCircle size={14} />} Minimum 8 characters
                      </div>
                    </div>

                    <div className="input-group mt-3">
                      <Lock className="input-icon" size={18} />
                      <input type="password" placeholder="Confirm password" value={form.confirmPassword} onChange={update('confirmPassword')} required={currentTab === 'register'} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Inline Error State */}
              {errorMsg && (
                <div className="auth-error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : (
                  <>
                    <span>{currentTab === 'register' ? 'Create account' : 'Log in'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="auth-left-footer">
            <p>&copy; {new Date().getFullYear()} BankFlow Inc. <Link to="/">Privacy & Terms</Link></p>
          </div>
        </div>
      </div>

      {/* ── Right Side (Brand Panel) ───────────────────────────────── */}
      <div className="auth-right">
        <div className="auth-right__content">
          {/* TODO: Replace with a real customer testimonial (with permission) before launch — do not ship a fabricated named quote. */}
          <div className="auth-quote">
            <h3>"BankFlow replaced three different tools and gave us complete visibility into our global treasury. It's the most reliable infrastructure we've ever used."</h3>
            <p className="auth-quote__author">— Finance Lead, mid-market retail company</p>
          </div>
          
          <div className="auth-stats">
            <div className="auth-stat">
              <span className="auth-stat__value">40k+</span>
              <span className="auth-stat__label">Businesses Served</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat__value">₹12B</span>
              <span className="auth-stat__label">Volume Processed</span>
            </div>
            <div className="auth-stat">
              <span className="auth-stat__value">99.99%</span>
              <span className="auth-stat__label">API Uptime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
