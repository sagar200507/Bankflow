import { useLocation, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

function Layout() {
  const location = useLocation();

  return (
    <div className="layout">
      <TopBar />
      <main className="layout__main">
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
