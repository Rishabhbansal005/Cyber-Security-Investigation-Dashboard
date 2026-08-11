import React from 'react';
import { useQuery } from '@tanstack/react-query';
import cdrApi from '@/api/cdr';

interface CdrAnalysisViewProps {
  evidenceId: string;
}

export default function CdrAnalysisView({ evidenceId }: CdrAnalysisViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cdr-analysis', evidenceId],
    queryFn: () => cdrApi.analyze(evidenceId),
    retry: false
  });

  if (isLoading) {
    return <div className="text-center p-4">Loading CDR analysis...</div>;
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📱</div>
        <div className="empty-state-title">No CDR Analysis Found</div>
        <div className="empty-state-text">Start analysis to extract call records and tower locations.</div>
      </div>
    );
  }

  if (data.status === 'error' || data.status === 'partial') {
    return (
      <div className="card mt-4" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
        <div className="card-body">
          <h6 style={{ color: 'var(--warning)', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>
            ⚠️ CDR Analysis Issue
          </h6>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {data.error || 'Could not fully parse the CDR file. Check if it matches standard formats.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-1">Mobile Forensics (CDR Analytics)</h5>
        </div>
        <div className="d-flex gap-3">
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>
              {data.total_records || 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Records</div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">📞 Frequent Callers (Top 10)</span>
            </div>
            <div className="card-body p-0">
              {data.frequent_called_numbers && data.frequent_called_numbers.length > 0 ? (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead style={{ background: 'var(--bg-input)' }}>
                      <tr>
                        <th>Called Number</th>
                        <th>Call Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.frequent_called_numbers.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.number}</td>
                          <td style={{ fontSize: 13 }}>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No frequent caller data available.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">📡 Top Cell Towers</span>
            </div>
            <div className="card-body p-0">
              {data.tower_locations && data.tower_locations.length > 0 ? (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead style={{ background: 'var(--bg-input)' }}>
                      <tr>
                        <th>Location / Tower ID</th>
                        <th>Hits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tower_locations.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.location}</td>
                          <td style={{ fontSize: 13 }}>{item.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No tower location data available in this CDR.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
