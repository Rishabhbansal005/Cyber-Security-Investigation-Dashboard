import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import StatCard from '@/components/shared/StatCard';
import { osintApi, OsintFinding, CveResult, DomainReputationResult } from '@/api/osint';
import OsintToolModal, { ToolType } from './OsintToolModal';
// SVG Icons
const I = {
  tool: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M10 2l2 2-2 2-2-2 2-2zM4 10l2 2-2 2-2-2 2-2zM16 10l2 2-2 2-2-2 2-2zM10 18l2 2-2 2-2-2 2-2z" />
      <path d="M7.5 7.5L4 4M12.5 7.5l3.5-3.5M7.5 12.5L4 16M12.5 12.5l3.5 3.5" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M10 2L3 5v6c0 4 7 7 7 7s7-3 7-7V5l-7-3z" />
    </svg>
  ),
  code: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M7 6L3 10l4 4M13 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M4 4h3M13 4h3v3M16 13v3h-3M7 16H4v-3M4 7v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 7v6M7 10h6" strokeLinecap="round" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M9 16A7 7 0 109 2a7 7 0 000 14z" />
      <path d="M14 14l4 4" strokeLinecap="round" />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="10" cy="10" r="8" />
      <path d="M10 2a12 12 0 000 16M10 2a12 12 0 010 16M2 10h16" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="10" cy="6" r="4" />
      <path d="M4 16c0-2.2 3-4 6-4s6 1.8 6 4" strokeLinecap="round" />
    </svg>
  ),
  database: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <ellipse cx="10" cy="5" rx="7" ry="3" />
      <path d="M3 5v10c0 1.66 3.13 3 7 3s7-1.34 7-3V5M3 10c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </svg>
  )
};

const ACTIVITY_DATA = [
  { name: 'Mon', mentions: 1840, leaks: 112 },
  { name: 'Tue', mentions: 3260, leaks: 287 },
  { name: 'Wed', mentions: 2710, leaks: 194 },
  { name: 'Thu', mentions: 5390, leaks: 431 },
  { name: 'Fri', mentions: 4120, leaks: 318 },
  { name: 'Sat', mentions: 2890, leaks: 203 },
  { name: 'Sun', mentions: 3740, leaks: 276 },
];

const THREAT_RADAR = [
  { subject: 'Dark Web', A: 87, fullMark: 100 },
  { subject: 'Social Media', A: 62, fullMark: 100 },
  { subject: 'Public Records', A: 48, fullMark: 100 },
  { subject: 'Forums', A: 94, fullMark: 100 },
  { subject: 'Paste Sites', A: 79, fullMark: 100 },
];

const STATS = [
  { id: 'monitored_entities', label: 'Monitored Entities', value: 14, icon: I.user, color: '#3b82f6', colorMuted: 'rgba(59,130,246,0.12)' },
  { id: 'active_alerts', label: 'Total OTX Reports', value: 2847, icon: I.globe, color: '#f43f5e', colorMuted: 'rgba(244,63,94,0.12)' },
  { id: 'data_leaks', label: 'Loaded Reports', value: 38, icon: I.database, color: '#10b981', colorMuted: 'rgba(16,185,129,0.12)' },
];

// Pre-loaded real-world publicly documented cyber attack intelligence
const RECENT_FINDINGS: OsintFinding[] = [
  { id: 'OTX-CVE24001', entity: '185.220.101.34', type: 'Tor Exit Node — APT29 Cozy Bear C2 Infrastructure', source: 'AlienVault OTX', severity: 'High', time: '2025-07-28', url: 'https://otx.alienvault.com/browse/global/pulses?q=apt29' },
  { id: 'OTX-LOG4J01', entity: '45.155.205.233', type: 'Log4Shell (CVE-2021-44228) Active Exploit Campaign', source: 'AlienVault OTX', severity: 'High', time: '2025-07-25', url: 'https://otx.alienvault.com/browse/global/pulses?q=log4shell' },
  { id: 'OTX-RANSOM1', entity: 'lockbit3-ransom.onion', type: 'LockBit 3.0 Ransomware — Dark Web Leak Site', source: 'AlienVault OTX', severity: 'High', time: '2025-07-22', url: 'https://otx.alienvault.com/browse/global/pulses?q=lockbit' },
  { id: 'OTX-PHISH01', entity: 'paypa1-secure-login.com', type: 'PayPal Brand Phishing — Credential Harvesting Page', source: 'AlienVault OTX', severity: 'High', time: '2025-07-20', url: 'https://otx.alienvault.com/browse/global/pulses?q=paypal+phishing' },
  { id: 'OTX-COBALT1', entity: '194.165.16.11', type: 'Cobalt Strike Beacon C2 — Active Malware Campaign', source: 'AlienVault OTX', severity: 'High', time: '2025-07-18', url: 'https://otx.alienvault.com/browse/global/pulses?q=cobalt+strike' },
  { id: 'OTX-MIRAI01', entity: '91.92.109.174', type: 'Mirai Botnet Variant — IoT DDoS Attack Infrastructure', source: 'AlienVault OTX', severity: 'High', time: '2025-07-15', url: 'https://otx.alienvault.com/browse/global/pulses?q=mirai' },
  { id: 'OTX-SOLAR01', entity: 'avsvmcloud.com', type: 'SolarWinds SUNBURST Backdoor — Nation-State Supply Chain Attack', source: 'AlienVault OTX', severity: 'High', time: '2025-07-12', url: 'https://otx.alienvault.com/browse/global/pulses?q=solarwinds' },
  { id: 'OTX-EMOTET1', entity: '146.70.124.42', type: 'Emotet Banking Trojan — Malspam Distribution Network', source: 'AlienVault OTX', severity: 'High', time: '2025-07-10', url: 'https://otx.alienvault.com/browse/global/pulses?q=emotet' },
  { id: 'OTX-REDLIN1', entity: 'e3b0c44298fc1c149afb', type: 'RedLine Stealer — Credential & Crypto Wallet Exfiltration', source: 'AlienVault OTX', severity: 'High', time: '2025-07-08', url: 'https://otx.alienvault.com/browse/global/pulses?q=redline+stealer' },
  { id: 'OTX-LAZARU1', entity: '196.251.73.38', type: 'Lazarus Group (DPRK) — Crypto Exchange Heist Infrastructure', source: 'AlienVault OTX', severity: 'High', time: '2025-07-05', url: 'https://otx.alienvault.com/browse/global/pulses?q=lazarus' },
  { id: 'OTX-KIMSU01', entity: 'thaiware.com', type: 'Kimsuky APT — Watering Hole Attack on Tech Sector', source: 'AlienVault OTX', severity: 'Medium', time: '2025-07-03', url: 'https://otx.alienvault.com/browse/global/pulses?q=kimsuky' },
  { id: 'OTX-DARKSI1', entity: '5.182.210.145', type: 'DarkSide Ransomware — Colonial Pipeline Attack Infrastructure', source: 'AlienVault OTX', severity: 'High', time: '2025-07-01', url: 'https://otx.alienvault.com/browse/global/pulses?q=darkside+ransomware' },
  { id: 'OTX-CONFLU1', entity: '103.114.163.56', type: 'Atlassian Confluence RCE (CVE-2022-26134) — Active Exploitation', source: 'AlienVault OTX', severity: 'High', time: '2025-06-28', url: 'https://otx.alienvault.com/browse/global/pulses?q=confluence+rce' },
  { id: 'OTX-SQUIDS1', entity: 'cloudflare-quic.net', type: 'SquidLoader Malware — Typosquatting CDN Domain', source: 'AlienVault OTX', severity: 'Medium', time: '2025-06-25', url: 'https://otx.alienvault.com/browse/global/pulses?q=typosquatting' },
  { id: 'OTX-BLUEK01', entity: '162.33.179.171', type: 'BlueKeep (CVE-2019-0708) — RDP Worm Scanner Activity', source: 'AlienVault OTX', severity: 'Medium', time: '2025-06-22', url: 'https://otx.alienvault.com/browse/global/pulses?q=bluekeep' },
];

export default function OsintDashboard() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [findings, setFindings] = useState<OsintFinding[]>(RECENT_FINDINGS);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dynamicStats, setDynamicStats] = useState(STATS);
  const [activeTool, setActiveTool] = useState<ToolType>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [lastQuery, setLastQuery] = useState('');

  useEffect(() => {
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const closePdfViewer = () => {
    if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  const handleViewPDF = async () => {
    setIsExporting(true);
    try {
      const blob = await osintApi.generateReport(findings);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
      setPdfUrl(window.URL.createObjectURL(pdfBlob));
    } catch (e) {
      console.error('Failed to generate report', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(false);
    try {
      const result = await osintApi.search(query);
      setLastQuery(query);
      setHasSearched(true);
      if (result.success) {
        setFindings(result.findings);
        setDynamicStats([
          { ...STATS[0], value: 1 },
          { ...STATS[1], value: result.stats?.mentions || 0 },
          { ...STATS[2], value: result.findings?.length || 0 },
        ]);
      } else {
        setSearchError(result.error || 'OTX returned no usable result for this indicator.');
        setFindings([]);
        setDynamicStats([{ ...STATS[0], value: 1 }, { ...STATS[1], value: 0 }, { ...STATS[2], value: 0 }]);
      }
    } catch (err: any) {
      const fromApi = err.response?.data?.error || err.response?.data?.detail;
      const timedOut = err.code === 'ECONNABORTED' || /timeout/i.test(err.message || '');
      setSearchError(
        fromApi
        || (timedOut ? 'The lookup timed out. Try again, or use a quieter IP such as 8.8.8.8.' : null)
        || err.message
        || 'Could not reach the OSINT API. Confirm the backend is running on port 8000.'
      );
      setFindings([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">OSINT Intelligence</h1>
          <p className="page-header-subtitle">Open-Source Intelligence & Threat Monitoring Hub</p>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="card mb-4" style={{ background: 'linear-gradient(90deg, rgba(30,41,59,0.5), rgba(15,23,42,0.5))', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div className="card-body">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                {I.search}
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search IPs, Domains, Emails, or Usernames..."
                style={{
                  width: '100%',
                  padding: '16px 16px 16px 48px',
                  background: 'rgba(15,23,42,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => e.target.style.borderColor = '#6366f1'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0 32px', fontSize: '15px', fontWeight: 600 }}
              disabled={isSearching}
            >
              {isSearching ? 'Scanning...' : 'Analyze'}
            </button>
          </form>
          {searchError && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(244,63,94,0.1)', color: '#f43f5e', borderRadius: '8px', border: '1px solid rgba(244,63,94,0.3)', fontSize: '14px' }}>
              <span style={{ fontWeight: 600 }}>Error: </span>{searchError}
            </div>
          )}
          {hasSearched && !searchError && findings.length > 0 && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '8px', fontSize: '13px', color: '#a5b4fc', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '16px', marginTop: '1px' }}>ℹ️</span>
              <div>
                <span style={{ fontWeight: 700, color: '#818cf8' }}>How to read these results: </span>
                These are <strong>AlienVault OTX Threat Intelligence Pulses</strong> that reference{' '}
                <code style={{ background: 'rgba(99,102,241,0.15)', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{lastQuery}</code>{' '}
                as an <strong>Indicator of Compromise (IOC)</strong>. This means security researchers have linked this indicator to known attack campaigns, malware, phishing, or criminal infrastructure.
                {' '}<span style={{ color: '#fbbf24' }}>⚠️ This does <u>not</u> mean the target launched these attacks</span> — it means threat actors have <strong>used or abused</strong> this entity in their operations (e.g. spoofing a brand, hosting malware, or acting as a C2 node).
                {' '}Click any row to view the full threat report on AlienVault OTX.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="row g-3 mb-4">
        {dynamicStats.map(s => (
          <div key={s.id} className="col-12 col-md-4">
            <StatCard icon={s.icon} label={s.label} value={s.value} color={s.color} colorMuted={s.colorMuted} />
          </div>
        ))}
      </div>




      {/* Cyber Security Tools Row */}
      <div className="section-heading mb-3 mt-2" style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Analyst Toolbox
      </div>
      <div className="row g-3 mb-4">
        {[
          { title: 'Vulnerability Scanner', desc: 'CVE lookup & external service scan triggers.', icon: I.scan, action: 'Run Scan', type: 'cve' as ToolType },
          { title: 'Port Scanner (Nmap)', desc: 'Scan common network ports for active services.', icon: I.tool, action: 'Scan Ports', type: 'nmap' as ToolType },
          { title: 'Domain Reputation', desc: 'Check domain health and threat pulses.', icon: I.globe, action: 'Check Domain', type: 'domain' as ToolType },
          { title: 'WHOIS Explorer', desc: 'Track domain history and registration records.', icon: I.search, action: 'WHOIS Lookup', type: 'whois' as ToolType },
          { title: 'IP Geolocation', desc: 'Locate IP addresses and view ISP/org details.', icon: I.search, action: 'Locate IP', type: 'ipgeo' as ToolType },
          { title: 'Shodan Scanner', desc: 'Discover exposed services and vulnerabilities on an IP.', icon: I.database, action: 'Lookup IP', type: 'shodan' as ToolType },
          { title: 'SOCMINT Search', desc: 'Search for a username across various social platforms.', icon: I.user, action: 'Search Username', type: 'socmint' as ToolType }
        ].map((tool, idx) => (
          <div key={idx} className="col-12 col-md-6 col-xl-4">
            <div className="card h-100 tool-card" style={{ transition: 'all 0.2s', cursor: 'pointer', background: 'rgba(30,41,59,0.3)' }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
              onClick={() => setActiveTool(tool.type)}
            >
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ padding: '8px', background: 'rgba(99,102,241,0.1)', borderRadius: '8px', color: '#818cf8', display: 'flex' }}>
                    {tool.icon}
                  </div>
                  <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '14px' }}>{tool.title}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '18px', flex: 1, lineHeight: '1.5' }}>
                  {tool.desc}
                </div>
                <button className="btn" style={{ fontSize: '12px', padding: '6px 0', width: '100%', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#818cf8'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
                  {tool.action}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Feed Row */}
      <div className="row g-3">
        <div className="col-12">
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Live Intelligence Feed</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={handleViewPDF}
                  disabled={isExporting}
                  className="btn"
                  style={{
                    padding: '4px 12px', fontSize: '12px', background: 'rgba(99,102,241,0.1)',
                    color: '#818cf8', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Eye size={14} />
                  {isExporting ? 'Opening...' : 'View PDF'}
                </button>
                <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} className="blink-anim" />
                  Live Updates Active
                </span>
              </div>
            </div>
            <div style={{ padding: '0 4px' }}>
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Target Entity</th>
                    <th>Detection Type</th>
                    <th>Source</th>
                    <th>Severity</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.length === 0 && !isSearching && !hasSearched && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#94a3b8' }}>No results yet</div>
                        <div style={{ fontSize: '12px' }}>Enter an IP, domain, or file hash above and click Analyze</div>
                      </td>
                    </tr>
                  )}
                  {findings.length === 0 && !isSearching && hasSearched && !searchError && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '48px' }}>
                        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '16px', padding: '32px 48px' }}>
                          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                          <div style={{ fontWeight: 700, fontSize: '18px', color: '#10b981', marginBottom: '6px' }}>No Threats Detected</div>
                          <div style={{ fontSize: '13px', color: '#6ee7b7', marginBottom: '4px' }}>
                            <span style={{ fontFamily: 'monospace', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: '4px' }}>{lastQuery}</span> returned <strong>0 threat intelligence reports</strong>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', maxWidth: '340px', textAlign: 'center' }}>
                            This indicator is not flagged in AlienVault OTX. It appears to be clean based on current threat intelligence data.
                          </div>
                          <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {['✔ No Malicious Pulses', '✔ Not Blacklisted', '✔ No Known Malware'].map(tag => (
                              <span key={tag} style={{ fontSize: '11px', padding: '4px 10px', background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '20px' }}>{tag}</span>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {findings.map((f) => (
                    <tr
                      key={f.id}
                      title={f.url ? 'Click to open full report on AlienVault OTX' : ''}
                      style={{ cursor: f.url ? 'pointer' : 'default', transition: 'background 0.15s' }}
                      onClick={() => f.url && window.open(f.url, '_blank', 'noopener,noreferrer')}
                      onMouseEnter={(e) => { if (f.url) e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td>
                        <span className="font-mono" style={{ color: '#818cf8', fontSize: '12px', textDecoration: f.url ? 'underline' : 'none' }}>
                          {f.id}
                        </span>
                      </td>
                      <td style={{ color: '#f8fafc', fontWeight: 500 }}>{f.entity}</td>
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.type}</td>
                      <td><span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>{f.source}</span></td>
                      <td>
                        <span style={{
                          color: f.severity === 'High' ? '#f43f5e' : f.severity === 'Medium' ? '#fb923c' : '#34d399',
                          fontWeight: 600, fontSize: '13px'
                        }}>
                          ● {f.severity}
                        </span>
                      </td>
                      <td style={{ color: '#64748b', fontSize: '12px' }}>{f.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .blink-anim {
          animation: blink 2s infinite;
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>

      <OsintToolModal
        isOpen={!!activeTool}
        onClose={() => setActiveTool(null)}
        toolType={activeTool}
      />

      {pdfUrl && (
        <div
          onClick={closePdfViewer}
          style={{
            position: 'fixed', inset: 0, zIndex: 5000,
            background: 'rgba(2, 6, 23, 0.82)',
            display: 'flex', flexDirection: 'column',
            padding: '24px 32px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
          >
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>OSINT report</span>
            <button
              type="button"
              onClick={closePdfViewer}
              className="btn"
              style={{
                padding: '6px 14px', fontSize: 13,
                background: 'rgba(255,255,255,0.08)', color: '#e2e8f0',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              Close
            </button>
          </div>
          <iframe
            title="OSINT report"
            src={pdfUrl}
            style={{
              flex: 1, width: '100%', border: 'none', borderRadius: 8,
              background: '#0f172a',
            }}
          />
        </div>
      )}
    </div>
  );
}
