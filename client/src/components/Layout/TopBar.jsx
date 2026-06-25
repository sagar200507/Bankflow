import { motion } from 'framer-motion';
import { Search, Bell, Menu } from 'lucide-react';
import './TopBar.css';

function TopBar({ title, subtitle, onMenuToggle }) {
  return (
    <header className="topbar">
      {/* Mobile hamburger */}
      <motion.button
        className="topbar__hamburger"
        onClick={onMenuToggle}
        whileTap={{ scale: 0.9 }}
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </motion.button>

      {/* Title */}
      <div className="topbar__title-area">
        <h1 className="topbar__title">{title || 'Dashboard'}</h1>
        {subtitle && <p className="topbar__subtitle">{subtitle}</p>}
      </div>

      {/* Search */}
      <div className="topbar__search">
        <Search className="topbar__search-icon" size={16} />
        <input
          className="topbar__search-input"
          type="text"
          placeholder="Search transactions, accounts…"
          aria-label="Search"
        />
      </div>

      {/* Actions */}
      <div className="topbar__actions">
        <motion.button
          className="topbar__icon-btn"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          aria-label="Notifications"
        >
          <Bell size={19} />
          <span className="topbar__badge" />
        </motion.button>
      </div>
    </header>
  );
}

export default TopBar;
