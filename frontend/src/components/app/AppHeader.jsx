import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TITLES = {
  '/app':                  'Dashboard',
  '/app/analytics':        'Analytics',
  '/app/strategy':         'Strategy Builder',
  '/app/scraper':          'Competitor Scraper',
  '/app/marketplace':      'Marketplace Insights',
  '/app/intelligence':     'Intelligence Hub',
  '/app/ml':               'ML Engine',
  '/app/competitor-reaction': 'Competitor Reaction',
  '/app/inventory':           'Inventory Optimization',
  '/app/segments':           'Customer Segmentation',
  '/app/ai-copilot':         'AI Copilot',
  '/app/simulator':          'Scenario Simulator',
  '/app/pipeline':           'Intelligence Pipeline',
  '/app/automations':        'Automations',
  '/app/settings':           'Settings',
};

function resolveTitle(pathname) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith('/app/products/')) return 'Product Details';
  return 'Dashboard';
}

export default function AppHeader() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const title = resolveTitle(pathname);
  const plan = user?.plan || 'Pro';
  const planLabel = `${plan} Plan`;

  return (
    <header className="pe-app-header">
      <h1 className="pe-app-header__title">{title}</h1>

      <div className="pe-app-header__right">
        <span className="badge-accent pe-app-header__plan">{planLabel}</span>

        <button
          type="button"
          className="pe-app-header__bell"
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
      </div>
    </header>
  );
}
