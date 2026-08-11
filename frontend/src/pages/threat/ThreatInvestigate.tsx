import React, { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, ShieldAlert, Activity, Database, ShieldCheck,
  Cpu, Tag, Link2, Shield, User, ExternalLink, Copy, Search
} from 'lucide-react';
import { threatIntelApi, ThreatObject } from '@/api/threat_intel';

/* ─── Constants ─────────────────────────────────────────────── */
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#3b82f6',
};

const SOURCE_STYLES: Record<string, { bg: string; color: string }> = {
  ThreatFox: { bg: 'rgba(56,189,248,0.1)',   color: '#38bdf8' },
  URLhaus:   { bg: 'rgba(234,179,8,0.1)',    color: '#eab308' },
  OTX:       { bg: 'rgba(52,211,153,0.12)',  color: '#34d399' },
};

function getSeverity(score: number): string {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

/* ─── Sub-components ─────────────────────────────────────────── */
function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <span style={{ color: '#64748b' }}>{icon}</span>
      <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}

function IOCRow({ ioc, source }: { ioc: string; source?: string }) {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 12px',
      borderRadius: '4px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.04)',
      marginBottom: '4px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#cbd5e1', wordBreak: 'break-all' }}>
        {ioc}
      </span>
      <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
        <button
          onClick={() => copyToClipboard(ioc)}
          title="Copy IOC"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
        >
          <Copy size={12} />
        </button>
        <button
          onClick={() => navigate(`/threat-intelligence?q=${encodeURIComponent(ioc)}`)}
          title="Search this IOC"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#38bdf8')}
          onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
        >
          <Search size={12} />
        </button>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export default function ThreatInvestigate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const threatId    = searchParams.get('id');
  const queryTerm   = searchParams.get('q') || '';
  const malwareFilter = searchParams.get('malware') || '';

  const { data: correlatedData, isLoading, isError } = useQuery({
    queryKey: ['threat_intel_correlated'],
    queryFn: threatIntelApi.getCorrelatedThreats,
    staleTime: 60_000,
  });

  const allThreats: ThreatObject[] = correlatedData?.data || [];

  /* Find the primary threat by ID or search term */
  const primaryThreat: ThreatObject | null = useMemo(() => {
    if (threatId) return allThreats.find(t => t.id === threatId) || null;
    if (malwareFilter) return allThreats.find(t =>
      t.malware_family?.toLowerCase() === malwareFilter.toLowerCase()
    ) || null;
    if (queryTerm) return allThreats.find(t =>
      t.threat_name.toLowerCase().includes(queryTerm.toLowerCase()) ||
      t.ioc_list.some(i => i.toLowerCase().includes(queryTerm.toLowerCase())) ||
      t.malware_family?.toLowerCase().includes(queryTerm.toLowerCase())
    ) || null;
    return null;
  }, [allThreats, threatId, queryTerm, malwareFilter]);

  /* Related campaigns — same malware family */
  const relatedCampaigns: ThreatObject[] = useMemo(() => {
    if (!primaryThreat?.malware_family) return [];
    return allThreats.filter(t =>
      t.id !== primaryThreat.id &&
      t.malware_family?.toLowerCase() === primaryThreat.malware_family?.toLowerCase()
    );
  }, [allThreats, primaryThreat]);

  const severity = primaryThreat ? getSeverity(primaryThreat.threat_score) : 'low';
  const severityColor = SEVERITY_COLORS[severity];

  /* ── Render states ── */
  if (isLoading) {
    return (
      <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: '#64748b', fontSize: '14px' }}>Loading threat intelligence...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ color: '#ef4444', fontSize: '14px' }}>Unable to reach intelligence feed.</div>
      </div>
    );
  }

  if (!primaryThreat) {
    return (
      <div className="animate-in" style={{ paddingBottom: '2rem' }}>
        <BackButton navigate={navigate} />
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '50vh', gap: '12px', color: '#64748b',
        }}>
          <Shield size={32} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: '14px' }}>
            No threat found for: <strong style={{ color: '#94a3b8' }}>"{queryTerm || malwareFilter || threatId}"</strong>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ paddingBottom: '2rem' }}>

      {/* ─── Back + Breadcrumb ─── */}
      <BackButton navigate={navigate} label={primaryThreat.threat_name} />

      {/* ─── Threat Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: severityColor, display: 'inline-block', flexShrink: 0,
            }} />
            <h1 style={{
              margin: 0, fontSize: '18px', fontWeight: 700,
              color: '#f8fafc', letterSpacing: '0.02em', textTransform: 'uppercase',
            }}>
              {primaryThreat.threat_name}
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {primaryThreat.malware_family && (
              <span style={{
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#94a3b8', padding: '2px 10px', borderRadius: '4px', fontSize: '12px',
              }}>
                {primaryThreat.malware_family}
              </span>
            )}
            {primaryThreat.sources.map(src => {
              const s = SOURCE_STYLES[src] ?? { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' };
              return (
                <span key={src} style={{
                  background: s.bg, color: s.color,
                  padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 500,
                  textTransform: 'uppercase',
                }}>
                  {src}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: `${severityColor}15`,
          border: `1px solid ${severityColor}40`,
          padding: '10px 20px', borderRadius: '6px',
        }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: severityColor, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
            {primaryThreat.threat_score}
          </span>
          <div>
            <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.08em' }}>THREAT</div>
            <div style={{ fontSize: '9px', color: '#64748b', letterSpacing: '0.08em' }}>SCORE</div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        {/* ─── Left column: Indicators + Related Campaigns ─── */}
        <div className="col-12 col-xl-7">

          {/* Indicators */}
          <div className="card mb-3" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <Activity size={14} color="#94a3b8" />
                INDICATORS
                <span style={{
                  marginLeft: '4px', background: 'rgba(56,189,248,0.1)', color: '#38bdf8',
                  padding: '0 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                }}>
                  {primaryThreat.indicator_count}
                </span>
              </span>
            </div>
            <div className="card-body" style={{ padding: '16px', maxHeight: '340px', overflowY: 'auto' }}>
              {primaryThreat.ioc_list.length > 0 ? (
                primaryThreat.ioc_list.map((ioc, i) => (
                  <IOCRow key={i} ioc={ioc} />
                ))
              ) : (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
                  No indicators available.
                </div>
              )}
            </div>
          </div>

          {/* Related Campaigns */}
          {relatedCampaigns.length > 0 && (
            <div className="card" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(15,23,42,0.6)' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <ShieldAlert size={14} color="#94a3b8" />
                  RELATED CAMPAIGNS
                  <span style={{
                    marginLeft: '4px', background: 'rgba(249,115,22,0.1)', color: '#f97316',
                    padding: '0 6px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
                  }}>
                    {relatedCampaigns.length}
                  </span>
                </span>
              </div>
              <div className="card-body" style={{ padding: '0' }}>
                {relatedCampaigns.map((campaign, idx) => {
                  const sev = getSeverity(campaign.threat_score);
                  return (
                    <div
                      key={campaign.id}
                      onClick={() => navigate(`/threat-intelligence/investigate?id=${campaign.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', cursor: 'pointer',
                        borderBottom: idx < relatedCampaigns.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: SEVERITY_COLORS[sev], flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500, textTransform: 'uppercase' }}>
                          {campaign.threat_name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: SEVERITY_COLORS[sev] }}>
                          {campaign.threat_score}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {campaign.indicator_count} IOCs
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ─── Right column: Intel + OTX enrichment ─── */}
        <div className="col-12 col-xl-5">

          {/* Threat Meta */}
          <div className="card mb-3" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="card-body" style={{ padding: '16px' }}>
              <SectionTitle icon={<Shield size={13} />} label="Threat Intelligence" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <MetaRow label="First Seen" value={primaryThreat.first_seen ? new Date(primaryThreat.first_seen.replace(' UTC', 'Z')).toLocaleString() : '--'} />
                <MetaRow label="Confidence" value={`${primaryThreat.confidence}%`} />
                <MetaRow label="Severity" value={severity.toUpperCase()} valueColor={severityColor} />
                <MetaRow label="Campaigns" value={(relatedCampaigns.length + 1).toString()} />
              </div>
            </div>
          </div>

          {/* OTX Enrichment */}
          {(primaryThreat.otx_pulses?.length > 0 ||
            primaryThreat.otx_tags?.length > 0 ||
            primaryThreat.otx_attack_ids?.length > 0 ||
            primaryThreat.otx_threat_actor) ? (
            <div className="card" style={{ border: '1px solid rgba(52,211,153,0.15)' }}>
              <div className="card-header" style={{ borderBottom: '1px solid rgba(52,211,153,0.1)', background: 'rgba(15,23,42,0.6)' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#34d399' }}>
                  <Cpu size={14} color="#34d399" />
                  OTX ENRICHMENT
                </span>
              </div>
              <div className="card-body" style={{ padding: '16px' }}>

                {primaryThreat.otx_threat_actor && (
                  <div style={{ marginBottom: '16px' }}>
                    <SectionTitle icon={<User size={12} />} label="Threat Actor" />
                    <span style={{
                      background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                      color: '#fb923c', padding: '3px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 500,
                    }}>
                      {primaryThreat.otx_threat_actor}
                    </span>
                  </div>
                )}

                {primaryThreat.otx_attack_ids?.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <SectionTitle icon={<Shield size={12} />} label="MITRE ATT&CK" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {primaryThreat.otx_attack_ids.map((id, i) => (
                        <a
                          key={i}
                          href={`https://attack.mitre.org/techniques/${id.replace('.', '/')}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
                            color: '#c084fc', padding: '2px 8px', borderRadius: '4px',
                            fontSize: '11px', fontFamily: 'var(--font-mono)', textDecoration: 'none',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          <ExternalLink size={9} />
                          {id}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {primaryThreat.otx_tags?.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <SectionTitle icon={<Tag size={12} />} label="Tags" />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {primaryThreat.otx_tags.slice(0, 20).map((tag, i) => (
                        <span key={i} style={{
                          background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                          color: '#6ee7b7', padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {primaryThreat.otx_pulses?.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <SectionTitle icon={<Cpu size={12} />} label={`OTX Pulses (${primaryThreat.otx_pulses.length})`} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {primaryThreat.otx_pulses.slice(0, 4).map((pulse, i) => (
                        <div key={pulse.id || i} style={{
                          background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)',
                          borderRadius: '6px', padding: '10px 12px',
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>
                            {pulse.name || 'Unnamed Pulse'}
                          </div>
                          {pulse.description && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                              {pulse.description.length > 120 ? pulse.description.slice(0, 120) + '…' : pulse.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {primaryThreat.otx_references?.length > 0 && (
                  <div>
                    <SectionTitle icon={<Link2 size={12} />} label="References" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {primaryThreat.otx_references.slice(0, 6).map((ref, i) => (
                        <a
                          key={i}
                          href={ref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={ref}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            fontSize: '11px', color: '#38bdf8', textDecoration: 'none',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          <ExternalLink size={10} style={{ flexShrink: 0 }} />
                          {ref.length > 55 ? ref.slice(0, 55) + '…' : ref}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="card-body" style={{ padding: '20px', textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Shield size={14} />
                  No OTX enrichment available for this threat.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Small helper components ──────────────────────────────── */
function BackButton({ navigate, label }: { navigate: (path: string) => void; label?: string }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <button
        onClick={() => navigate('/threat-intelligence')}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          background: 'none', border: '1px solid rgba(255,255,255,0.08)',
          color: '#94a3b8', padding: '6px 14px', borderRadius: '4px',
          cursor: 'pointer', fontSize: '12px', fontWeight: 500,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.color = '#e2e8f0';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'none';
          e.currentTarget.style.color = '#94a3b8';
        }}
      >
        <ArrowLeft size={14} />
        Back to Feed
      </button>
    </div>
  );
}

function MetaRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '12px', color: '#64748b' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: 500, color: valueColor || '#e2e8f0', fontFamily: 'var(--font-mono)' }}>
        {value}
      </span>
    </div>
  );
}
