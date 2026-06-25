import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Send,
  Shield,
  LogOut,
  Landmark,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/accounts', icon: Wallet, label: 'Accounts' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/transfer', icon: Send, label: 'Transfer' },
];

function getInitials(user) {
  if (!user) return 'U';
  const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
  if (!name) return 'U';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const displayName = user ? `${user.first_name} ${user.last_name}` : 'User';
  const displayEmail = user?.email || '';

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop--visible' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''}`}>
        {/* Logo */}
        <div className="sidebar__logo">
          <div className="sidebar__logo-icon">
            <Landmark size={22} strokeWidth={2.2} />
          </div>
          <span className="sidebar__logo-text">BankFlow</span>
        </div>

        {/* Navigation */}
        <nav className="sidebar__nav">
          <span className="sidebar__nav-label">Main Menu</span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `sidebar__link ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              {({ isActive }) => (
                <motion.div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    width: '100%',
                  }}
                  whileHover={{ x: 4 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                >
                  <item.icon
                    className="sidebar__link-icon"
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  <span className="sidebar__link-label">{item.label}</span>
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="sidebar__user">
          <div className="sidebar__user-info">
            <div className="sidebar__avatar">{getInitials(user)}</div>
            <div className="sidebar__user-details">
              <div className="sidebar__user-name">{displayName}</div>
              <div className="sidebar__user-email">{displayEmail}</div>
            </div>
            <motion.button
              className="sidebar__logout"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              title="Logout"
              onClick={handleLogout}
            >
              <LogOut size={17} />
            </motion.button>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
