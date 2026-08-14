import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from 'react-i18next';

interface NavItem {
  path: string;
  label: string;
  section?: string;
  badge?: number;
  icon: React.ReactNode;
}

// Clean SVG icons — no emojis
const Icons = {
  dashboard: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  ),
  cases: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M2 4h12v10H2z" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M5 8h6M5 11h4" />
    </svg>
  ),
  evidence: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
      <path d="M7 5v2M7 9h.01" strokeLinecap="round" />
    </svg>
  ),
  findings: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M8 2L2 14h12L8 2z" strokeLinejoin="round" />
      <path d="M8 7v3M8 11.5h.01" strokeLinecap="round" />
    </svg>
  ),
  risk: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M8 1.5L2 14.5h12L8 1.5z" strokeLinejoin="round" />
      <path d="M8 6v4" strokeLinecap="round" />
      <circle cx="8" cy="12" r=".5" fill="currentColor" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M3 1h7l3 3v11H3V1z" />
      <path d="M10 1v3h3" />
      <path d="M5.5 8h5M5.5 11h3" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 16 16" fill="currentColor" width="18" height="18">
      <path d="M8 1L2 3.5V8c0 3.5 2.5 6 6 7.5C14 14 16 11.5 16 8V3.5L8 1zM8 2.2l5.5 2v3.8c0 2.8-2 5-5.5 6.3C5 13 3 10.8 3 8V4.2L8 2.2z" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
      <path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
      <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
      <path d="M6 2H2v12h4M10 5l4 3-4 3M14 8H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  threat: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" strokeDasharray="1 1" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" strokeLinecap="round" />
    </svg>
  ),
};

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard',  icon: Icons.dashboard, label: 'Dashboard',       section: 'OVERVIEW' },
  { path: '/cases',      icon: Icons.cases,     label: 'Cases',            section: 'INVESTIGATION' },
  { path: '/evidence',   icon: Icons.evidence,  label: 'Evidence',         section: 'INVESTIGATION' },
  { path: '/findings',   icon: Icons.findings,  label: 'Findings',         section: 'INVESTIGATION' },
  { path: '/complaint-ai', icon: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M3 2h7l3 3v9H3V2z" />
      <path d="M10 2v3h3M5 8h6M5 11h4" strokeLinecap="round" />
    </svg>
  ), label: 'Complaint intelligence', section: 'ANALYSIS' },
  { path: '/osint',      icon: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <circle cx="8" cy="8" r="6" />
      <path d="M2 8h12M8 2a9 9 0 013 6 9 9 0 01-3 6 9 9 0 01-3-6 9 9 0 013-6" />
    </svg>
  ), label: 'OSINT', section: 'ANALYSIS' },
  { path: '/threat-intelligence', icon: Icons.threat, label: 'Live Threat Intel', section: 'ANALYSIS' },
  { path: '/risk',       icon: Icons.risk,      label: 'Risk Assessment',  section: 'ANALYSIS' },
  { path: '/reports',    icon: Icons.reports,   label: 'Reports',          section: 'OUTPUT' },
  { path: '/audit',      icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ), label: 'Audit Logs', section: 'SYSTEM' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onContactOpen: () => void;
}

export default function Sidebar({ collapsed, onToggle, onContactOpen }: SidebarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'hi' : 'en';
    i18n.changeLanguage(newLang);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      return parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0].substring(0, 2).toUpperCase();
    }
    return email?.substring(0, 2).toUpperCase() ?? 'U?';
  };

  const groupedItems = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    const key = item.section ?? 'OTHER';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Branding */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">{Icons.shield}</div>
        {!collapsed && (
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">CCID</span>
            <span className="sidebar-logo-subtitle">Investigation Platform</span>
          </div>
        )}
        <button
          onClick={onToggle}
          style={{
            marginLeft: collapsed ? 'auto' : 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.15s',
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          {collapsed ? Icons.chevronRight : Icons.chevronLeft}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {Object.entries(groupedItems).map(([section, items]) => (
          <div key={section}>
            {!collapsed && (
              <div className="sidebar-section-label">{section}</div>
            )}
            {items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item${isActive ? ' active' : ''}`
                }
                title={collapsed ? t(`nav.${item.label.toLowerCase().replace(' ', '_')}`, item.label) : undefined}
              >
                <span className="nav-icon-wrap">{item.icon}</span>
                {!collapsed && <span className="nav-label">{t(`nav.${item.label.toLowerCase().replace(' ', '_')}`, item.label)}</span>}
                {!collapsed && item.badge && item.badge > 0 && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Language Toggle */}
      <div style={{ padding: collapsed ? '4px 8px' : '4px 12px', marginBottom: '4px' }}>
        <button
          onClick={toggleLanguage}
          title={collapsed ? 'Change Language' : undefined}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '8px' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'none',
            border: '1px solid var(--border-subtle, #2a2d3e)',
            borderRadius: 'var(--radius-sm, 6px)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.4)';
            (e.currentTarget as HTMLElement).style.color = '#34d399';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'none';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle, #2a2d3e)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          <div style={{
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 4px',
            border: '1px solid currentColor',
            borderRadius: '4px',
            lineHeight: 1
          }}>
            {i18n.language === 'hi' ? 'HI' : 'EN'}
          </div>
          {!collapsed && <span>{i18n.language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}</span>}
        </button>
      </div>

      {/* Contact / Support */}
      <div style={{ padding: collapsed ? '4px 8px' : '4px 12px', marginBottom: '4px' }}>
        <button
          onClick={onContactOpen}
          title={collapsed ? 'Contact & Support' : undefined}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: collapsed ? '8px' : '8px 12px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            background: 'none',
            border: '1px solid var(--border-subtle, #2a2d3e)',
            borderRadius: 'var(--radius-sm, 6px)',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.1)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.4)';
            (e.currentTarget as HTMLElement).style.color = '#818cf8';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'none';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle, #2a2d3e)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15" style={{ flexShrink: 0 }}>
            <path d="M2 6l6 4 6-4" strokeLinecap="round" />
            <rect x="1" y="3.5" width="14" height="9" rx="2" />
          </svg>
          {!collapsed && <span>Contact &amp; Support</span>}
        </button>
      </div>

      {/* User Footer */}
      <div className="sidebar-footer">
        {!collapsed ? (
          <div
            className="sidebar-user"
            onClick={handleSignOut}
            title="Sign out"
          >
            <div className="sidebar-avatar">
              {getInitials(user?.full_name, user?.email)}
            </div>
            <div className="sidebar-user-info" style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user?.full_name || user?.email}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>
                {user?.role}
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
              {Icons.logout}
            </span>
          </div>
        ) : (
          <div
            className="sidebar-avatar"
            onClick={handleSignOut}
            style={{ margin: '4px auto', cursor: 'pointer' }}
            title={`${user?.full_name || user?.email} — Sign out`}
          >
            {getInitials(user?.full_name, user?.email)}
          </div>
        )}
      </div>
    </aside>
  );
}
