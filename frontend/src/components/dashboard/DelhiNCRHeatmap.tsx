import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dashboardApi from '@/api/dashboard';

const CITY_LABELS = ['All', 'Delhi', 'Noida', 'Gurugram', 'Ghaziabad', 'Meerut', 'Faridabad'];

export default function DelhiNCRHeatmap() {
  const [activeCity, setActiveCity] = useState('All');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: hotspots = [], isLoading } = useQuery({
    queryKey: ['dashboard-hotspots'],
    queryFn: () => dashboardApi.getHotspots(),
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const visible = activeCity === 'All'
    ? hotspots
    : hotspots.filter(h => h.city === activeCity);

  const severeCount = visible.filter(h => h.severe).length;
  const totalCount  = visible.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* City Filter Tabs - Clean Version */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CITY_LABELS.map(city => {
          const isActive = activeCity === city;
          return (
            <button
              key={city}
              onClick={() => setActiveCity(city)}
              style={{
                padding: '4px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 4,
                border: '1px solid',
                borderColor: isActive ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.05)',
                background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                color: isActive ? '#60a5fa' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {city}
            </button>
          );
        })}
      </div>

      {/* Map Canvas - Clean Version */}
      <div style={{
        position: 'relative', width: '100%', height: '320px',
        background: '#0b1120', borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <style>{`
          @keyframes subtle-pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
            50% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
          }
          .dot-base {
            position: absolute;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: all 0.2s ease;
            cursor: pointer;
            z-index: 10;
          }
          .dot-normal {
            width: 8px; height: 8px;
            background: #3b82f6;
            box-shadow: 0 0 10px rgba(59,130,246,0.5);
          }
          .dot-severe {
            width: 12px; height: 12px;
            background: #ef4444;
            box-shadow: 0 0 15px rgba(239,68,68,0.8);
          }
          .dot-pulse {
            position: absolute;
            border-radius: 50%;
            background: rgba(239,68,68,0.4);
            width: 12px; height: 12px;
            animation: subtle-pulse 2s infinite ease-out;
            pointer-events: none;
            z-index: 9;
          }
          .clean-tooltip {
            position: absolute;
            background: rgba(15,23,42,0.95);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255,255,255,0.1);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 500;
            color: #f1f5f9;
            white-space: nowrap;
            pointer-events: none;
            z-index: 20;
            transform: translate(-50%, -140%);
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .bg-dots {
            position: absolute;
            inset: 0;
            background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 24px 24px;
          }
        `}</style>

        {/* Minimalist Background Pattern */}
        <div className="bg-dots" />

        {/* Minimalist SVG Map Outlines (Very subtle) */}
        <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.1 }}>
          <path d="M 0,80 Q 200,100 350,160 T 700,120"         fill="none" stroke="#64748b" strokeWidth="1"/>
          <path d="M 0,180 Q 250,160 500,200 T 900,160"        fill="none" stroke="#64748b" strokeWidth="1"/>
          <path d="M 150,0 Q 170,150 100,300"                  fill="none" stroke="#64748b" strokeWidth="1"/>
          <path d="M 380,0 Q 400,150 360,300"                  fill="none" stroke="#64748b" strokeWidth="1"/>
          <path d="M 600,0 Q 580,150 640,300"                  fill="none" stroke="#64748b" strokeWidth="1"/>
        </svg>

        {/* Vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at center, transparent 40%, #0b1120 100%)', pointerEvents: 'none' }} />

        {!isLoading && visible.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 13, textAlign: 'center', padding: 24, zIndex: 5 }}>
            No FIR jurisdictions mapped yet. Set Jurisdiction on a case (Delhi, Noida, Gurugram) to plot it here.
          </div>
        )}

        {/* Hotspot rendering */}
        {visible.map(h => (
          <React.Fragment key={h.id}>
            {/* Severe pulsing ring */}
            {h.severe && (
              <div
                className="dot-pulse"
                style={{ left: `${h.left}%`, top: `${h.top}%` }}
              />
            )}
            
            {/* Main Dot */}
            <div
              className={`dot-base ${h.severe ? 'dot-severe' : 'dot-normal'}`}
              style={{
                left: `${h.left}%`, top: `${h.top}%`,
                opacity: hoveredId && hoveredId !== h.id ? 0.3 : 1
              }}
              onMouseEnter={() => setHoveredId(h.id)}
              onMouseLeave={() => setHoveredId(null)}
            />

            {/* Clean Hover Tooltip */}
            {hoveredId === h.id && (
              <div className="clean-tooltip" style={{ left: `${h.left}%`, top: `${h.top}%` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.severe ? '#ef4444' : '#3b82f6' }} />
                  <span style={{ fontWeight: 600 }}>{h.label}</span>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 14 }}>
                  {h.city} Jurisdiction
                </div>
                {h.severe && (
                  <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, paddingLeft: 14, marginTop: 2 }}>
                    High Alert Zone · {h.case_count || 0} FIR{(h.case_count || 0) === 1 ? '' : 's'}
                  </div>
                )}
                {!h.severe && (
                  <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 14, marginTop: 2 }}>
                    {h.case_count || 0} FIR{(h.case_count || 0) === 1 ? '' : 's'} on record
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}

        {/* Professional Legend/Overlay */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(8px)',
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Total Zones</span>
            <span style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600, fontFamily: 'monospace' }}>{totalCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>High Alert</span>
            </div>
            <span style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, fontFamily: 'monospace' }}>{severeCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>Standard</span>
            </div>
            <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, fontFamily: 'monospace' }}>{totalCount - severeCount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
