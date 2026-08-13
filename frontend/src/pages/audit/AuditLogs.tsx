import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import auditApi from '@/api/audit';

const ActionBadge = ({ action }: { action: string }) => {
  let color = '#475569';
  let bg = 'rgba(255,255,255,0.05)';

  if (action.includes('FREEZE') || action.includes('EXPORT') || action.includes('ARREST') || action.includes('ISSUE')) {
    color = '#f43f5e';
    bg = 'rgba(244,63,94,0.1)';
  } else if (action.includes('UPLOAD') || action.includes('CREATE')) {
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
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['officer-audit-logs'],
    queryFn: () => auditApi.list(),
    refetchInterval: 15000,
  });

  const filteredLogs = logs.filter((log) => {
    const hay = `${log.action} ${log.officer_email || ''} ${log.target || ''}`.toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title" style={{ color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 10 }}>
            Security & Audit Logs
          </h1>
          <p className="page-header-subtitle">
            Officer actions recorded from this system (FIR create, evidence upload, arrest status).
          </p>
        </div>
      </div>

      <div className="card">
        <div className="filter-bar">
          <div className="search-wrapper" style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
            <svg className="search-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by Action, Officer, or Target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-control"
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>Timestamp</th>
                <th>Officer</th>
                <th>Action Type</th>
                <th>Target Resource</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', color: '#94a3b8' }}>{log.id.slice(0, 8)}</td>
                  <td>{log.created_at ? format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss') : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{log.officer_email || log.officer_id || '—'}</td>
                  <td><ActionBadge action={log.action} /></td>
                  <td style={{ color: '#cbd5e1' }}>{log.target || '—'}</td>
                  <td><StatusBadge status={log.status} /></td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    No officer actions logged yet. Creating a FIR or uploading evidence will appear here.
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
