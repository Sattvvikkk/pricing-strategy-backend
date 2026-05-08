import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingUp, PackageX, Brain, Zap } from 'lucide-react';

const INSIGHTS = [
  { id: 1, type: 'risk', icon: AlertTriangle, text: '5 of 10 top competitors cut prices in the last 6 hours.', time: '2m ago' },
  { id: 2, type: 'trend', icon: TrendingUp, text: 'Weekend demand surge predicted for Sneakers (+28%).', time: '14m ago' },
  { id: 3, type: 'warn', icon: PackageX, text: 'Overstock risk on 12 SKUs (aged inventory > 90d).', time: '27m ago' },
  { id: 4, type: 'ai', icon: Brain, text: 'AI suggests bundling Sports Gear with 10% discount.', time: '41m ago' },
  { id: 5, type: 'action', icon: Zap, text: 'Auto-reprice rule fired on 8 SKUs (competitor match).', time: '1h ago' },
  { id: 6, type: 'trend', icon: TrendingUp, text: 'Your premium segment revenue up 18% W/W.', time: '2h ago' },
];

export default function LiveInsightsFeed() {
  const [items, setItems] = useState(INSIGHTS);

  useEffect(() => {
    const iv = setInterval(() => {
      setItems((prev) => {
        const [first, ...rest] = prev;
        return [...rest, first];
      });
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="lif">
      <div className="lif__head">
        <div className="lif__head-left">
          <span className="lif__pulse" aria-hidden="true" />
          <span className="lif__title">Live Intelligence Feed</span>
        </div>
        <span className="lif__count">{items.length} signals</span>
      </div>
      <div className="lif__list">
        {items.slice(0, 5).map((i) => {
          const Icon = i.icon;
          return (
            <div key={i.id} className={`lif__item lif__item--${i.type}`}>
              <span className="lif__icon"><Icon size={14} /></span>
              <span className="lif__text">{i.text}</span>
              <span className="lif__time">{i.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
