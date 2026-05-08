import { Zap, Play, Pause, Plus } from 'lucide-react';
import { useState } from 'react';

const INITIAL = [
  { id: 1, name: 'Auto-reprice on competitor drop', trigger: 'Competitor price drops >5%', action: 'Match price within 2%', active: true, runs: 142 },
  { id: 2, name: 'Low-stock reorder alert', trigger: 'Stock < 15 days cover', action: 'Email + Slack ops team', active: true, runs: 38 },
  { id: 3, name: 'Weekend demand surge pricing', trigger: 'Demand forecast > +20% Fri 6pm', action: 'Raise prices on premium +3%', active: false, runs: 12 },
  { id: 4, name: 'Deadstock clearance', trigger: 'SKU age > 90 days, stock > 30d cover', action: 'Apply 20% markdown', active: true, runs: 9 },
];

export default function Automations() {
  const [rules, setRules] = useState(INITIAL);
  const toggle = (id) => setRules((rs) => rs.map((r) => r.id === id ? { ...r, active: !r.active } : r));

  return (
    <div className="auto-page">
      <div className="auto-header">
        <div>
          <div className="auto-header__eyebrow">Automations</div>
          <h1 className="auto-header__title">Autonomous Rules Engine</h1>
          <p className="auto-header__sub">
            Define triggers and actions. The AI executes when conditions are met - with audit trail and human approval where needed.
          </p>
        </div>
        <button type="button" className="auto-new-btn">
          <Plus size={16} /> New Rule
        </button>
      </div>

      <div className="auto-rules">
        {rules.map((r) => (
          <div key={r.id} className={`auto-rule ${r.active ? 'auto-rule--on' : ''}`}>
            <div className="auto-rule__icon"><Zap size={18} /></div>
            <div className="auto-rule__body">
              <div className="auto-rule__name">{r.name}</div>
              <div className="auto-rule__flow">
                <span className="auto-rule__when">When</span>
                <span className="auto-rule__trigger">{r.trigger}</span>
                <span className="auto-rule__then">then</span>
                <span className="auto-rule__action">{r.action}</span>
              </div>
              <div className="auto-rule__meta">{r.runs} runs this month</div>
            </div>
            <button
              type="button"
              className={`auto-rule__toggle ${r.active ? 'auto-rule__toggle--on' : ''}`}
              onClick={() => toggle(r.id)}
              aria-label={r.active ? 'Pause rule' : 'Activate rule'}
            >
              {r.active ? <Pause size={14} /> : <Play size={14} />}
              {r.active ? 'Active' : 'Paused'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
