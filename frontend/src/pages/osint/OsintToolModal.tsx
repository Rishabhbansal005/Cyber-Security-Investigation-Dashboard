import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { osintApi, CveResult, DomainReputationResult } from '@/api/osint';

export type ToolType = 'cve' | 'domain' | 'ipgeo' | 'nmap' | 'whois' | 'shodan' | 'socmint' | null;

interface OsintToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  toolType: ToolType;
}

export default function OsintToolModal({ isOpen, onClose, toolType }: OsintToolModalProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);



  if (!isOpen || !toolType) return null;

  const toolConfig = {
    cve: {
      title: 'Vulnerability Scanner (CVE)',
      placeholder: 'Enter CVE ID (e.g. CVE-2021-44228)',
      action: 'Scan',
      apiCall: osintApi.lookupCve,
    },
    domain: {
      title: 'Domain Reputation',
      placeholder: 'Enter domain (google.com) or public IP (1.1.1.1 — not 127.0.0.1)',
      action: 'Check',
      apiCall: osintApi.checkDomain,
    },
    ipgeo: {
      title: 'IP Geolocation',
      placeholder: 'Enter IPv4 or IPv6 address',
      action: 'Locate',
      apiCall: osintApi.checkIpGeo,
    },
    nmap: {
      title: 'Port Scanner (Nmap)',
      placeholder: 'Enter IP address or Domain to scan',
      action: 'Scan Ports',
      apiCall: osintApi.runNmap,
    },
    whois: {
      title: 'WHOIS Explorer',
      placeholder: 'Enter domain (e.g. example.com)',
      action: 'Lookup',
      apiCall: osintApi.lookupWhois,
    },
    shodan: {
      title: 'Shodan Scanner',
      placeholder: 'Enter IP address to lookup',
      action: 'Scan',
      apiCall: osintApi.lookupShodan,
    },
    socmint: {
      title: 'SOCMINT Search',
      placeholder: 'Enter username (e.g. johndoe)',
      action: 'Search',
      apiCall: osintApi.lookupSocmint,
    },
  }[toolType];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // For SOCMINT, usernames shouldn't have spaces
      const searchQuery = toolType === 'socmint' ? query.replace(/\s+/g, '') : query;
      const res = await toolConfig.apiCall(searchQuery);
      
      if (res.success) {
        setResult(res);
      } else {
        setError(res.error || 'No results found.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during the lookup.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setQuery('');
    setResult(null);
    setError(null);
    onClose();
  };

  const modal = (
    <div
      onClick={resetAndClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        zIndex: 4000,
        padding: '72px 20px 32px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
        background: '#0f172a', border: '1px solid var(--border-subtle)',
        borderRadius: '12px', width: '100%', maxWidth: '600px',
        display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 104px)',
        margin: '0 auto',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
            {toolConfig.title}
          </h2>
          <button onClick={resetAndClose} style={{
            background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer',
            padding: '4px', display: 'flex', alignItems: 'center'
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={toolConfig.placeholder}
              style={{
                flex: 1, padding: '12px 16px', background: 'rgba(30,41,59,0.5)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                color: '#f8fafc', fontSize: '14px', outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !query}
              className="btn btn-primary"
              style={{ padding: '0 24px' }}
            >
              {isLoading ? 'Processing...' : toolConfig.action}
            </button>
          </form>



          {error && (
            <div style={{ padding: '12px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', borderRadius: '8px', border: '1px solid rgba(244,63,94,0.3)', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          {result && (
            <div style={{ background: 'rgba(30,41,59,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', padding: '20px' }}>
              {toolType === 'cve' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '20px', color: '#f8fafc' }}>{result.cve}</h3>
                    {result.cvss && (
                      <span style={{
                        background: result.cvss >= 7 ? 'rgba(244,63,94,0.2)' : 'rgba(251,146,60,0.2)',
                        color: result.cvss >= 7 ? '#f43f5e' : '#fb923c',
                        padding: '4px 10px', borderRadius: '4px', fontWeight: 600, fontSize: '14px'
                      }}>
                        CVSS: {result.cvss}
                      </span>
                    )}
                  </div>
                  <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>{result.summary}</p>
                  {result.references && result.references.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '8px' }}>References:</h4>
                      <ul style={{ margin: 0, paddingLeft: '20px', color: '#6366f1', fontSize: '13px' }}>
                        {result.references.slice(0, 5).map((ref: string, idx: number) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>
                            <a href={ref} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>{ref}</a>
                          </li>
                        ))}
                        {result.references.length > 5 && <li><span style={{ color: '#94a3b8' }}>+ {result.references.length - 5} more</span></li>}
                      </ul>
                    </div>
                  )}
                </div>
              )}



              {toolType === 'domain' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>{result.domain}</h3>
                    {result.reputation && (
                      <span style={{
                        background: result.rep_color === 'red' ? 'rgba(244,63,94,0.2)' : result.rep_color === 'yellow' ? 'rgba(251,146,60,0.2)' : 'rgba(16,185,129,0.2)',
                        color: result.rep_color === 'red' ? '#f43f5e' : result.rep_color === 'yellow' ? '#fb923c' : '#10b981',
                        padding: '4px 10px', borderRadius: '4px', fontWeight: 600, fontSize: '13px',
                        textTransform: 'uppercase'
                      }}>
                        {result.reputation} Reputation
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Threat Pulses (OTX)</div>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#f8fafc' }}>{result.pulse_count || 0}</div>
                    </div>
                    {result.country && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Hosting Country</div>
                        <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.country}</div>
                      </div>
                    )}
                    {result.alexa_rank && (
                      <div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Alexa Rank</div>
                        <div style={{ fontSize: '16px', color: '#e2e8f0' }}>#{result.alexa_rank}</div>
                      </div>
                    )}
                  </div>
                  {result.validation && result.validation.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Validation Flags:</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {result.validation.map((v: string) => (
                          <span key={v} style={{ padding: '2px 8px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', borderRadius: '4px', fontSize: '12px' }}>
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.recent_pulses && result.recent_pulses.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Recent Pulses:</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {result.recent_pulses.slice(0, 3).map((p: any, idx: number) => (
                          <div key={idx} style={{ fontSize: '13px', color: '#cbd5e1', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
                            {p.name} <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>({p.modified.split('T')[0]})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}



              {toolType === 'ipgeo' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#f8fafc' }}>{result.ip}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Country</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.country || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>City</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.city || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>ISP</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.isp || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Organization</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.org || 'N/A'}</div>
                    </div>
                  </div>
                  {result.lat && result.lon && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Coordinates</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0', fontFamily: 'monospace' }}>
                        {result.lat}, {result.lon}
                      </div>
                    </div>
                  )}
                </div>
              )}



              {toolType === 'nmap' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>Scan Results for {result.target}</h3>
                    <span style={{
                      background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                      padding: '4px 10px', borderRadius: '4px', fontWeight: 600, fontSize: '13px'
                    }}>
                      {result.open_ports?.length || 0} Open Ports
                    </span>
                  </div>

                  {result.open_ports && result.open_ports.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', color: '#cbd5e1' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                          <th style={{ padding: '8px' }}>PORT</th>
                          <th style={{ padding: '8px' }}>STATE</th>
                          <th style={{ padding: '8px' }}>SERVICE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.open_ports.map((p: any) => (
                          <tr key={p.port} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px', color: '#f8fafc', fontWeight: 500 }}>{p.port}/tcp</td>
                            <td style={{ padding: '8px', color: '#34d399' }}>{p.state}</td>
                            <td style={{ padding: '8px' }}>{p.service}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                      No open ports found out of {result.total_scanned} scanned.
                    </div>
                  )}
                </div>
              )}



              {toolType === 'whois' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#f8fafc' }}>{result.domain}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Registrar</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.registrar || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Creation Date</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.creation_date?.split('T')[0] || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Expiration Date</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.expiration_date?.split('T')[0] || 'N/A'}</div>
                    </div>
                  </div>
                  {result.nameservers && result.nameservers.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Name Servers</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {result.nameservers.map((ns: string, idx: number) => (
                          <div key={idx} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '14px', color: '#cbd5e1' }}>
                            {ns}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {toolType === 'shodan' && (
                <div>
                  <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#f8fafc' }}>Shodan Results for {result.ip}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>Organization</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.org || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>ISP</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.isp || 'N/A'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>OS</div>
                      <div style={{ fontSize: '16px', color: '#e2e8f0' }}>{result.os || 'N/A'}</div>
                    </div>
                  </div>
                  {result.hostnames && result.hostnames.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Hostnames</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {result.hostnames.map((hn: string, idx: number) => (
                          <span key={idx} style={{ padding: '4px 10px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: '4px', fontSize: '12px' }}>
                            {hn}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.ports && result.ports.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Open Ports</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {result.ports.map((port: number, idx: number) => (
                          <span key={idx} style={{ padding: '4px 10px', background: 'rgba(16,185,129,0.1)', color: '#10b981', borderRadius: '4px', fontSize: '13px', fontWeight: 600 }}>
                            {port}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.vulns && result.vulns.length > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>Vulnerabilities</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {result.vulns.map((vuln: string, idx: number) => (
                          <span key={idx} style={{ padding: '4px 10px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>
                            {vuln}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {toolType === 'socmint' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>SOCMINT Results for "{result.username}"</h3>
                    <span style={{
                      background: 'rgba(99,102,241,0.2)', color: '#818cf8',
                      padding: '4px 10px', borderRadius: '4px', fontWeight: 600, fontSize: '13px'
                    }}>
                      Found on {result.found_count} / {result.total_platforms_checked} Platforms
                    </span>
                  </div>

                  {result.results && result.results.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {result.results.map((r: any, idx: number) => (
                        <div key={idx} style={{ 
                          padding: '12px', 
                          background: 'rgba(255,255,255,0.02)', 
                          border: `1px solid ${r.exists ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255,255,255,0.05)'}`,
                          borderRadius: '8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>{r.platform}</div>
                            {r.exists ? (
                              <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#38bdf8', textDecoration: 'none' }}>{r.url}</a>
                            ) : (
                              <div style={{ fontSize: '13px', color: '#64748b' }}>Not found</div>
                            )}
                          </div>
                          <div>
                            {r.exists ? (
                              <span style={{ padding: '4px 8px', background: 'rgba(52,211,153,0.1)', color: '#34d399', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Active</span>
                            ) : (
                              <span style={{ padding: '4px 8px', background: 'rgba(148,163,184,0.1)', color: '#94a3b8', borderRadius: '4px', fontSize: '12px' }}>Available</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>
                      No social media platforms checked.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
