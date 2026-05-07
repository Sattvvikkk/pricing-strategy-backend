import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, Sparkles, TrendingUp, AlertCircle, Zap, Lightbulb } from 'lucide-react';
import API from '../api/client';
import './AICopilot.css';

/**
 * AICopilot Component
 * 
 * Conversational AI interface for strategy building.
 * User can ask natural language questions about pricing strategy.
 */

const EXAMPLE_PROMPTS = [
  "How can I increase profit margin this quarter?",
  "Should we lower prices to compete with rivals?",
  "What's the best strategy for our summer collection?",
  "How do I maximize revenue with current inventory?",
];

const INSIGHT_TYPE_ICONS = {
  market_risk: <AlertCircle size={16} />,
  revenue_opportunity: <TrendingUp size={16} />,
  trend_alert: <Zap size={16} />,
  ai_recommendation: <Lightbulb size={16} />,
};

const INSIGHT_TYPE_COLORS = {
  market_risk: '#EF4444',
  revenue_opportunity: '#22C55E',
  trend_alert: '#F59E0B',
  ai_recommendation: '#3B82F6',
};

export default function AICopilot({ productId, goalType, onGoalChange }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const [selectedGoal, setSelectedGoal] = useState(goalType || 'maximize_profit');
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (customMessage = null) => {
    const message = customMessage || inputValue.trim();
    if (!message || !productId) return;

    // Clear input
    setInputValue('');
    setShowExamples(false);

    // Add user message
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Fetch AI response
    setIsLoading(true);
    try {
      const response = await API.post('/api/copilot/chat', {
        product_id: productId,
        message,
        goal_type: selectedGoal,
        conversation_history: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.data.message,
        insights: response.data.related_insights || [],
        actions: response.data.suggested_actions || [],
        confidence: response.data.confidence_score || 85,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Copilot error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an issue analyzing your request. Please try again.',
        isError: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoalChange = (newGoal) => {
    setSelectedGoal(newGoal);
    if (onGoalChange) {
      onGoalChange(newGoal);
    }
  };

  return (
    <div className="copilot-container">
      {/* Header */}
      <div className="copilot-header">
        <div className="copilot-title">
          <Sparkles size={20} style={{ color: '#3B82F6' }} />
          <div>
            <h2>AI Strategy Copilot</h2>
            <p>Ask me anything about your pricing strategy</p>
          </div>
        </div>

        {/* Goal Selector */}
        <div className="goal-selector-compact">
          <label>Goal:</label>
          <select
            value={selectedGoal}
            onChange={(e) => handleGoalChange(e.target.value)}
            className="goal-select"
          >
            <option value="maximize_profit">Maximize Profit</option>
            <option value="increase_revenue">Increase Revenue</option>
            <option value="maximize_market_share">Maximize Market Share</option>
            <option value="clear_inventory">Clear Inventory</option>
            <option value="beat_competitors">Beat Competitors</option>
            <option value="launch_product">Launch Product</option>
          </select>
        </div>
      </div>

      {/* Messages Container */}
      <div className="copilot-messages">
        {messages.length === 0 && showExamples ? (
          <div className="copilot-empty">
            <Sparkles size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
            <h3>Hi there! 👋</h3>
            <p>I'm your AI pricing strategist. Ask me anything about optimizing your product strategy.</p>

            <div className="example-prompts">
              <p style={{ marginBottom: 16, opacity: 0.7, fontSize: '0.9rem' }}>Try asking:</p>
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  className="example-prompt"
                  onClick={() => handleSendMessage(prompt)}
                >
                  <span>{prompt}</span>
                  <Send size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-bubble" style={{
                  background: msg.isError ? '#EF444408' : msg.role === 'user' ? '#3B82F608' : '#22C55E08',
                  borderColor: msg.isError ? '#EF4444' : msg.role === 'user' ? '#3B82F6' : '#22C55E',
                }}>
                  <div className="message-text">{msg.content}</div>

                  {/* Insights Cards */}
                  {msg.insights && msg.insights.length > 0 && (
                    <div className="message-insights">
                      {msg.insights.map((insight, idx) => (
                        <div
                          key={idx}
                          className="insight-card"
                          style={{
                            borderColor: INSIGHT_TYPE_COLORS[insight.type] || '#3B82F6',
                          }}
                        >
                          <div className="insight-icon" style={{
                            color: INSIGHT_TYPE_COLORS[insight.type] || '#3B82F6',
                          }}>
                            {INSIGHT_TYPE_ICONS[insight.type]}
                          </div>
                          <div className="insight-content">
                            <h4>{insight.title}</h4>
                            <p>{insight.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggested Actions */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="message-actions">
                      <h4>Next Steps</h4>
                      <ul>
                        {msg.actions.map((action, idx) => (
                          <li key={idx}>{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Confidence Score */}
                  {msg.confidence && (
                    <div className="message-confidence">
                      <div className="confidence-bar">
                        <div
                          className="confidence-fill"
                          style={{ width: `${msg.confidence}%` }}
                        />
                      </div>
                      <span>{Math.round(msg.confidence)}% confidence</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="message assistant">
                <div className="message-bubble loading">
                  <Loader size={18} className="spinner" />
                  <span>AI is analyzing your request...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="copilot-input-area">
        <div className="copilot-input-wrapper">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Ask me about your pricing strategy..."
            disabled={isLoading}
            className="copilot-input"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputValue.trim()}
            className="copilot-send-btn"
          >
            {isLoading ? (
              <Loader size={18} className="spinner" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>
          💡 Tip: Be specific about your goal and constraints for better recommendations.
        </p>
      </div>
    </div>
  );
}
