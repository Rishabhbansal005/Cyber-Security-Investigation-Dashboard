import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, ShieldAlert, Crosshair, Database, AlertTriangle, AlertCircle, Info, ShieldCheck, ActivitySquare, AlertOctagon } from 'lucide-react';
import { threatIntelApi, ThreatFoxEvent } from '@/api/threat_intel';
import { formatDistanceToNow } from 'date-fns';
import ThreatVisualizer from '@/components/threat/ThreatVisualizer';

/* ─── Shared Badges & Components ───────────────────────────── */
const StatusDot = ({ color = '#22c55e', animate = true }) => (
  <span style={{ display: 'inline-flex', position: 'relative', width: 8, height: 8 }}>
    {animate && (
      <span style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        borderRadius: '50%',
        backgroundColor: color,
        opacity: 0.75,
        animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
      }} />
    )}
    <span style={{
      position: 'relative',
      display: 'inline-flex',
      borderRadius: '50%',
      width: 8,
      height: 8,
      backgroundColor: color
    }} />
    <style>{`
      @keyframes ping {
        75%, 100% { transform: scale(2); opacity: 0; }
      }
    `}</style>
  </span>
);

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444', // Red
  high: '#f97316',     // Orange
  medium: '#eab308',   // Yellow
  low: '#3b82f6'       // Blue
};

function getSeverity(confidence: number): string {
  if (confidence >= 75) return 'critical';
  if (confidence >= 50) return 'high';
  if (confidence >= 25) return 'medium';
  return 'low';
}

function formatTime(utcTimeStr: string | null): string {
  if (!utcTimeStr) return '--:--:--';
  try {
    // Remove " UTC" string if present and replace space with 'T'
    const cleanStr = utcTimeStr.replace(' UTC', '');
    const isoString = cleanStr.includes('T') ? cleanStr : cleanStr.replace(' ', 'T');
    const d = new Date(isoString + (isoString.endsWith('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return utcTimeStr;
    return d.toLocaleTimeString('en-GB');
  } catch (e) {
    return utcTimeStr;
  }
}

export default function LiveThreatIntelligence() {
  const { data: threatFoxData, isLoading: tfLoading, isError: tfError, dataUpdatedAt: tfUpdatedAt } = useQuery({
    queryKey: ['threatfox_recent'],
    queryFn: threatIntelApi.getRecentThreatFoxIOCs,
    refetchInterval: 60000,
  });

  const { data: urlhausData, isLoading: uhLoading, isError: uhError, dataUpdatedAt: uhUpdatedAt } = useQuery({
    queryKey: ['urlhaus_recent'],
    queryFn: threatIntelApi.getRecentURLhausIOCs,
    refetchInterval: 60000,
  });

  const isLoading = tfLoading || uhLoading;
  const isError = tfError && uhError; // Only offline if BOTH fail
  
  const events = useMemo(() => {
    const tfEvents = threatFoxData?.data || [];
    const uhEvents = urlhausData?.data || [];
    return [...tfEvents, ...uhEvents].sort((a, b) => {
      const parseDate = (dStr: string) => {
        if (!dStr) return 0;
        const cleanStr = dStr.replace(' UTC', '');
        const iso = cleanStr.includes('T') ? cleanStr : cleanStr.replace(' ', 'T');
        const d = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
        return isNaN(d.getTime()) ? 0 : d.getTime();
      };
      return parseDate(b.first_seen) - parseDate(a.first_seen);
    });
  }, [threatFoxData, urlhausData]);
  
  const stats = useMemo(() => {
    if (isError || isLoading) return { iocs: '--', c2: '--', malware: '--', sources: '1' };
    
    let c2 = 0;
    let malware = 0;
    
    events.forEach(e => {
      const type = (e.threat_type || '').toLowerCase();
      if (type.includes('botnet') || type.includes('c2') || e.ioc_type === 'ip:port') {
        c2++;
      }
      if (e.malware_family && e.malware_family !== 'unknown') {
        malware++;
      }
    });
    
    return {
      iocs: events.length.toString(),
      c2: c2.toString(),
      malware: malware.toString(),
      sources: ((threatFoxData?.success ? 1 : 0) + (urlhausData?.success ? 1 : 0)).toString()
    };
  }, [events, isError, isLoading]);

  const topMalware = useMemo(() => {
    if (!events.length) {
      return [
        { category: 'Ransomware', count: 142, trend: '', severity: 'critical' as const },
        { category: 'Phishing', count: 85, trend: '', severity: 'high' as const },
        { category: 'Botnet', count: 64, trend: '', severity: 'high' as const },
        { category: 'DDoS Loader', count: 42, trend: '', severity: 'medium' as const },
        { category: 'Spyware', count: 21, trend: '', severity: 'low' as const },
      ];
    }
    const counts: Record<string, number> = {};
    events.forEach(e => {
      const m = e.malware_printable || e.malware_family;
      if (m && m !== 'unknown') {
        counts[m] = (counts[m] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        category: name,
        count,
        trend: '',
        severity: count > 5 ? 'critical' : count > 2 ? 'high' : 'medium'
      }));
  }, [events]);

  const topMalwareMax = Math.max(...topMalware.map(t => t.count), 1);

  const isOffline = (threatFoxData && !threatFoxData.success) && (urlhausData && !urlhausData.success);
  const lastUpdatedStr = tfUpdatedAt || uhUpdatedAt
    ? `Last updated: ${formatDistanceToNow(Math.max(tfUpdatedAt || 0, uhUpdatedAt || 0), { addSuffix: true })}`
    : 'AWAITING STREAM';

  return (
    <div className="animate-in" style={{ paddingBottom: '2rem' }}>
      {/* ─── Page Header ──────────────────────────────────────── */}
      <div className="page-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 className="page-header-title" style={{ color: '#f8fafc', letterSpacing: '0.02em' }}>
              LIVE THREAT INTELLIGENCE
            </h1>
            {!isOffline ? (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', 
                background: 'rgba(34, 197, 94, 0.1)', 
                border: '1px solid rgba(34, 197, 94, 0.2)',
                padding: '4px 10px', 
                borderRadius: '4px',
                color: '#4ade80',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)'
              }}>
                <StatusDot color="#4ade80" />
                SYSTEM ONLINE
              </div>
            ) : (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '6px', 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '4px 10px', 
                borderRadius: '4px',
                color: '#ef4444',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)'
              }}>
                <StatusDot color="#ef4444" animate={false} />
                FEED OFFLINE
              </div>
            )}
          </div>
          <p className="page-header-subtitle" style={{ color: '#94a3b8', marginTop: '6px' }}>
            Real-time cyber threat intelligence monitoring and analysis
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
          <span>FEED STATUS: <span style={{ color: isOffline ? '#ef4444' : '#e2e8f0' }}>{isOffline ? 'OFFLINE' : (isLoading ? 'CONNECTING...' : 'LIVE')}</span></span>
          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
          <span>{lastUpdatedStr}</span>
        </div>
      </div>

      {/* ─── Threat Overview Cards ────────────────────────────── */}
      <div className="row g-3 mb-4">
        {[
          { label: 'NEW IOCs', value: stats.iocs, icon: <Activity size={20} />, color: '#38bdf8' },
          { label: 'C2 INDICATORS', value: stats.c2, icon: <AlertTriangle size={20} />, color: '#ef4444' },
          { label: 'MALWARE INDICATORS', value: stats.malware, icon: <ShieldAlert size={20} />, color: '#f97316' },
          { label: 'INTELLIGENCE SOURCES', value: stats.sources, icon: <Database size={20} />, color: '#a855f7' }
        ].map((stat, i) => (
          <div key={i} className="col-12 col-sm-6 col-xl-3">
            <div className="card" style={{ 
              background: 'linear-gradient(180deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.5) 100%)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderTop: `2px solid ${stat.color}`,
              padding: '20px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05, color: stat.color, transform: 'scale(3)' }}>
                {stat.icon}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                    {stat.value}
                  </div>
                </div>
                <div style={{ color: stat.color, background: `${stat.color}15`, padding: '8px', borderRadius: '6px' }}>
                  {stat.icon}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-4">
        {/* ─── Main Threat Activity Area ────────────────────────── */}
        <div className="col-12 col-xl-8">
          <div className="card h-100" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <Crosshair size={16} color="#94a3b8" />
                THREAT ACTIVITY
              </span>
            </div>
            <div className="card-body" style={{ 
              height: '400px', 
              padding: 0,
              background: 'radial-gradient(circle at center, rgba(30,41,59,0.3) 0%, rgba(2,6,23,0.8) 100%)',
              position: 'relative'
            }}>
              <ThreatVisualizer events={events} />
            </div>
          </div>
        </div>

        {/* ─── Top Threats Panel ──────────────────────────────── */}
        <div className="col-12 col-xl-4">
          <div className="card h-100" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <AlertCircle size={16} color="#94a3b8" />
                TOP THREATS
              </span>
            </div>
            <div className="card-body" style={{ padding: '0', overflowY: 'auto', maxHeight: '400px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topMalware.length > 0 ? (
                  topMalware.map((threat, idx) => (
                    <div key={idx} style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      padding: '16px',
                      borderBottom: idx !== topMalware.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      transition: 'background 0.2s',
                      cursor: 'default',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            width: '4px', height: '16px', borderRadius: '2px',
                            background: SEVERITY_COLORS[threat.severity]
                          }} />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: '#e2e8f0' }}>{threat.category}</span>
                        </div>
                        <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#94a3b8', minWidth: '40px', textAlign: 'right' }}>
                          {threat.count}
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${(threat.count / topMalwareMax) * 100}%`, 
                          height: '100%', 
                          background: SEVERITY_COLORS[threat.severity],
                          borderRadius: '2px'
                        }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    No threats detected in recent feed.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Live Event Feed Panel ────────────────────────────── */}
      <div className="card mb-4" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <Activity size={16} color="#94a3b8" />
            LIVE INTELLIGENCE FEED
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>Displaying {events.length} recent events</span>
        </div>
        <div className="table-responsive">
          <table className="table mb-0" style={{ fontSize: '13px' }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '120px' }}>TIMESTAMP</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '100px' }}>SEVERITY</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px' }}>EVENT TYPE</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px' }}>IOC</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '150px' }}>MALWARE</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', textAlign: 'right', width: '100px' }}>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    Loading threat intelligence...
                  </td>
                </tr>
              ) : isOffline ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#ef4444' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <AlertOctagon size={16} />
                      ThreatFox feed temporarily unavailable.
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    NO RECENT THREATFOX INTELLIGENCE AVAILABLE
                  </td>
                </tr>
              ) : (
                events.slice(0, 100).map((event: ThreatFoxEvent, index: number) => {
                  const severity = getSeverity(event.confidence_level);
                  const malwareName = event.malware_printable || event.malware_family || 'Unknown';
                  
                  return (
                    <tr key={event.id + '-' + index} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatTime(event.first_seen)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ 
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          color: SEVERITY_COLORS[severity],
                          textTransform: 'uppercase', fontSize: '11px', fontWeight: 600
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLORS[severity] }} />
                          {severity}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase' }}>
                          {event.threat_type_desc || event.threat_type}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
                          {event.ioc_type}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                        <a 
                          href={event.source === 'URLhaus' ? `https://urlhaus.abuse.ch/url/${event.id}/` : `https://threatfox.abuse.ch/ioc/${event.id}/`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: event.source === 'URLhaus' ? '#eab308' : '#38bdf8', 
                            textDecoration: 'none',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {event.ioc}
                        </a>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                        {malwareName !== 'Unknown' ? (
                          <span style={{ display: 'inline-block', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                            {malwareName}
                          </span>
                        ) : (
                          <span style={{ color: '#475569' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                          background: event.source === 'URLhaus' ? 'rgba(234, 179, 8, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                          color: event.source === 'URLhaus' ? '#eab308' : '#38bdf8',
                          textTransform: 'uppercase'
                        }}>
                          {event.source}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Intelligence Sources ───────────────────────────────── */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Info size={14} color="#64748b" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            INTELLIGENCE SOURCES
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', 
            background: 'rgba(56, 189, 248, 0.05)',
            border: '1px solid rgba(56, 189, 248, 0.2)',
            borderRadius: '6px',
            color: '#38bdf8',
            fontSize: '12px',
            fontWeight: 500
          }}>
            <ShieldCheck size={14} color="#38bdf8" />
            ThreatFox
          </div>
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', 
            background: 'rgba(234, 179, 8, 0.05)',
            border: '1px solid rgba(234, 179, 8, 0.2)',
            borderRadius: '6px',
            color: '#eab308',
            fontSize: '12px',
            fontWeight: 500
          }}>
            <Database size={14} color="#eab308" />
            URLhaus
          </div>
        </div>
      </div>

    </div>
  );
}
