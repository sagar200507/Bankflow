import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './TopBar.css';

function getInitials(user) {
  if (!user) return 'U';
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (!name) return 'U';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [toast, setToast] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleComingSoon = (e) => {
    e.preventDefault();
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  };

  return (
    <header className="topbar">
      <div className="topbar__container">
        {/* Left: Logo */}
        <Link to="/dashboard" className="topbar__logo">
          <div className="topbar__logo-icon">B</div>
          <span className="topbar__logo-text">Bank<span>Flow</span></span>
        </Link>

        {/* Center-Left: Tabs */}
        <nav className="topbar__nav">
          <NavLink to="/dashboard" end className={({ isActive }) => `topbar__link ${isActive ? 'active' : ''}`}>
            Dashboard
          </NavLink>
          <NavLink to="/transfer" className={({ isActive }) => `topbar__link ${isActive ? 'active' : ''}`}>
            Transfers
          </NavLink>
          <NavLink to="/transactions" className={({ isActive }) => `topbar__link ${isActive ? 'active' : ''}`}>
            Transactions
          </NavLink>
          <a href="#" className="topbar__link topbar__link--disabled" onClick={handleComingSoon}>
            Loans
          </a>
        </nav>

        {/* Right: Actions & User */}
        <div className="topbar__actions">
          <Link to="/accounts" className="topbar__accounts-link">
            Accounts
          </Link>
          
          <div className="topbar__user">
            <div className="topbar__avatar">{getInitials(user)}</div>
            <span className="topbar__name">{user?.first_name || 'User'}</span>
            <button className="topbar__logout" onClick={handleLogout} title="Log out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Temporary Toast for Coming Soon Features */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            className="topbar__toast"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <Info size={16} />
            <span>Loans are coming soon!</span>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default TopBar;
