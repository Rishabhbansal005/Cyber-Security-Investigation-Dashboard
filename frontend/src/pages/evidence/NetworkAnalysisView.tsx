import React, { useEffect, useState } from 'react';
import { NetworkAnalysisResult } from '@/types';
import { networkApi } from '@/api/network';

interface Props {
  evidenceId: string;
}

const NetworkAnalysisView: React.FC<Props> = ({ evidenceId }) => {
  const [result, setResult] = useState<NetworkAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchResults = async () => {
    try {
      const data = await networkApi.getResults(evidenceId);
      setResult(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setResult(null); // No analysis record exists yet
      } else {
        setError('Failed to load network analysis results');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    setError(null);
    try {
      await networkApi.analyze(evidenceId);
      await fetchResults();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to trigger network re-analysis');
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(() => {
      if (result?.analysis_status === 'analyzing' || result?.analysis_status === 'pending') {
        fetchResults();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [evidenceId, result?.analysis_status]);

  if (loading) {
    return (
      <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div>Loading network analysis...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 20, color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', margin: '24px 0' }}>
        ⚠️ {error}
      </div>
    );
  }

  if (!result) return null;

  const isCompleted = result.analysis_status === 'completed';
  const isFailed = result.analysis_status === 'failed';
  const isAnalyzing = result.analysis_status === 'analyzing' || result.analysis_status === 'pending';

  return (
    <div className="detail-card" style={{ marginTop: '24px' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Network Analysis Results</h2>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 700,
            backgroundColor: isCompleted ? 'rgba(16, 185, 129, 0.2)' : isFailed ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: isCompleted ? '#10b981' : isFailed ? '#ef4444' : '#f59e0b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {result.analysis_status}
        </span>
      </div>

      <div style={{ padding: '20px' }}>
        {/* FAILED STATE */}
        {isFailed && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ margin: '0 0 6px 0', color: 'var(--danger)', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>⚠️</span> Network Analysis Failed
                </h4>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
                  An error occurred while parsing the network capture file.
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRetry}
                disabled={retrying}
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
              >
                {retrying ? 'Retrying...' : '🔄 Retry Network Analysis'}
              </button>
            </div>
            {result.error_message && (
              <pre style={{ marginTop: 16, background: '#0a0e1a', padding: 12, borderRadius: 6, fontSize: 12, color: '#fca5a5', overflowX: 'auto', whiteSpace: 'pre-wrap', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                {result.error_message}
              </pre>
            )}
          </div>
        )}

        {/* ANALYZING / PENDING STATE */}
        {isAnalyzing && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid var(--border-color)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              Network Analysis in Progress
            </div>
            <div style={{ fontSize: 13 }}>Extracting IP conversations, DNS queries, and protocol statistics...</div>
          </div>
        )}

        {/* COMPLETED STATE */}
        {isCompleted && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            
            {/* Protocol Stats */}
            <div className="detail-card">
              <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Protocol Distribution</h3>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.keys(result.protocol_stats || {}).length > 0 ? (
                  Object.entries(result.protocol_stats).map(([proto, count]) => (
                    <div key={proto} style={{ padding: '4px 8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '12px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--teal)' }}>{proto}:</span> {count as number} pkts
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No protocol stats extracted</div>
                )}
              </div>
            </div>

            {/* Suspicious Indicators */}
            <div className="detail-card" style={{ border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#fca5a5' }}>Suspicious Indicators Detected</h3>
              </div>
              <div style={{ padding: '16px', maxHeight: '250px', overflowY: 'auto' }}>
                {result.suspicious_indicators && result.suspicious_indicators.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {result.suspicious_indicators.map((ind, i) => (
                      <li key={i} style={{ paddingLeft: '12px', borderLeft: '3px solid #ef4444' }}>
                        <div style={{ fontWeight: 'bold', color: '#fca5a5', fontSize: '14px' }}>{ind.value}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>{ind.reason}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>No highly suspicious indicators automatically detected.</p>
                )}
              </div>
            </div>

            {/* Top Talkers */}
            <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Top IP Conversations (Top Talkers)</h3>
              </div>
              <div style={{ overflowX: 'auto' }}>
                {result.conversations && result.conversations.length > 0 ? (
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Source IP</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Destination IP</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Packets</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Bytes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.conversations.slice(0, 20).map((conv, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{conv.ip_a}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{conv.ip_b}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{conv.packets}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{(conv.bytes / 1024).toFixed(2)} KB</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No IP conversations extracted</div>
                )}
              </div>
            </div>

            {/* DNS Queries */}
            <div className="detail-card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>Extracted DNS Queries</h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto' }}>
                {result.dns_queries && result.dns_queries.length > 0 ? (
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Query Name</th>
                        <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.dns_queries.slice(0, 50).map((dns, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--teal)' }}>{dns.query}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{dns.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>No DNS queries extracted</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkAnalysisView;
