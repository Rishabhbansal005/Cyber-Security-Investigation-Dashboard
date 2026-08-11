import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldAlert, Crosshair, Database, AlertCircle, AlertOctagon,
  ChevronLeft, ChevronRight, Search, ShieldCheck, Filter, AlertTriangle, Shield
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { threatIntelApi, ThreatObject } from '@/api/threat_intel';
import { formatDistanceToNow } from 'date-fns';
import ThreatVisualizer from '@/components/threat/ThreatVisualizer';

/* ─── Shared Helpers ────────────────────────────────────────── */
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6'
};

function getSeverity(score: number): string {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function formatTime(utcTimeStr: string | null): string {
  if (!utcTimeStr) return '--:--:--';
  try {
    const cleanStr = utcTimeStr.replace(' UTC', '');
    const isoString = cleanStr.includes('T') ? cleanStr : cleanStr.replace(' ', 'T');
    const d = new Date(isoString + (isoString.endsWith('Z') ? '' : 'Z'));
    if (isNaN(d.getTime())) return utcTimeStr;
    return d.toLocaleTimeString('en-GB');
  } catch (e) {
    return utcTimeStr;
  }
}

const SOURCE_STYLES: Record<string, { bg: string; color: string }> = {
  ThreatFox: { bg: 'rgba(56, 189, 248, 0.1)',   color: '#38bdf8' },
  URLhaus:   { bg: 'rgba(234, 179, 8, 0.1)',    color: '#eab308' },
  OTX:       { bg: 'rgba(52, 211, 153, 0.12)',  color: '#34d399' },
};

function getSourceStyle(src: string) {
  return SOURCE_STYLES[src] ?? { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' };
}

/* ─── Sub-Components ────────────────────────────────────────── */
const StatusDot = ({ color = '#22c55e', animate = true }) => (
  <span style={{ display: 'inline-flex', position: 'relative', width: 8, height: 8 }}>
    {animate && (
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%', backgroundColor: color,
        opacity: 0.75, animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
      }} />
    )}
    <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: 8, height: 8, backgroundColor: color }} />
    <style>{`@keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }`}</style>
  </span>
);

function ThreatActivityTimeline() {
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('24h');
  const { data, isLoading } = useQuery({
    queryKey: ['threat_intel_timeline', range],
    queryFn: () => threatIntelApi.getTimeline(range),
    refetchInterval: 60000,
  });

  const chartData = data?.data || [];

  return (
    <div className="card h-100" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="card-header" style={{
        borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <Activity size={16} color="#94a3b8" /> THREAT ACTIVITY TIMELINE
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['1h', '24h', '7d'] as const).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              background: range === r ? 'rgba(56,189,248,0.1)' : 'transparent',
              border: '1px solid', borderColor: range === r ? 'rgba(56,189,248,0.2)' : 'transparent',
              color: range === r ? '#38bdf8' : '#64748b',
              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer',
              textTransform: 'uppercase'
            }}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="card-body" style={{ padding: '16px 20px 0 0' }}>
        {isLoading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            Loading timeline...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            No timeline data available for this range.
          </div>
        ) : (
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="label" stroke="#475569" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" fontSize={11} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', fontSize: '12px', color: '#e2e8f0' }}
                  itemStyle={{ color: '#38bdf8' }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[2, 2, 0, 0]} name="Events" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ────────────────────────────────────────────── */
export default function LiveThreatIntelligence() {
  const navigate = useNavigate();
  const { data: correlatedData, isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ['threat_intel_correlated'],
    queryFn: threatIntelApi.getCorrelatedThreats,
    refetchInterval: 60000,
  });

  const events = correlatedData?.data || [];
  const isOffline = isError || (correlatedData && !correlatedData.success);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [malwareFilter, setMalwareFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 25;

  /* ── Derived Data ── */
  const stats = useMemo(() => {
    if (isError || isLoading) return { iocs: '--', campaigns: '--', active: '--', sources: '--' };
    const totalIndicators = correlatedData?.total_events || 0;
    const critical = events.filter(e => e.threat_score >= 75).length;
    const sources = new Set(events.flatMap(e => e.sources)).size;
    return { iocs: totalIndicators.toString(), campaigns: events.length.toString(), active: critical.toString(), sources: sources.toString() };
  }, [events, isError, isLoading, correlatedData]);

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
      const m = e.malware_family;
      if (m && m.toLowerCase() !== 'unknown') counts[m] = (counts[m] || 0) + e.indicator_count;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        category: name, count, severity: count > 10 ? 'critical' : count > 5 ? 'high' : 'medium'
      }));
  }, [events]);

  const topMalwareMax = Math.max(...topMalware.map(t => t.count), 1);

  const filteredEvents = useMemo(() => {
    let result = events;
    if (malwareFilter) {
      result = result.filter(e => e.malware_family === malwareFilter);
    }
    if (severityFilter !== 'all') {
      result = result.filter(e => getSeverity(e.threat_score) === severityFilter);
    }
    if (sourceFilter !== 'all') {
      result = result.filter(e => e.sources.includes(sourceFilter));
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.threat_name.toLowerCase().includes(lower) ||
        e.ioc_list.some(ioc => ioc.toLowerCase().includes(lower)) ||
        e.malware_family?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [events, malwareFilter, severityFilter, sourceFilter, searchTerm]);

  // Reset page when filters change
  useMemo(() => setCurrentPage(1), [malwareFilter, severityFilter, sourceFilter, searchTerm]);

  const totalPages = Math.ceil(filteredEvents.length / rowsPerPage);
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const lastUpdatedStr = dataUpdatedAt ? `Last updated: ${formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}` : 'AWAITING STREAM';

  return (
    <div className="animate-in" style={{ paddingBottom: '2rem' }}>

      {/* ─── Page Header ─── */}
      <div className="page-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1 className="page-header-title" style={{ color: '#f8fafc', letterSpacing: '0.02em' }}>
                LIVE THREAT INTELLIGENCE
              </h1>
              {!isOffline ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)', padding: '4px 10px', borderRadius: '4px',
                  color: '#4ade80', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)'
                }}>
                  <StatusDot color="#4ade80" /> SYSTEM ONLINE
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '4px',
                  color: '#ef4444', fontSize: '11px', fontWeight: 600, fontFamily: 'var(--font-mono)'
                }}>
                  <StatusDot color="#ef4444" animate={false} /> FEED OFFLINE
                </div>
              )}
            </div>
            <p className="page-header-subtitle" style={{ color: '#94a3b8', marginTop: '6px' }}>
              Real-time cyber threat intelligence monitoring and SOC analyst workflow
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            <span>FEED STATUS: <span style={{ color: isOffline ? '#ef4444' : '#e2e8f0' }}>{isOffline ? 'OFFLINE' : (isLoading ? 'CONNECTING...' : 'LIVE')}</span></span>
            <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.1)' }} />
            <span>{lastUpdatedStr}</span>
          </div>
        </div>
      </div>

      {/* ─── Summary Cards ─── */}
      <div className="row g-3 mb-4">
        {[
          { label: 'TOTAL INDICATORS', value: stats.iocs, icon: <Activity size={20} />, color: '#38bdf8' },
          { label: 'CRITICAL CAMPAIGNS', value: stats.active, icon: <ShieldAlert size={20} />, color: '#ef4444' },
          { label: 'ACTIVE CAMPAIGNS', value: stats.campaigns, icon: <Crosshair size={20} />, color: '#f97316' },
          { label: 'SOURCES ONLINE', value: stats.sources, icon: <Database size={20} />, color: '#a855f7' }
        ].map((stat, i) => (
          <div key={i} className="col-12 col-sm-6 col-xl-3">
            <div className="card" style={{
              background: 'linear-gradient(180deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.5) 100%)',
              border: '1px solid rgba(255,255,255,0.05)', borderTop: `2px solid ${stat.color}`,
              padding: '20px', position: 'relative', overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05, color: stat.color, transform: 'scale(3)' }}>{stat.icon}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '8px' }}>{stat.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{stat.value}</div>
                </div>
                <div style={{ color: stat.color, background: `${stat.color}15`, padding: '8px', borderRadius: '6px' }}>{stat.icon}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Chart & Top Threats ─── */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-xl-8">
          <div className="card h-100 mb-4" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
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
          <ThreatActivityTimeline />
        </div>
        <div className="col-12 col-xl-4">
          <div className="card h-100" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="card-header" style={{
              borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)',
              display: 'flex', justifyContent: 'space-between'
            }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <AlertCircle size={16} color="#94a3b8" /> TOP THREATS
              </span>
              {malwareFilter && (
                <button onClick={() => setMalwareFilter('')} style={{
                  background: 'none', border: 'none', color: '#38bdf8', fontSize: '11px', cursor: 'pointer'
                }}>Clear Filter</button>
              )}
            </div>
            <div className="card-body" style={{ padding: '0', overflowY: 'auto', maxHeight: '300px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {topMalware.length > 0 ? (
                  topMalware.map((threat, idx) => {
                    const isSelected = malwareFilter === threat.category;
                    return (
                      <div key={idx} onClick={() => setMalwareFilter(isSelected ? '' : threat.category)} style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        padding: '16px',
                        borderBottom: idx !== topMalware.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                        background: isSelected ? 'rgba(56,189,248,0.1)' : 'transparent',
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                        gap: '12px'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ 
                              width: '4px', height: '16px', borderRadius: '2px',
                              background: SEVERITY_COLORS[threat.severity]
                            }} />
                            <span style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#38bdf8' : '#e2e8f0' }}>{threat.category}</span>
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
                    );
                  })
                ) : (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No threats detected.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Filters & Search Bar ─── */}
      <div className="card mb-3" style={{ border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.4)' }}>
        <div className="card-body" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 auto', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '300px', maxWidth: '100%' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search IOC, Campaign, Malware..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '8px 12px 8px 32px', fontSize: '13px',
                  background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px', color: '#f8fafc', outline: 'none'
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={14} color="#64748b" />
              <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={{
                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
                padding: '6px 10px', borderRadius: '4px', fontSize: '12px', outline: 'none', cursor: 'pointer'
              }}>
                <option value="all" style={{ background: '#0f172a', color: '#e2e8f0' }}>All Severities</option>
                <option value="critical" style={{ background: '#0f172a', color: '#e2e8f0' }}>Critical</option>
                <option value="high" style={{ background: '#0f172a', color: '#e2e8f0' }}>High</option>
                <option value="medium" style={{ background: '#0f172a', color: '#e2e8f0' }}>Medium</option>
              </select>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{
                background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
                padding: '6px 10px', borderRadius: '4px', fontSize: '12px', outline: 'none', cursor: 'pointer'
              }}>
                <option value="all" style={{ background: '#0f172a', color: '#e2e8f0' }}>All Sources</option>
                <option value="ThreatFox" style={{ background: '#0f172a', color: '#e2e8f0' }}>ThreatFox</option>
                <option value="URLhaus" style={{ background: '#0f172a', color: '#e2e8f0' }}>URLhaus</option>
                <option value="OTX" style={{ background: '#0f172a', color: '#e2e8f0' }}>AlienVault OTX</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Showing <strong>{filteredEvents.length}</strong> campaigns
          </div>
        </div>
      </div>

      {/* ─── Live Event Feed Panel (Paginated) ─── */}
      <div className="card mb-4" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="table-responsive" style={{ overflowX: 'auto', width: '100%' }}>
          <table className="table mb-0" style={{ fontSize: '13px', width: '100%', tableLayout: 'fixed' }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '100px' }}>TIMESTAMP</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '80px' }}>SCORE</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '250px' }}>THREAT CAMPAIGN</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '280px' }}>INDICATORS</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', width: '150px' }}>MALWARE</th>
                <th style={{ color: '#64748b', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', textAlign: 'right', width: '120px' }}>SOURCES</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>Loading threat intelligence...</td></tr>
              ) : isOffline ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#ef4444' }}><AlertOctagon size={16} /> Intelligence feed offline.</td></tr>
              ) : paginatedEvents.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>NO THREATS MATCHING FILTERS</td></tr>
              ) : (
                paginatedEvents.map((event: ThreatObject) => {
                  const severity = getSeverity(event.threat_score);
                  return (
                    <tr
                      key={event.id}
                      onClick={() => navigate(`/threat-intelligence/investigate?id=${event.id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      title="Click to investigate this campaign"
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatTime(event.first_seen)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: SEVERITY_COLORS[severity], fontSize: '11px', fontWeight: 600 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLORS[severity] }} />
                          {event.threat_score}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ color: '#e2e8f0', fontWeight: 500, fontSize: '12px', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {event.threat_name}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1', fontFamily: 'var(--font-mono)' }}>
                        <span style={{ fontWeight: 600, color: '#38bdf8', marginRight: '6px' }}>{event.indicator_count}</span>
                        <span style={{ color: '#64748b' }}>{event.ioc_list[0] || 'N/A'}{event.indicator_count > 1 ? ' ...' : ''}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8' }}>
                        {event.malware_family && event.malware_family !== 'Unknown' ? (
                          <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                            {event.malware_family}
                          </span>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          {event.sources.map(src => {
                            const style = getSourceStyle(src);
                            return (
                              <span key={src} style={{ background: style.bg, color: style.color, padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                                {src}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredEvents.length)} of {filteredEvents.length}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === 1 ? '#475569' : '#e2e8f0',
                  padding: '4px 8px', borderRadius: '4px', cursor: currentPage === 1 ? 'default' : 'pointer'
                }}
              ><ChevronLeft size={16} /></button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: currentPage === totalPages ? '#475569' : '#e2e8f0',
                  padding: '4px 8px', borderRadius: '4px', cursor: currentPage === totalPages ? 'default' : 'pointer'
                }}
              ><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Sources Badges ─── */}
      <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '6px', color: '#38bdf8', fontSize: '12px' }}><ShieldCheck size={14} /> ThreatFox</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '6px', color: '#eab308', fontSize: '12px' }}><Database size={14} /> URLhaus</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '6px', color: '#34d399', fontSize: '12px' }}><Shield size={14} /> AlienVault OTX</div>
      </div>
    </div>
  );
}
