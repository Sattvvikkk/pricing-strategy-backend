import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot, Send, Sparkles, User, Loader2, Activity, AlertCircle,
} from 'lucide-react';

import API from '../api/client';
import { fadeUp } from '../motion/tokens';

const STARTERS_FALLBACK = [
  'Which products have the highest revenue impact opportunity?',
  'Where is my inventory most at risk?',
  'How do I balance margin and market share?',
  'What does elasticity mean for my pricing?',
];

function ProviderChip({ mode }) {
  const meta = {
    gemini: { label: 'Gemini · Live',    color: '#1a73e8', dot: '#1a73e8' },
    groq:   { label: 'Groq Llama · Live', color: '#f55036', dot: '#f55036' },
    demo:   { label: 'Demo mode',         color: '#b45309', dot: '#b45309' },
  }[mode] || { label: 'Loading…', color: '#52525B', dot: '#52525B' };

  return (
    <span className="ai-mode" style={{ color: meta.color }}>
      <span className="ai-mode__dot" style={{ background: meta.dot }} />
      {meta.label}
    </span>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      className={`ai-msg ${isUser ? 'ai-msg--user' : 'ai-msg--bot'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="ai-msg__avatar" aria-hidden="true">
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className="ai-msg__bubble">
        <div className="ai-msg__text">{msg.content}</div>
        {msg.provider && (
          <div className="ai-msg__meta">
            via {msg.provider}{msg.model ? ` · ${msg.model}` : ''}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AICopilot() {
  const [mode, setMode] = useState(null);
  const [productId, setProductId] = useState('');
  const [products, setProducts] = useState([]);
  const [suggestions, setSuggestions] = useState(STARTERS_FALLBACK);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  // Load mode + products
  useEffect(() => {
    API.get('/api/ai/mode').then((r) => setMode(r.data?.mode)).catch(() => setMode('demo'));
    API.get('/api/products').then((r) => setProducts(r.data?.products || [])).catch(() => setProducts([]));
  }, []);

  // Refresh suggestions when product changes
  useEffect(() => {
    const url = productId
      ? `/api/ai/suggestions/${productId}`
      : '/api/ai/suggestions';
    API.get(url)
      .then((r) => setSuggestions(r.data?.suggestions || STARTERS_FALLBACK))
      .catch(() => setSuggestions(STARTERS_FALLBACK));
  }, [productId]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || sending) return;

    setInput('');
    setError(null);
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);

    try {
      const res = await API.post('/api/ai/chat', {
        question,
        product_id: productId || null,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.data?.answer || '(no response)',
          provider: res.data?.provider,
          model: res.data?.model,
        },
      ]);
    } catch (err) {
      setError('Failed to reach the assistant.');
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry — something went wrong reaching the assistant.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const productLabel = productId
    ? products.find((p) => p.id === productId)?.name || 'Product'
    : 'Whole catalog';

  return (
    <div className="ai">
      <header className="ai__header">
        <div>
          <div className="ai__title-row">
            <Bot size={20} strokeWidth={1.75} />
            <h1 className="ai__title">AI Copilot</h1>
            <ProviderChip mode={mode} />
          </div>
          <p className="ai__sub">
            Grounded in your product catalog, ML predictions, and competitor data.
          </p>
        </div>
        <div className="ai__product-picker">
          <label className="sb-controls__label">Context</label>
          <select
            className="sb-picker"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          >
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </header>

      {mode === 'demo' && (
        <div className="ai__demo-banner">
          <AlertCircle size={14} />
          <span>
            Running in <strong>demo mode</strong> — answers are deterministic. Set <code>GEMINI_API_KEY</code> (or <code>GROQ_API_KEY</code>) on the backend to enable live LLM responses.
          </span>
        </div>
      )}

      <div className="ai__chat">
        <div className="ai__transcript" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="ai__welcome">
              <div className="ai__welcome-icon">
                <Sparkles size={20} strokeWidth={2} />
              </div>
              <h2>Ask anything about <em>{productLabel}</em></h2>
              <p>Forecasts, margins, competitors, risk, strategy — the assistant grounds every answer in your data.</p>
              <div className="ai__starters">
                {suggestions.slice(0, 5).map((s) => (
                  <motion.button
                    key={s}
                    type="button"
                    className="ai__starter"
                    variants={fadeUp}
                    initial="initial"
                    animate="animate"
                    onClick={() => send(s)}
                  >
                    <Activity size={12} strokeWidth={2.25} />
                    <span>{s}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Message key={i} msg={m} />)
          )}
          {sending && (
            <div className="ai-msg ai-msg--bot">
              <div className="ai-msg__avatar"><Bot size={14} /></div>
              <div className="ai-msg__bubble">
                <Loader2 size={14} className="pw-spin" />
                <span style={{ marginLeft: 8, fontSize: 12, color: 'rgba(26,58,46,0.6)' }}>
                  Thinking…
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="ai__error"><AlertCircle size={14} /> {error}</div>
          )}
        </div>

        <div className="ai__input-row">
          <textarea
            className="ai__input"
            placeholder={`Ask about ${productLabel.toLowerCase()}…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            disabled={sending}
          />
          <button
            type="button"
            className="ai__send"
            onClick={() => send()}
            disabled={!input.trim() || sending}
          >
            {sending ? <Loader2 size={16} className="pw-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
