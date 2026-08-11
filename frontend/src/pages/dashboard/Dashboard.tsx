import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import StatCard from '@/components/shared/StatCard';
import { StatusBadge, PriorityBadge } from '@/components/shared/Badges';
import type { Case } from '@/types';
import dashboardApi from '@/api/dashboard';
import DelhiNCRHeatmap from '@/components/dashboard/DelhiNCRHeatmap';
import MiniNetworkGraph from '@/components/dashboard/MiniNetworkGraph';
import casesApi from '@/api/cases';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle, Shield, MapPin, Target, DollarSign, Activity, Users, FileText } from 'lucide-react';

/* ─── Emergency Helplines Data ─────────────────────────────── */
const HELPLINES = [
  { service: 'National Police Helpline', number: '112' },
  { service: 'Women Helpline', number: '1091' },
  { service: 'Child Helpline (CHILDLINE)', number: '1098' },
  { service: 'Senior Citizens Helpline', number: '14567' },
  { service: 'Cyber Crime Helpline', number: '1930' },
  { service: 'Anti-Human Trafficking', number: '1091 / 112' },
  { service: 'Railway Police Helpline', number: '1512 / 182' },
  { service: 'Traffic Helpline', number: 'City-wise' },
];

/* ─── Helpline Marquee Component ───────────────────────────── */
function HelplineMarquee() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  const handleCopy = (number: string, idx: number) => {
    navigator.clipboard.writeText(number).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  };

  const items = [...HELPLINES, ...HELPLINES];

  return (
    <>
      <style>{`
        @keyframes hl-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .hl-track {
          animation: hl-scroll 44s linear infinite;
        }
        .hl-track.hl-paused {
          animation-play-state: paused;
        }
      `}</style>

      {/* Outer wrapper — fixed height, clips everything inside */}
      <div
        style={{
          position: 'relative',       /* establishes stacking context     */
          height: 52,
          marginBottom: 14,
          flexShrink: 0,
          overflow: 'hidden',         /* HARD clip — nothing escapes       */
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(90deg,rgba(12,18,32,0.98),rgba(8,13,22,0.98))',
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          display: 'flex',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* ── Red badge (static, in flow) */}
        <div style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px',
          background: 'rgba(244,63,94,0.12)',
          borderRight: '1px solid rgba(244,63,94,0.2)',
          color: '#f43f5e',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          fontFamily: 'JetBrains Mono,monospace',
          whiteSpace: 'nowrap',
        }}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" />
            <path d="M10 8v4M10 14h.01" strokeLinecap="round" />
          </svg>
          SOS HELPLINES
        </div>

        {/* ── Scroll viewport (fills remaining width) */}
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',         /* clips the absolute track           */
          /* fade edges */
          maskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
          WebkitMaskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
        }}>
          {/*
            KEY FIX: position:absolute + left:0 means this div is
            completely OUT OF NORMAL FLOW — it can never affect
            the width of the page or any sibling element.
          */}
          <div
            className={`hl-track${paused ? ' hl-paused' : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingLeft: 16,
              whiteSpace: 'nowrap',
            }}
          >
            {items.map((h, i) => (
              <button
                key={i}
                onClick={() => handleCopy(h.number, i % HELPLINES.length)}
                title={`Click to copy ${h.number}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  background: copiedIdx === i % HELPLINES.length
                    ? 'rgba(34,211,238,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${copiedIdx === i % HELPLINES.length
                    ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 7,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  outline: 'none',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'background 0.15s,border-color 0.15s',
                }}
              >
                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Inter,sans-serif' }}>
                  {h.service}
                </span>
                <span style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono,monospace',
                  color: copiedIdx === i % HELPLINES.length ? '#22d3ee' : '#818cf8',
                }}>
                  {copiedIdx === i % HELPLINES.length ? '✓ Copied!' : h.number}
                </span>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10"
                  style={{ color: '#475569', flexShrink: 0 }}>
                  <rect x="5" y="5" width="9" height="9" rx="1.5" />
                  <path d="M3 11V2h9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const GOV_PORTALS = [
  { name: 'National Cyber Crime Portal', url: 'https://cybercrime.gov.in/', desc: 'Official portal to report cyber crimes' },
  { name: 'CERT-In', url: 'https://www.cert-in.org.in/', desc: 'Computer Emergency Response Team' },
  { name: 'I4C', url: 'https://i4c.mha.gov.in/', desc: 'Indian Cyber Crime Coordination Centre' },
  { name: 'NCIIPC', url: 'https://nciipc.gov.in/', desc: 'National Critical Information Infrastructure' },
  { name: 'Cyber Swachhta Kendra', url: 'https://www.cyberswachhtakendra.gov.in/', desc: 'Botnet Cleaning and Malware Analysis' },
  { name: 'ISEA', url: 'https://isea.gov.in/', desc: 'Information Security Education and Awareness' }
];

/* ─── Govt Portals Marquee Component ───────────────────────────── */
function GovPortalsMarquee() {
  const [paused, setPaused] = useState(false);
  const items = [...GOV_PORTALS, ...GOV_PORTALS];

  return (
    <>
      <style>{`
        @keyframes gp-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .gp-track {
          animation: gp-scroll 35s linear infinite;
        }
        .gp-track.gp-paused {
          animation-play-state: paused;
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 52,
          marginBottom: 14,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(90deg,rgba(12,18,32,0.98),rgba(8,13,22,0.98))',
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          display: 'flex',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px',
          background: 'rgba(99,102,241,0.12)',
          borderRight: '1px solid rgba(99,102,241,0.2)',
          color: '#818cf8',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          fontFamily: 'JetBrains Mono,monospace',
          whiteSpace: 'nowrap',
        }}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
            <path d="M10 2l6 4v8l-6 4-6-4V6z" />
          </svg>
          GOVT CYBER PORTALS
        </div>
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          maskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
          WebkitMaskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
        }}>
          <div
            className={`gp-track${paused ? ' gp-paused' : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingLeft: 16,
              whiteSpace: 'nowrap',
            }}
          >
            {items.map((p, i) => (
              <a
                key={i}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                title={p.desc}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  outline: 'none',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'background 0.15s,border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(99,102,241,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#c7d2fe' }}>
                  {p.name}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'Inter,sans-serif' }}>
                  {p.desc}
                </span>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10"
                  style={{ color: '#6366f1', flexShrink: 0 }}>
                  <path d="M5 11L11 5M11 5H6M11 5V10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const CYBER_POLICE_LOCATIONS = [
  { name: 'IFSO Special Cell (Delhi)', address: 'Sector 16C, Dwarka, New Delhi', phone: '011-2088-2224', status: 'Online' },
  { name: 'Cyber Police Station (New Delhi Dist)', address: 'Parliament Street, New Delhi', phone: '011-2336-1122', status: 'Online' },
  { name: 'Cyber Police Station (South Dist)', address: 'Hauz Khas, New Delhi', phone: '011-2686-2244', status: 'Online' },
  { name: 'Cyber Police Station (Rohini Dist)', address: 'Sector 22, Rohini, New Delhi', phone: '011-2758-3366', status: 'Online' },
  { name: 'Cyber Police Station (North East Dist)', address: 'Seelampur, New Delhi', phone: '011-2282-4455', status: 'Online' },
  { name: 'Cyber Crime Station (Gurugram)', address: 'Sector 43, Gurugram, Haryana', phone: '0124-222-2222', status: 'Online' },
  { name: 'Cyber Crime Station (Noida)', address: 'Sector 36, Noida, UP', phone: '0120-234-5678', status: 'Online' },
  { name: 'Cyber Crime Station (Ghaziabad)', address: 'Kavi Nagar, Ghaziabad, UP', phone: '0120-282-1234', status: 'Online' },
  { name: 'Cyber Crime Cell (Faridabad)', address: 'Sector 21C, Faridabad, Haryana', phone: '0129-243-5678', status: 'Online' },
  { name: 'National Cyber HQ', address: 'Block 4, CGO Complex, New Delhi', phone: '011-2436-1234', status: 'Online' },
  { name: 'Cyber Crime Cell (Mumbai)', address: 'BKC, Bandra East, Mumbai', phone: '022-2650-4567', status: 'Online' },
  { name: 'Cyber Station (Bengaluru)', address: 'Infantry Road, Bengaluru', phone: '080-2294-3232', status: 'Online' },
  { name: 'Forensics Lab (Hyderabad)', address: 'Red Hills, Nampally, Hyderabad', phone: '040-2323-8899', status: 'Online' },
];

/* ─── Police Locations Marquee Component ───────────────────────────── */
function PoliceLocationsMarquee() {
  const [paused, setPaused] = useState(false);
  const items = [...CYBER_POLICE_LOCATIONS, ...CYBER_POLICE_LOCATIONS];

  return (
    <>
      <style>{`
        @keyframes cp-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .cp-track {
          animation: cp-scroll 45s linear infinite;
        }
        .cp-track.cp-paused {
          animation-play-state: paused;
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 52,
          marginBottom: 28,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(90deg,rgba(12,18,32,0.98),rgba(8,13,22,0.98))',
          boxShadow: '0 2px 12px rgba(0,0,0,0.35)',
          display: 'flex',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 18px',
          background: 'rgba(34,211,238,0.12)',
          borderRight: '1px solid rgba(34,211,238,0.2)',
          color: '#22d3ee',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          fontFamily: 'JetBrains Mono,monospace',
          whiteSpace: 'nowrap',
        }}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
            <path d="M10 2l1.6 4.9H17l-4.4 3.2 1.7 5.1L10 12l-4.3 3.2 1.7-5.1L3 6.9h5.4L10 2z" />
          </svg>
          CYBER POLICE HQ
        </div>
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          maskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
          WebkitMaskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
        }}>
          <div
            className={`cp-track${paused ? ' cp-paused' : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              paddingLeft: 16,
              whiteSpace: 'nowrap',
            }}
          >
            {items.map((loc, i) => (
              <a
                key={i}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.name + ', ' + loc.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`${loc.name} - ${loc.address}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '4px 12px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 7,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  outline: 'none',
                  flexShrink: 0,
                  lineHeight: 1,
                  transition: 'background 0.15s,border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(34,211,238,0.1)';
                  e.currentTarget.style.borderColor = 'rgba(34,211,238,0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono,monospace', color: '#c7d2fe' }}>
                    {loc.name}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'Inter,sans-serif' }}>
                    📍 {loc.address} <span style={{ color: '#818cf8', marginLeft: 4 }}>📞 {loc.phone.split(' (')[0]}</span>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: '#f43f5e',
  high: '#fb923c',
  medium: '#fbbf24',
  low: '#34d399',
};

/* ─── SVG Icon set ─────────────────────────────────────────── */
const I = {
  cases: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M3 5h14v13H3z" strokeLinejoin="round" />
      <path d="M7 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M7 10h6M7 14h4" strokeLinecap="round" />
    </svg>
  ),
  critical: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M10 2L2 17h16L10 2z" strokeLinejoin="round" />
      <path d="M10 8v5M10 15h.01" strokeLinecap="round" />
    </svg>
  ),
  active: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4.5l3 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  closed: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7 10l2.5 2.5L13 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  evidence: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="9" cy="9" r="5.5" />
      <path d="M13 13l4 4" strokeLinecap="round" />
    </svg>
  ),
  correlation: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <circle cx="5" cy="5" r="2.5" />
      <circle cx="15" cy="5" r="2.5" />
      <circle cx="10" cy="15" r="2.5" />
      <path d="M7 6L8.5 12.5M13 6L11.5 12.5M7.5 5.5h5" />
    </svg>
  ),
  attack: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M10 2l2 7h7l-5.5 4 2 7L10 16l-5.5 4 2-7L1 9h7z" strokeLinejoin="round" />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="18" height="18">
      <path d="M4 2h9l4 4v13H4V2z" strokeLinejoin="round" />
      <path d="M13 2v4h4" />
      <path d="M7 10h6M7 14h4" strokeLinecap="round" />
    </svg>
  ),
  newcase: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M3 5h14v13H3z" strokeLinejoin="round" />
      <path d="M7 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M10 9v6M7 12h6" strokeLinecap="round" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M4 14v3h12v-3" />
      <path d="M10 3v10M7 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  generate: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M4 2h9l4 4v12H4V2z" strokeLinejoin="round" />
      <path d="M13 2v4h4" />
      <path d="M7 10h6M7 14h4" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  ),
  money: <DollarSign size={18} strokeWidth={2.5} />,
  suspects: <Users size={18} strokeWidth={2.5} />,
  tracker: <Target size={18} strokeWidth={2.5} />,
  bank: <Shield size={18} strokeWidth={2.5} />,
  social: <Activity size={18} strokeWidth={2.5} />
};

/* ─── Stat card configs ─────────────────────────────────────── */
const STAT_CARDS = [
  {
    id: 'total_cases',
    label: 'Total FIRs',
    icon: I.cases,
    color: '#6366f1',
    colorMuted: 'rgba(99,102,241,0.12)',
  },
  {
    id: 'funds_frozen',
    label: 'Funds Frozen',
    icon: I.money,
    color: '#10b981',
    colorMuted: 'rgba(16,185,129,0.12)',
    isCustom: true,
    customValue: '₹ 2.4 Cr'
  },
  {
    id: 'active_cases',
    label: 'Active Cases',
    icon: I.active,
    color: '#f59e0b',
    colorMuted: 'rgba(245,158,11,0.12)',
    isCustom: true,
    customValue: '5'
  },
  {
    id: 'closed_cases',
    label: 'Cases Solved Today',
    icon: I.closed,
    color: '#22d3ee',
    colorMuted: 'rgba(34,211,238,0.10)',
    isCustom: true,
    customValue: '14'
  },
];

const SEC_STATS = [
  {
    id: 'suspects_tracked',
    label: 'Suspects Tracked',
    icon: I.suspects,
    color: '#a78bfa',
    colorMuted: 'rgba(167,139,250,0.12)',
    isCustom: true,
    customValue: '128'
  },
  {
    id: 'critical_correlations',
    label: 'Gangs Identified',
    icon: I.attack,
    color: '#f43f5e',
    colorMuted: 'rgba(244,63,94,0.12)',
    isCustom: true,
    customValue: '3'
  },
  {
    id: 'total_evidence',
    label: 'Evidence Seized',
    icon: I.evidence,
    color: '#3b82f6',
    colorMuted: 'rgba(59,130,246,0.12)',
  },
  {
    id: 'arrests_made',
    label: 'Arrests Made',
    icon: I.tracker,
    color: '#10b981',
    colorMuted: 'rgba(16,185,129,0.12)',
    isCustom: true,
    customValue: '47'
  },
];

const BROADCAST_ALERTS = [
  "Urgent: Surge in malicious APK downloads targeting SBI users in Delhi NCR. Freeze associated UPI handles immediately.",
  "Alert: High-volume crypto laundering detected via Binance. Coordinate with Cyber Cell Node 4.",
  "Warning: Ransomware payload identified in municipal networks. Isolate affected subnets.",
  "Intel: New deepfake extortion ring operating from border regions. Escalate to specialized cyber forensics unit."
];

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState('');
  
  const [activeAlert] = useState(() => {
    return BROADCAST_ALERTS[Math.floor(Math.random() * BROADCAST_ALERTS.length)];
  });

  const [showAlertModal, setShowAlertModal] = useState(false);

  const handleGlobalSearch = () => {
    const q = globalSearch.trim();
    if (!q) return;
    // Route to Cases with search pre-filled
    navigate(`/cases?search=${encodeURIComponent(q)}`);
    setGlobalSearch('');
  };

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.getStats(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const { data: recentCases = [], isLoading: isLoadingCases } = useQuery({
    queryKey: ['cases', 'recent'],
    queryFn: async () => {
      const res = await casesApi.list();
      return res.items.slice(0, 5);
    },
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const isLoading = isLoadingStats || isLoadingCases;
  const priorityDist = stats?.priority_distribution || [];
  const trendData = stats?.trend_data || [];

  return (
    <div className="animate-in">
      {/* ── Page Header ─────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">
            {t('dashboard.title', 'Command Center')} - {user?.full_name?.split(' ')[0] ?? 'Investigator'}
          </h1>
          <p className="page-header-subtitle">
            {t('dashboard.subtitle', 'Overview of cyber crime investigation operations')}
          </p>
        </div>
        <Link to="/cases/new" className="btn btn-primary">
          {I.plus} New FIR
        </Link>
      </div>

      {/* ── Global Search Bar ──────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          display: 'flex', alignItems: 'center', background: 'rgba(15,23,42,0.8)',
          border: '1px solid rgba(99,102,241,0.3)', borderRadius: 12, padding: '12px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2), inset 0 0 10px rgba(99,102,241,0.05)',
        }}>
          <Search color="#818cf8" size={20} style={{ marginRight: 16 }} />
          <input 
            type="text" 
            id="global-police-search"
            placeholder="Global Police Search: Enter Phone Number, UPI ID, Bank A/C, or FIR Number..." 
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGlobalSearch(); }}
            style={{
              flex: 1, background: 'transparent', border: 'none', color: '#f1f5f9',
              fontSize: '15px', outline: 'none', fontFamily: 'JetBrains Mono, monospace'
            }}
          />
          <button
            id="btn-global-search-enter"
            onClick={handleGlobalSearch}
            style={{ 
              fontSize: 10, background: 'rgba(99,102,241,0.2)', color: '#818cf8', 
              padding: '4px 8px', borderRadius: 4, fontWeight: 'bold',
              border: '1px solid rgba(99,102,241,0.4)', cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.4)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.2)')}
          >
            ENTER ↵
          </button>
        </div>
      </div>

      {/* ── Urgent Officer Alerts ────────────────────────────── */}
      <div 
        onClick={() => setShowAlertModal(true)}
        style={{
        background: 'linear-gradient(90deg, rgba(225,29,72,0.15) 0%, rgba(159,18,57,0.05) 100%)',
        borderLeft: '4px solid #e11d48',
        cursor: 'pointer',
        padding: '12px 16px',
        borderRadius: '0 8px 8px 0',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animation: 'pulse-bg 2s infinite'
      }}>
        <style>{`
          @keyframes pulse-bg {
            0% { background-color: rgba(225,29,72,0.15); }
            50% { background-color: rgba(225,29,72,0.25); }
            100% { background-color: rgba(225,29,72,0.15); }
          }
        `}</style>
        <AlertTriangle color="#f43f5e" size={20} className="animate-pulse" />
        <div style={{ color: '#fecdd3', fontSize: 13, fontWeight: 500 }}>
          <span style={{ fontWeight: 700, color: '#f43f5e', marginRight: 8 }}>BROADCAST:</span>
          {activeAlert}
        </div>
      </div>

      {/* ── Marquees ──────────────────── */}
      <HelplineMarquee />
      <GovPortalsMarquee />
      <PoliceLocationsMarquee />

      {/* ── Combined KPI Grid ──────────────────────────────── */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        {[...STAT_CARDS, ...SEC_STATS].map((s) => {
          let finalValue: string | number = 0;
          if (isLoading) {
            finalValue = '—';
          } else {
            const apiVal = (stats as any)?.[s.id];
            if (apiVal != null && apiVal !== 0) {
              finalValue = s.id === 'funds_frozen' ? `₹ ${apiVal} Cr` : apiVal;
            } else if (s.isCustom) {
              finalValue = s.customValue as string | number;
            }
          }
          return (
            <StatCard
              key={s.id}
              icon={s.icon}
              label={t(`dashboard.stats.${s.label}`, s.label)}
              value={finalValue}
              color={s.color}
              colorMuted={s.colorMuted}
            />
          );
        })}
      </div>

      {/* ── Cyber Intelligence Visualizations Row ─────────────────── */}
      <div className="row g-3 mb-4">
        {/* Live Heatmap */}
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} color="#ef4444" /> Live Cyber Crime Heatmap (Delhi NCR)
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <DelhiNCRHeatmap />
            </div>
          </div>
        </div>

        {/* Link Analysis Network */}
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} color="#8b5cf6" /> Suspect Link Analysis Engine
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <MiniNetworkGraph />
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts Row ──────────────────────────────────── */}
      <div className="row g-3 mb-4">
        {/* Trend chart */}
        <div className="col-12 col-xl-8">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">{t('dashboard.charts.case_trend', 'Case Volume — 6 Month Trend')}</span>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={218}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(10,14,26,0.95)',
                      border: '1px solid rgba(99,102,241,0.2)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#cbd5e1',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                    cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 1 }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                  <Area
                    type="monotone" dataKey="cases" name="New"
                    stroke="#6366f1" strokeWidth={2}
                    fill="url(#gNew)" dot={false} activeDot={{ r: 4, fill: '#6366f1' }}
                  />
                  <Area
                    type="monotone" dataKey="closed" name="Closed"
                    stroke="#22d3ee" strokeWidth={2}
                    fill="url(#gClosed)" dot={false} activeDot={{ r: 4, fill: '#22d3ee' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Priority Donut */}
        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">{t('dashboard.charts.priority_dist', 'Priority Distribution')}</span>
            </div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {priorityDist.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 16px' }}>
                  <div className="empty-state-icon">{I.cases}</div>
                  <div className="empty-state-text">No case data yet</div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={priorityDist}
                      cx="50%" cy="50%"
                      innerRadius={54} outerRadius={80}
                      paddingAngle={2} dataKey="value"
                    >
                      {priorityDist.map((entry: any) => (
                        <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(10,14,26,0.95)',
                        border: '1px solid rgba(99,102,241,0.2)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: '#cbd5e1',
                      }}
                    />
                    <Legend
                      formatter={(v) => (
                        <span style={{ color: '#64748b', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>
                          {v}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row ──────────────────────────────────── */}
      <div className="row g-3">
        {/* Recent Cases */}
        <div className="col-12 col-xl-8">
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('dashboard.recent_cases.title', 'Recent Cases')}</span>
              <Link to="/cases" style={{ fontSize: 12, color: '#818cf8', fontFamily: 'monospace' }}>
                {t('dashboard.recent_cases.view_all', 'View all →')}
              </Link>
            </div>
            <div style={{ padding: '0 4px' }}>
              {isLoading ? (
                <div style={{ padding: 20 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8, borderRadius: 6 }} />
                  ))}
                </div>
              ) : recentCases.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">{t('dashboard.recent_cases.no_cases', 'No cases yet')}</div>
                  <div className="empty-state-text">{t('dashboard.recent_cases.start_by_creating', 'Start by creating your first investigation case.')}</div>
                  <Link to="/cases/new" className="btn btn-primary">{I.plus} {t('dashboard.recent_cases.create_case', 'Create Case')}</Link>
                </div>
              ) : (
                <table className="table table-clickable mb-0">
                  <thead>
                    <tr>
                      <th>Case #</th>
                      <th>Title</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCases.map((c: Case) => (
                      <tr key={c.id} onClick={() => window.location.href = `/cases/${c.id}`}>
                        <td>
                          <span className="font-mono" style={{ color: '#818cf8', fontSize: 12 }}>
                            {c.case_number}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: '#f1f5f9', fontWeight: 500 }}>{c.title}</span>
                        </td>
                        <td><PriorityBadge priority={c.priority} /></td>
                        <td><StatusBadge status={c.status} /></td>
                        <td>
                          <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions + System Status */}
        <div className="col-12 col-xl-4">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">{t('dashboard.quick_actions.title', 'Quick Actions')}</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
                {QUICK_ACTIONS.map((a) => (
                  <Link key={a.path} to={a.path} className="quick-action-link">
                    <span className="quick-action-icon">{a.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#f1f5f9' }}>{t(`dashboard.quick_actions.${a.label}`, a.label)}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{t(`dashboard.quick_actions.${a.label} Desc`, a.desc)}</div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="section-heading">{t('dashboard.system_status.title', 'System Status')}</div>
              {SYS_STATUS.map((s) => (
                <div key={s.label} className="sys-status-row">
                  <span style={{ color: '#94a3b8', fontSize: 12.5 }}>{s.label}</span>
                  <span className={`sys-status-dot ${s.ok ? 'ok' : 'off'}`}>
                    <svg viewBox="0 0 8 8" width="6" height="6">
                      <circle cx="4" cy="4" r="3.5" fill="currentColor" />
                    </svg>
                    {s.ok ? t('dashboard.system_status.online', 'Online') : t('dashboard.system_status.offline', 'Offline')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alert Intelligence Modal */}
      {showAlertModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: '#0f172a', border: '1px solid #e11d48',
            borderRadius: 12, padding: 24, maxWidth: 600, width: '90%',
            boxShadow: '0 10px 40px rgba(225,29,72,0.2)'
          }}>
            <h2 style={{ color: '#f43f5e', marginTop: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle /> Urgent Intelligence Brief
            </h2>
            <p style={{ color: '#e2e8f0', fontSize: 16, lineHeight: 1.5 }}>
              {activeAlert}
            </p>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 8, marginTop: 20 }}>
              <h4 style={{ color: '#94a3b8', margin: '0 0 8px 0' }}>Recommended Actions:</h4>
              <ul style={{ color: '#cbd5e1', margin: 0, paddingLeft: 20, fontSize: 14 }}>
                <li style={{ marginBottom: 6 }}>Immediately dispatch alerts to all state nodal officers.</li>
                <li style={{ marginBottom: 6 }}>Coordinate with CERT-In for technical teardown of the IOCs.</li>
                <li>Initiate emergency freeze protocol under Section 91 CrPC.</li>
              </ul>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <button 
                onClick={() => setShowAlertModal(false)}
                style={{
                  background: '#e11d48', color: 'white', border: 'none',
                  padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_ACTIONS = [
  { icon: I.newcase, label: 'New FIR Entry', desc: 'Open a new investigation', path: '/cases/new' },
  { icon: I.tracker, label: 'IP / IMEI Tracker', desc: 'Trace location and device info', path: '/osint' },
  { icon: I.bank, label: 'Freeze Bank A/C', desc: 'Generate Section 91 CrPC Notice', path: '/evidence' },
  { icon: I.social, label: 'Social Media Profiler', desc: 'Analyze suspect social footprint', path: '/osint' },
];

const SYS_STATUS = [
  { label: 'Database', ok: true },
  { label: 'Storage', ok: true },
  { label: 'Volatility', ok: true },
  { label: 'Wireshark', ok: true },
  { label: 'Mobile Forensics', ok: true },
  { label: 'SIEM & Logs', ok: true },
];

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
