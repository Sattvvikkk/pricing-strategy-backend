import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, BrainCircuit, Target, Gauge, Bot, Settings,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../BrandLogo';

// Modules-only sidebar (no products listed here — Overview is the product universe)
const NAV_ITEMS = [
  { to: '/app',                 label: 'Overview',               Icon: LayoutDashboard, end: true },
  { to: '/app/intelligence',    label: 'Intelligence',           Icon: BrainCircuit },
  { to: '/app/strategy',        label: 'Strategy Builder',       Icon: Target },
  { to: '/app/pricing-engine',  label: 'Dynamic Pricing Engine', Icon: Gauge },
  { to: '/app/ai-copilot',      label: 'AI Copilot',             Icon: Bot },
  { to: '/app/settings',        label: 'Settings',               Icon: Settings },
];

function getInitials(email = '') {
  if (!email) return 'U';
  const name = email.split('@')[0] || '';
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name.slice(0, 2) || 'U').toUpperCase();
}

export default function AppSidebar() {
  const { user } = useAuth();
  const email = user?.email || 'demo@vougestudio.com';
  const initials = getInitials(email);

  return (
    <aside className="pe-sidebar">
      {/* Top — logo */}
      <div className="pe-sidebar__top">
        <div className="pe-sidebar__brand">
          <BrandLogo size={26} className="pe-sidebar__logo" />
          <span className="pe-sidebar__brand-text">NextGen BI</span>
        </div>
        <div className="pe-sidebar__sublabel">Vouge Studio · Pro</div>
      </div>

      {/* Modules */}
      <div className="pe-sidebar__section">
        <div className="pe-sidebar__label">Modules</div>
        <nav className="pe-sidebar__nav">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `pe-nav-item ${isActive ? 'pe-nav-item--active' : ''}`
              }
            >
              <Icon size={18} strokeWidth={1.75} className="pe-nav-item__icon" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Spacer pushes user block to bottom */}
      <div className="pe-sidebar__spacer" />

      {/* Bottom — user */}
      <div className="pe-sidebar__bottom">
        <div className="pe-sidebar__user">
          <div className="pe-sidebar__avatar" aria-hidden="true">{initials}</div>
          <div className="pe-sidebar__email" title={email}>{email}</div>
        </div>
      </div>
    </aside>
  );
}
