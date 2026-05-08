import { User, Key, Bell, Shield, Database } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SECTIONS = [
  { id: 'profile', icon: User, title: 'Profile', desc: 'Your account details and preferences' },
  { id: 'api', icon: Key, title: 'API Keys', desc: 'Manage integrations with marketplaces and ad platforms' },
  { id: 'notifications', icon: Bell, title: 'Notifications', desc: 'Email, Slack, and in-app alert preferences' },
  { id: 'security', icon: Shield, title: 'Security', desc: 'Two-factor auth, session management, audit log' },
  { id: 'data', icon: Database, title: 'Data & Compliance', desc: 'Retention policies, GDPR exports, data deletion' },
];

export default function Settings() {
  const { user } = useAuth();
  const email = user?.email || 'demo@vougestudio.com';

  return (
    <div className="set-page">
      <div className="set-header">
        <div className="set-header__eyebrow">Settings</div>
        <h1 className="set-header__title">Workspace Configuration</h1>
        <p className="set-header__sub">Manage your account, integrations, notifications, and compliance.</p>
      </div>

      <div className="set-profile">
        <div className="set-profile__avatar">{email.slice(0, 2).toUpperCase()}</div>
        <div className="set-profile__body">
          <div className="set-profile__name">Vouge Studio</div>
          <div className="set-profile__email">{email}</div>
          <div className="set-profile__plan">Pro Plan - Unlimited SKUs</div>
        </div>
      </div>

      <div className="set-grid">
        {SECTIONS.map(({ id, icon: Icon, title, desc }) => (
          <button key={id} type="button" className="set-card">
            <span className="set-card__icon"><Icon size={18} /></span>
            <div className="set-card__body">
              <div className="set-card__title">{title}</div>
              <div className="set-card__desc">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
