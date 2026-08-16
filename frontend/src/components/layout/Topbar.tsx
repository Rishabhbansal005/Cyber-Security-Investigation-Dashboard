import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/cases':     'Cases',
  '/evidence':  'Evidence',
  '/findings':  'Findings',
  '/timeline':  'Timeline',
  '/risk':      'Risk Assessment',
  '/reports':   'Reports',
};

interface TopbarProps {
  sidebarCollapsed?: boolean;
  onMenuToggle?: () => void;
}

const now = new Date();
const timeStr = now.toLocaleTimeString('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export default function Topbar({ sidebarCollapsed, onMenuToggle }: TopbarProps) {
  const { pathname } = useLocation();
  const { user } = useAuth();

  const pathParts = pathname.split('/').filter(Boolean);

  return (
    <header className="topbar">
      <button
        type="button"
        className={`topbar-icon-btn${sidebarCollapsed ? '' : ' d-md-none'}`}
        onClick={onMenuToggle}
        title={sidebarCollapsed ? 'Open sidebar' : 'Toggle menu'}
        aria-label={sidebarCollapsed ? 'Open sidebar' : 'Toggle menu'}
        style={{ border: 'none' }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
          <path d="M2 4h12M2 8h12M2 12h12" strokeLinecap="round" />
        </svg>
      </button>

      {/* Breadcrumbs */}
      <div className="topbar-breadcrumb">
        {pathParts.map((part, idx) => {
          const path = '/' + pathParts.slice(0, idx + 1).join('/');
          const isLast = idx === pathParts.length - 1;
          const label =
            ROUTE_LABELS[path] ||
            (part.length === 36
              ? part.substring(0, 8) + '…'
              : part.charAt(0).toUpperCase() + part.slice(1));

          return (
            <React.Fragment key={path}>
              {idx > 0 && (
                <span className="topbar-breadcrumb-sep">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10" style={{ opacity: 0.4 }}>
                    <path d="M6 3l4 5-4 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              {isLast ? (
                <span className="topbar-breadcrumb-item active">{label}</span>
              ) : (
                <Link to={path} className="topbar-breadcrumb-item" style={{ textDecoration: 'none' }}>
                  {label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right — minimal, meaningful items only */}
      <div className="topbar-actions">
        {/* System online indicator */}
        <div className="status-pill online">
          <span className="status-pill-dot" />
          Systems Online
        </div>

        {/* Role tag */}
        {user && (
          <span className="role-tag">
            {user.role}
          </span>
        )}
      </div>
    </header>
  );
}
