import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dashboardApi from '@/api/dashboard';

const CITY_COLORS: Record<string, string> = {
  Delhi:      '#ef4444',
  Noida:      '#f97316',
  Gurugram:   '#a855f7',
  Ghaziabad:  '#3b82f6',
  Meerut:     '#06b6d4',
  Faridabad:  '#eab308',
};

const CITY_LABELS = ['All', 'Delhi', 'Noida', 'Gurugram', 'Ghaziabad', 'Meerut', 'Faridabad'];

export default function DelhiNCRHeatmap() {
  const [activeCity, setActiveCity] = useState('All');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const { data: hotspots = [], isLoading } = useQuery({
    queryKey: ['dashboard-hotspots'],
    queryFn: () => dashboardApi.getHotspots(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const visible = activeCity === 'All'
    ? hotspots
    : hotspots.filter(h => h.city === activeCity);

  const severeCount = visible.filter(h => h.severe).length;
  const totalCount  = visible.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* City Filter Tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CITY_LABELS.map(city => (
          <button
            key={city}
            onClick={() => setActiveCity(city)}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 20,
              border: `1px solid ${activeCity === city
                ? (CITY_COLORS[city] || '#6366f1')
                : 'rgba(255,255,255,0.1)'}`,
              background: activeCity === city
                ? `${CITY_COLORS[city] || '#6366f1'}22`
                : 'transparent',
              color: activeCity === city
                ? (CITY_COLORS[city] || '#6366f1')
                : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {city}
          </button>
        ))}
      </div>

      {/* Map Canvas */}
      <div style={{
        position: 'relative', width: '100%', height: '300px',
        background: '#080d17', borderRadius: 8, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.05)',
      }}>
        <style>{`
          @keyframes pulse-ring {
            0% { transform: scale(0.5); opacity: 0; }
            50% { opacity: 0.5; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          @keyframes pulse-dot {
            0% { transform: scale(0.9); }
            50% { transform: scale(1.1); }
            100% { transform: scale(0.9); }
          }
          .hs-dot {
            position: absolute;
            width: 10px; height: 10px;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: pulse-dot 2s infinite ease-in-out;
            cursor: pointer;
            z-index: 5;
          }
          .hs-dot.severe { width: 13px; height: 13px; animation-duration: 1.2s; }
          .hs-ring {
            position: absolute;
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            animation: pulse-ring 3s infinite cubic-bezier(0.215,0.61,0.355,1);
            pointer-events: none;
            z-index: 4;
          }
          .hs-ring.severe { animation-duration: 1.5s; }
          .map-tooltip {
            position: absolute;
            background: rgba(10,15,30,0.95);
            border: 1px solid rgba(255,255,255,0.15);
            padding: 5px 10px; border-radius: 6px;
            font-size: 11px; font-weight: 600;
            color: #f8fafc; white-space: nowrap;
            pointer-events: none; z-index: 20;
            transform: translate(-50%, -130%);
          }
          .grid-bg {
            position: absolute; inset: 0;
            background-image:
              linear-gradient(rgba(34,211,238,0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34,211,238,0.05) 1px, transparent 1px);
            background-size: 20px 20px; opacity: 0.5;
          }
        `}</style>

        {/* Grid */}
        <div className="grid-bg" />

        {/* SVG roads */}
        <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.12 }}>
          <path d="M 0,80 Q 200,100 350,160 T 700,120"         fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
          <path d="M 0,180 Q 250,160 500,200 T 900,160"        fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
          <path d="M 150,0 Q 170,150 100,300"                  fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
          <path d="M 380,0 Q 400,150 360,300"                  fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
          <path d="M 600,0 Q 580,150 640,300"                  fill="none" stroke="#22d3ee" strokeWidth="1.5"/>
          <path d="M 50,0  Q 300,100 600,50  T 900,80"         fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.5"/>
        </svg>

        {/* Radial vignette */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 45% 50%, transparent 30%, #080d17 95%)' }} />

        {/* Hotspot dots */}
        {visible.map(h => {
          const color = CITY_COLORS[h.city] || '#ef4444';
          const ringSize = h.severe ? 48 : 36;
          return (
            <React.Fragment key={h.id}>
              {/* Pulse ring */}
              <div
                className={`hs-ring${h.severe ? ' severe' : ''}`}
                style={{
                  left: `${h.left}%`, top: `${h.top}%`,
                  width: ringSize, height: ringSize,
                  background: `${color}44`,
                  marginLeft: -ringSize/2, marginTop: -ringSize/2,
                }}
              />
              {/* Dot */}
              <div
                className={`hs-dot${h.severe ? ' severe' : ''}`}
                style={{
                  left: `${h.left}%`, top: `${h.top}%`,
                  background: color,
                  boxShadow: `0 0 ${h.severe ? 14 : 8}px ${color}`,
                }}
                onMouseEnter={() => setHoveredId(h.id)}
                onMouseLeave={() => setHoveredId(null)}
              />
              {/* Label always visible (small) */}
              <div style={{
                position: 'absolute',
                left: `${h.left}%`, top: `${h.top}%`,
                transform: 'translate(-50%, 10px)',
                fontSize: 9, fontWeight: 600,
                color: '#94a3b8', whiteSpace: 'nowrap',
                pointerEvents: 'none', zIndex: 6,
                fontFamily: 'monospace',
                textShadow: '0 0 6px #000',
              }}>
                {h.label}
              </div>
              {/* Hover tooltip */}
              {hoveredId === h.id && (
                <div className="map-tooltip" style={{ left: `${h.left}%`, top: `${h.top}%` }}>
                  📍 {h.label} — {h.city}
                  {h.severe && <span style={{ color: '#f87171', marginLeft: 6 }}>⚠ SEVERE</span>}
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Stats Overlay */}
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(15,23,42,0.85)', padding: '8px 12px',
          borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', animation: 'pulse-dot 1s infinite' }} />
            <span style={{ fontSize: 9, color: '#f8fafc', fontWeight: 700, letterSpacing: '0.08em' }}>LIVE HOTSPOTS</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444', fontFamily: 'monospace', lineHeight: 1 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 9, color: '#f87171', marginTop: 3 }}>
            ⚠ {severeCount} Severe Zones
          </div>
        </div>

        {/* City legend (bottom-left) */}
        <div style={{
          position: 'absolute', bottom: 10, left: 10,
          display: 'flex', flexDirection: 'column', gap: 3,
          background: 'rgba(10,15,30,0.8)', padding: '6px 10px',
          borderRadius: 6, border: '1px solid rgba(255,255,255,0.07)',
        }}>
          {Object.entries(CITY_COLORS).map(([city, color]) => (
            <div key={city} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 4px ${color}` }} />
              <span style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600 }}>{city}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
