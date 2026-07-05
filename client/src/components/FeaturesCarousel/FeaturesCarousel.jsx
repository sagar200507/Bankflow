import { useState, useRef, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, Zap, BarChart3, Landmark, ShieldAlert, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';
import './FeaturesCarousel.css';

const features = [
  { id: 0, title: 'Bank-grade Security', desc: 'Enterprise compliance and real-time encryption for total peace of mind.', icon: ShieldCheck },
  { id: 1, title: 'Fast Transfers', desc: 'Move money globally with optimal routing and zero hidden fees.', icon: Zap },
  { id: 2, title: 'Real-time Analytics', desc: 'Track cash flow, categorize spending, and forecast runway instantly.', icon: BarChart3 },
  { id: 3, title: 'Account Management', desc: 'Open unlimited checking, savings, and operating accounts in seconds.', icon: Landmark },
  { id: 4, title: 'Fraud Protection', desc: 'Machine learning models that adapt to and block emerging threats.', icon: ShieldAlert },
  { id: 5, title: 'Flexible Loans', desc: 'Access fast capital based on your real-time revenue and cash flow.', icon: Banknote },
];

export default function FeaturesCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  
  const trackRef = useRef(null);
  const cardRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  // Measure card width on mount and resize to calculate exact drag translation
  useEffect(() => {
    const measure = () => {
      if (cardRef.current) {
        setCardWidth(cardRef.current.offsetWidth);
      }
    };
    measure();
    
    // Slight delay to ensure fonts/CSS are fully painted
    setTimeout(measure, 100);
    
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const handleNext = () => {
    if (activeIndex < features.length - 1) setActiveIndex(prev => prev + 1);
  };

  const handlePrev = () => {
    if (activeIndex > 0) setActiveIndex(prev => prev - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'ArrowLeft') handlePrev();
  };

  const onDragEnd = (event, info) => {
    const swipeThreshold = 50;
    // info.offset.x is negative when swiping left (going to next)
    if (info.offset.x < -swipeThreshold && activeIndex < features.length - 1) {
      handleNext();
    } else if (info.offset.x > swipeThreshold && activeIndex > 0) {
      handlePrev();
    }
  };

  const gap = 24; // matches var(--space-6) in CSS for gap
  const translationX = -(activeIndex * (cardWidth + gap));

  return (
    <section id="features" className="features-carousel-section">
      <div className="fc-content-wrapper">
        <div className="fc-header">
          <h2>Key Features</h2>
        </div>

        <div 
          className="fc-viewport" 
          tabIndex={0} 
          onKeyDown={handleKeyDown}
          aria-label="Features carousel. Use left and right arrow keys to navigate."
        >
          <motion.div 
            className="fc-track"
            ref={trackRef}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={onDragEnd}
            animate={{ x: translationX }}
            transition={{
              type: prefersReducedMotion ? "tween" : "spring",
              stiffness: 300,
              damping: 30,
              duration: prefersReducedMotion ? 0 : undefined
            }}
          >
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              const isActive = idx === activeIndex;
              
              return (
                <motion.div 
                  key={feature.id} 
                  ref={idx === 0 ? cardRef : null}
                  className={`fc-card ${isActive ? 'active' : ''}`}
                  animate={{
                    scale: isActive ? 1 : (prefersReducedMotion ? 1 : 0.85),
                    opacity: isActive ? 1 : 0.3
                  }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
                >
                  <div className="fc-card__icon"><Icon size={24} /></div>
                  <h4>{feature.title}</h4>
                  <p>{feature.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        <div className="fc-controls">
          <button 
            className="fc-arrow" 
            onClick={handlePrev} 
            disabled={activeIndex === 0}
            aria-label="Previous feature"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="fc-dots" role="tablist">
            {features.map((f, i) => (
              <button 
                key={f.id} 
                className={`fc-dot ${i === activeIndex ? 'active' : ''}`}
                onClick={() => setActiveIndex(i)}
                aria-label={`Go to feature ${i + 1}`}
                role="tab"
                aria-selected={i === activeIndex}
              />
            ))}
          </div>

          <button 
            className="fc-arrow" 
            onClick={handleNext} 
            disabled={activeIndex === features.length - 1}
            aria-label="Next feature"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>
    </section>
  );
}
