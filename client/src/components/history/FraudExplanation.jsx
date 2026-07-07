import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Send, Loader2, Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { transactionsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import './FraudExplanation.css';

export default function FraudExplanation({ transactionId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState(null);
  const [turns, setTurns] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  
  const scrollRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    
    transactionsAPI.getFraudExplanation(transactionId)
      .then(({ data }) => {
        if (mounted) {
          setExplanation(data.data.explanation);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (mounted) {
          toast.error(error.response?.data?.message || 'Failed to load AI explanation');
          setLoading(false);
        }
      });
      
    return () => { mounted = false; };
  }, [transactionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, explanation]);

  const handleAsk = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;

    const currentQ = question.trim();
    setQuestion('');
    setAsking(true);

    // Optimistically add the user's question to the UI
    setTurns(prev => [...prev, { type: 'user', content: currentQ }]);

    try {
      const { data } = await transactionsAPI.askFraudQuestion(transactionId, currentQ);
      setTurns(prev => [...prev, { type: 'bot', content: data.data.answer }]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to get answer');
      // Remove the optimistic question on failure to keep state clean, or just show error message in chat
      setTurns(prev => [...prev, { type: 'bot', content: '❌ Sorry, an error occurred while processing your question.' }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <motion.div 
      className="fraud-explanation-container"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="fraud-explanation-header">
        <div className="fraud-explanation-title">
          <ShieldAlert size={18} className="fraud-icon" />
          <h4>Automated Security Flag</h4>
        </div>
      </div>

      <div className="fraud-explanation-body" ref={scrollRef}>
        {loading ? (
          <div className="fraud-loading-state">
            <Loader2 className="spinner" size={24} />
            <p>Analyzing deterministic signals...</p>
          </div>
        ) : explanation ? (
          <>
            <div className="fraud-chat-message bot">
              <div className="fraud-avatar"><Bot size={16} /></div>
              <div className="fraud-markdown">
                <ReactMarkdown>{explanation}</ReactMarkdown>
              </div>
            </div>

            {turns.map((turn, idx) => (
              <div key={idx} className={`fraud-chat-message ${turn.type}`}>
                <div className="fraud-avatar">
                  {turn.type === 'bot' ? <Bot size={16} /> : <User size={16} />}
                </div>
                <div className="fraud-markdown">
                  <ReactMarkdown>{turn.content}</ReactMarkdown>
                </div>
              </div>
            ))}

            {asking && (
              <div className="fraud-chat-message bot">
                <div className="fraud-avatar"><Bot size={16} /></div>
                <div className="fraud-loading-dots">
                  <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="fraud-error-state">
            <p>Could not load explanation. Please check back later.</p>
          </div>
        )}
      </div>

      {!loading && explanation && (
        <form className="fraud-explanation-input" onSubmit={handleAsk}>
          <input 
            type="text" 
            placeholder="Ask a follow-up question..." 
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
          />
          <button type="submit" disabled={asking || !question.trim()}>
            <Send size={16} />
          </button>
        </form>
      )}
    </motion.div>
  );
}
