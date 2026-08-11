import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

const MOCK_AUDIT_LOGS = [
  { id: 'AL-9921', action: 'FREEZE_ACCOUNT', target: 'HDFC A/C: 50100234492', officerId: 'OFF-104', status: 'authorized', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: 'AL-9920', action: 'GEO_TRACE_IP', target: 'IP: 103.45.12.89', officerId: 'OFF-211', status: 'authorized', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  { id: 'AL-9919', action: 'EXPORT_EVIDENCE', target: 'Case FIR-DL-2026-102', officerId: 'OFF-104', status: 'pending_review', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: 'AL-9918', action: 'ISSUE_NOTICE_91', target: 'Binance Exchange', officerId: 'OFF-089', status: 'authorized', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: 'AL-9917', action: 'AI_COPILOT_QUERY', target: 'Suspect Profiling', officerId: 'OFF-104', status: 'logged', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
];

const ActionBadge = ({ action }: { action: string }) => {
  let color = '#475569';
  let bg = 'rgba(255,255,255,0.05)';
  
  if (action.includes('FREEZE') || action.includes('EXPORT') || action.includes('ISSUE')) {
    color = '#f43f5e';
    bg = 'rgba(244,63,94,0.1)';
  } else if (action.includes('GEO') || action.includes('TRACE')) {
    color = '#f59e0b';
    bg = 'rgba(245,158,11,0.1)';
  } else if (action.includes('AI')) {
    color = '#3b82f6';
    bg = 'rgba(59,130,246,0.1)';
  }

  return (
    <span style={{ 
      color, backgroundColor: bg, 
      padding: '4px 8px', borderRadius: 6, 
      fontSize: 12, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace'
    }}>
      {action}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { label: string, color: string, bg: string }> = {
    authorized: { label: 'Authorized', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    pending_review: { label: 'Pending Review', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    logged: { label: 'Logged', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  };

  const config = map[status] || { label: status, color: '#fff', bg: '#333' };

  return (
    <span style={{ 
      color: config.color, backgroundColor: config.bg, 
      padding: '4px 8px', borderRadius: 4, 
      fontSize: 12, fontWeight: 600 
    }}>
      {config.label}
    </span>
  );
};

export default function AuditLogs() {
  const [search, setSearch] = useState('');

  const filteredLogs = MOCK_AUDIT_LOGS.filter(log => 
    log.action.toLowerCase().includes(search.toLowerCase()) || 
    log.officerId.toLowerCase().includes(search.toLowerCase()) ||
    log.target.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title" style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 10 }}>
            Security & Audit Logs
          </h1>
          <p className="page-header-subtitle">
            Immutable ledger of high-risk officer actions and system authorizations.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-box" style={{ position: 'relative' }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{ position: 'absolute', left: 12, top: 10, color: '#64748b' }}>
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            <input 
              type="text" 
              placeholder="Search by Action, Officer ID, or Target..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>Officer ID</th>
                <th>Action Type</th>
                <th>Target Resource</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{log.id}</td>
                  <td>{format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}</td>
                  <td style={{ fontWeight: 600 }}>{log.officerId}</td>
                  <td><ActionBadge action={log.action} /></td>
                  <td style={{ color: '#cbd5e1' }}>{log.target}</td>
                  <td><StatusBadge status={log.status} /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    No audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
