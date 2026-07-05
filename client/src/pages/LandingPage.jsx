import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Clock, Shield, LayoutDashboard } from 'lucide-react';
import FeaturesCarousel from '../components/FeaturesCarousel/FeaturesCarousel';
import './LandingPage.css';

export default function LandingPage() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80; // navbar height
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      {/* 1. Navbar */}
      <nav className="landing-nav">
        <div className="landing-nav__container">
          <div className="landing-nav__logo">
            <div className="landing-nav__logo-icon">B</div>
            <span className="landing-nav__logo-text">Bank<span>Flow</span></span>
          </div>
          
          <div className="landing-nav__links">
            <button onClick={() => scrollTo('why')} className="landing-nav__link">Why BankFlow</button>
            <button onClick={() => scrollTo('features')} className="landing-nav__link">Features</button>
            <button onClick={() => scrollTo('how')} className="landing-nav__link">How it works</button>
          </div>

          <div className="landing-nav__actions">
            <Link to="/login?tab=login" className="landing-btn landing-btn--ghost">Log in</Link>
            <Link to="/login?tab=register" className="landing-btn landing-btn--primary">Get started</Link>
          </div>
        </div>
      </nav>

      <main className="landing-main">
        {/* 2. Hero */}
        <section className="landing-hero">
          <div className="landing-container">
            <div className="landing-hero__grid">
              <div className="landing-hero__content">
                <span className="landing-hero__eyebrow">FINTECH INFRASTRUCTURE FOR MODERN TEAMS</span>
                <h1 className="landing-hero__title">
                  Banking that moves <span className="text-accent">at your speed.</span>
                </h1>
                <p className="landing-hero__subtitle">
                  Move money globally, gain real-time analytics, and protect your business with enterprise-grade fraud detection—all in one unified platform.
                </p>
                
                <div className="landing-hero__cta">
                  <Link to="/login?tab=register" className="landing-btn landing-btn--primary landing-btn--large">
                    Open an account
                  </Link>
                  <button onClick={() => scrollTo('how')} className="landing-btn landing-btn--secondary landing-btn--large">
                    See how it works
                  </button>
                </div>

                <div className="landing-hero__trust">
                  <p>Trusted by 40,000+ businesses</p>
                  <div className="landing-hero__logos">
                    <span className="trust-logo">Nimbus Health</span>
                    <span className="trust-logo">Corvus Retail</span>
                    <span className="trust-logo">Halden Foods</span>
                    <span className="trust-logo">Marlowe Studio</span>
                  </div>
                </div>
              </div>

              <div className="landing-hero__visual">
                <div className="visual-card">
                  <div className="visual-card__header">
                    <span className="visual-card__label">Total Balance</span>
                    <span className="visual-card__currency">INR</span>
                  </div>
                  <div className="visual-card__balance">₹1,24,592.00</div>
                  
                  <div className="visual-transfer">
                    <div className="visual-node visual-node--start">A</div>
                    <div className="visual-path">
                      <div className="visual-path-line"></div>
                      <motion.div 
                        className="visual-dot"
                        animate={{ left: ['0%', '100%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                    </div>
                    <div className="visual-node visual-node--end">B</div>
                  </div>

                  <div className="visual-transactions">
                    <div className="visual-txn">
                      <div className="visual-txn__left">
                        <div className="visual-txn-dot visual-txn-dot--green"></div>
                        <div>
                          <div className="visual-txn__name">Client Payout</div>
                          <div className="visual-txn__time">Today, 2:45 PM</div>
                        </div>
                      </div>
                      <div className="visual-txn__amount visual-txn__amount--positive">+₹4,250.00</div>
                    </div>
                    <div className="visual-txn">
                      <div className="visual-txn__left">
                        <div className="visual-txn-dot visual-txn-dot--neutral"></div>
                        <div>
                          <div className="visual-txn__name">Cloud Infrastructure</div>
                          <div className="visual-txn__time">Yesterday</div>
                        </div>
                      </div>
                      <div className="visual-txn__amount">-₹845.20</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Why BankFlow */}
        <section id="why" className="landing-section landing-section--tinted">
          <div className="landing-container">
            <div className="landing-section__header">
              <h2>Why BankFlow</h2>
            </div>
            <div className="why-grid">
              <div className="why-card">
                <div className="why-card__icon"><Clock size={20} /></div>
                <h3>Instant settlement</h3>
                <p>Skip the 3-day holding period. Access your funds immediately across our global routing network.</p>
              </div>
              <div className="why-card">
                <div className="why-card__icon"><Shield size={20} /></div>
                <h3>Security by default</h3>
                <p>Every account includes AES-256 encryption, biometric enforcement, and automated threat monitoring.</p>
              </div>
              <div className="why-card">
                <div className="why-card__icon"><LayoutDashboard size={20} /></div>
                <h3>One unified dashboard</h3>
                <p>Manage accounts, issue cards, and run payroll from a single source of truth.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Key Features */}
        <FeaturesCarousel />

        {/* 5. How it works */}
        <section id="how" className="landing-section landing-section--tinted">
          <div className="landing-container">
            <div className="landing-section__header text-center">
              <h2>How it works</h2>
            </div>
            <div className="steps-container">
              <div className="step">
                <div className="step__circle">1</div>
                <h4>Create your account</h4>
                <p>Sign up in under two minutes with instant verification.</p>
              </div>
              <div className="step-connector"></div>
              <div className="step">
                <div className="step__circle">2</div>
                <h4>Connect & fund</h4>
                <p>Link your existing banks and add funds instantly.</p>
              </div>
              <div className="step-connector"></div>
              <div className="step">
                <div className="step__circle">3</div>
                <h4>Send, track, grow</h4>
                <p>Issue payments, monitor analytics, and scale your business.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. CTA Band */}
        <section className="landing-cta-wrapper">
          <div className="landing-container">
            <div className="landing-cta-band">
              <div className="cta-band__content">
                <h2>Ready to transform your banking?</h2>
                <p>Join the thousands of modern teams building on BankFlow.</p>
                <Link to="/login?tab=register" className="landing-btn landing-btn--primary landing-btn--large">
                  Create your account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 7. Footer */}
      <footer className="landing-footer">
        <div className="landing-footer__grid">
          <div className="footer-col footer-col--brand">
            <div className="landing-nav__logo">
              <div className="landing-nav__logo-icon">B</div>
              <span className="landing-nav__logo-text">Bank<span>Flow</span></span>
            </div>
            <p>The financial infrastructure platform for the internet.</p>
          </div>
          <div className="footer-col">
            <h5>Product</h5>
            <Link to="/">Accounts</Link>
            <Link to="/">Transfers</Link>
            <Link to="/">Security</Link>
          </div>
          <div className="footer-col">
            <h5>Company</h5>
            <Link to="/">About</Link>
            <Link to="/">Careers</Link>
            <Link to="/">Blog</Link>
          </div>
          <div className="footer-col">
            <h5>Legal</h5>
            <Link to="/">Privacy</Link>
            <Link to="/">Terms</Link>
            <Link to="/">Licenses</Link>
          </div>
        </div>
        <div className="landing-footer__bottom">
          <p>&copy; {new Date().getFullYear()} BankFlow Inc. All rights reserved.</p>
          <p className="footer-disclaimer">BankFlow is a financial technology company, not a bank. Banking services provided by partner banks, Members FDIC.</p>
        </div>
      </footer>
    </div>
  );
}
