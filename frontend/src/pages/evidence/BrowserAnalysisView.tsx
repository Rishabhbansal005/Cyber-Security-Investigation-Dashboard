import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import browserApi from '@/api/browser';
import { format } from 'date-fns';

interface BrowserAnalysisViewProps {
  evidenceId: string;
}

export default function BrowserAnalysisView({ evidenceId }: BrowserAnalysisViewProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'downloads' | 'search' | 'suspicious'>('history');
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['browser-analysis', evidenceId],
    queryFn: () => browserApi.getAnalysis(evidenceId),
    refetchInterval: (query) => query.state.data?.analysis_status === 'analyzing' ? 2000 : false,
    retry: false
  });

  if (isLoading) {
    return <div className="text-center p-4">Loading browser analysis...</div>;
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🌍</div>
        <div className="empty-state-title">No Browser Analysis Found</div>
        <div className="empty-state-text">Start analysis to extract browser artifacts.</div>
      </div>
    );
  }

  if (data.analysis_status === 'failed') {
    return (
      <div className="card mt-4" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <div className="card-body">
          <h6 style={{ color: 'var(--danger)', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>
            ⚠️ Browser Forensics Failed
          </h6>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            An error occurred while parsing browser history or database artifacts.
          </p>
          {data.error_message && (
            <pre style={{ marginTop: 16, background: '#0f172a', padding: 12, borderRadius: 6, fontSize: 12, color: '#fca5a5', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {data.error_message}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (data.analysis_status === 'analyzing') {
    return (
      <div className="empty-state">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div className="empty-state-title">Analysis in Progress</div>
        <div className="empty-state-text">Extracting history, downloads, and URLs...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-1">Browser Forensics ({data.browser_type})</h5>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Status: <span style={{ color: 'var(--success)', textTransform: 'capitalize' }}>{data.analysis_status}</span>
          </div>
        </div>
        <div className="d-flex gap-3">
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>{data.analysis_summary?.total_history_entries || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>History</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>{data.analysis_summary?.suspicious_urls_count || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Suspicious</div>
          </div>
        </div>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
            History
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'downloads' ? 'active' : ''}`} onClick={() => setActiveTab('downloads')}>
            Downloads
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>
            Search Terms
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${activeTab === 'suspicious' ? 'active' : ''}`} onClick={() => setActiveTab('suspicious')}>
            Suspicious URLs
          </button>
        </li>
      </ul>

      {activeTab === 'history' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Visit Time</th>
                <th>Title</th>
                <th>URL</th>
                <th>Visits</th>
              </tr>
            </thead>
            <tbody>
              {data.history_entries.map((h, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{format(new Date(h.visit_time), 'MMM d, yyyy HH:mm:ss')}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                    <a href={h.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>{h.url}</a>
                  </td>
                  <td>{h.visit_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'downloads' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Path</th>
                <th>Size (Bytes)</th>
              </tr>
            </thead>
            <tbody>
              {data.downloads.map((d, i) => (
                <tr key={i}>
                  <td className="font-mono" style={{ fontSize: 13 }}>{d.path}</td>
                  <td>{d.total_bytes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Engine</th>
                <th>Search Term</th>
              </tr>
            </thead>
            <tbody>
              {data.search_terms.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 13 }}>{format(new Date(s.time), 'MMM d, yyyy HH:mm:ss')}</td>
                  <td><span className="badge bg-secondary">{s.engine}</span></td>
                  <td style={{ fontWeight: 600 }}>{s.term}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'suspicious' && (
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>URL</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.suspicious_urls.map((s, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge bg-${s.severity === 'critical' ? 'danger' : 'warning text-dark'}`}>
                      {s.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: 13, color: 'var(--danger)' }}>{s.url}</td>
                  <td>{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
