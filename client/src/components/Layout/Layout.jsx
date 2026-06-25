import { useState, useCallback, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import './Layout.css';

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const pageTransition = {
  type: 'tween',
  ease: [0.25, 0.1, 0.25, 1],
  duration: 0.3,
};

/* Map route paths to page titles */
const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/accounts': 'Accounts',
  '/transactions': 'Transactions',
  '/transfer': 'Transfer Funds',
};

function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const title = useMemo(
    () => ROUTE_TITLES[location.pathname] || 'BankFlow',
    [location.pathname]
  );

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="layout">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={handleSidebarClose}
      />

      <main className="layout__main">
        <TopBar
          title={title}
          onMenuToggle={handleMenuToggle}
        />

        <div className="layout__content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              className="layout__page"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default Layout;
