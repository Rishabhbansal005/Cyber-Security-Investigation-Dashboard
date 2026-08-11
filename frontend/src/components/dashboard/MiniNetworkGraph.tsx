import React, { useEffect, useState } from 'react';
import { Shield, Activity, Users, CreditCard, Link2, MapPin, Smartphone, Fingerprint } from 'lucide-react';

export default function MiniNetworkGraph() {
  const [dataPackets, setDataPackets] = useState<number[]>([]);

  useEffect(() => {
    // Generate new data packets continuously to simulate live correlation
    const interval = setInterval(() => {
      setDataPackets(prev => {
        // Keep max 8 packets, add a new one with a random ID
        const next = [...prev, Date.now()];
        if (next.length > 8) next.shift();
        return next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ 
      position: 'relative', width: '100%', height: '440px', 
      background: '#040814', borderRadius: 8, overflow: 'hidden', 
      border: '1px solid rgba(139, 92, 246, 0.2)',
      boxShadow: 'inset 0 0 40px rgba(139, 92, 246, 0.05)'
    }}>
      <style>{`
        /* ── Background & Radar ── */
        .tech-grid {
          position: absolute; inset: 0;
          background-image: 
            linear-gradient(rgba(139, 92, 246, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.05) 1px, transparent 1px);
          background-size: 30px 30px;
          opacity: 0.6;
        }
        @keyframes sweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .radar-sweep {
          position: absolute;
          left: 50%; top: 50%;
          width: 600px; height: 600px;
          margin-left: -300px; margin-top: -300px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 70%, rgba(139, 92, 246, 0.1) 80%, rgba(139, 92, 246, 0.3) 100%);
          animation: sweep 4s linear infinite;
          pointer-events: none;
        }
        .radar-ring {
          position: absolute;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          border: 1px dashed rgba(139, 92, 246, 0.2);
          border-radius: 50%;
          pointer-events: none;
        }

        /* ── SVG Lines & Data Packets ── */
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        .network-line {
          stroke: rgba(139, 92, 246, 0.6);
          stroke-width: 1.5;
          stroke-dasharray: 4, 4;
          animation: dash 1s linear infinite;
        }
        .network-line-critical {
          stroke: rgba(244, 63, 94, 0.8);
          stroke-width: 2;
          stroke-dasharray: 6, 6;
          animation: dash 0.8s linear infinite reverse;
        }
        
        @keyframes packet-move {
          0% { offset-distance: 0%; opacity: 0; transform: scale(0.5); }
          10% { opacity: 1; transform: scale(1); }
          90% { opacity: 1; transform: scale(1); }
          100% { offset-distance: 100%; opacity: 0; transform: scale(0.5); }
        }
        .data-packet {
          position: absolute;
          width: 6px; height: 6px;
          background: #22d3ee;
          border-radius: 50%;
          box-shadow: 0 0 10px #22d3ee, 0 0 20px #22d3ee;
          animation: packet-move 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          pointer-events: none;
        }

        /* ── Nodes ── */
        .network-node {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          z-index: 10;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .network-node:hover {
          transform: translate(-50%, -50%) scale(1.15);
          z-index: 20;
        }
        
        .node-icon {
          width: 44px; height: 44px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          position: relative;
          backdrop-filter: blur(4px);
        }
        .node-icon::before {
          content: ''; position: absolute; inset: -5px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.1);
          animation: pulse-ring 2s infinite;
        }
        .node-icon::after {
          content: ''; position: absolute; inset: 0; border-radius: 50%;
          box-shadow: inset 0 0 10px rgba(255,255,255,0.2);
        }
        
        @keyframes pulse-node {
          0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(244, 63, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
        }
        .node-suspect .node-icon {
          animation: pulse-node 1.5s infinite;
          background: linear-gradient(135deg, #e11d48, #be123c);
        }

        .node-label {
          font-size: 12px; color: #f8fafc; font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
          background: rgba(15,23,42,0.95);
          padding: 8px 12px; border-radius: 8px;
          max-width: 220px;
          text-align: center;
          border: 1px solid rgba(139, 92, 246, 0.4);
          box-shadow: 0 4px 15px rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          line-height: 1.4;
        }
        .node-label .sub {
          display: block; font-size: 10.5px; color: #94a3b8; margin-top: 4px;
          font-family: 'Inter', sans-serif;
          font-weight: 500;
        }
        
        /* Overlay UI */
        .overlay-hud {
          position: absolute; top: 12px; left: 12px;
          display: flex; flex-direction: column; gap: 4px;
          pointer-events: none; z-index: 30;
        }
      `}</style>

      {/* Background Elements */}
      <div className="tech-grid" />
      <div className="radar-sweep" />
      <div className="radar-ring" style={{ width: 140, height: 140 }} />
      <div className="radar-ring" style={{ width: 280, height: 280 }} />
      <div className="radar-ring" style={{ width: 420, height: 420 }} />

      {/* SVG Connections & Particles */}
      <svg width="100%" height="100%" style={{ position: 'absolute', zIndex: 1 }}>
        <defs>
          <path id="path-bank" d="M 50% 50% L 15% 20%" />
          <path id="path-ip" d="M 50% 50% L 85% 25%" />
          <path id="path-fir1" d="M 50% 50% L 20% 80%" />
          <path id="path-fir2" d="M 50% 50% L 80% 75%" />
          <path id="path-device" d="M 50% 50% L 50% 15%" />
          <path id="path-crypto" d="M 50% 50% L 10% 50%" />
        </defs>

        {/* Lines */}
        <line x1="50%" y1="50%" x2="15%" y2="20%" className="network-line-critical" />
        <line x1="50%" y1="50%" x2="85%" y2="25%" className="network-line" />
        <line x1="50%" y1="50%" x2="20%" y2="80%" className="network-line" />
        <line x1="50%" y1="50%" x2="80%" y2="75%" className="network-line" />
        <line x1="50%" y1="50%" x2="50%" y2="15%" className="network-line" />
        <line x1="50%" y1="50%" x2="10%" y2="50%" className="network-line" />

        {/* Animated Packets along paths */}
        {dataPackets.map((id, i) => {
          const paths = ['path-bank', 'path-ip', 'path-fir1', 'path-fir2', 'path-device', 'path-crypto'];
          const randomPath = paths[i % paths.length];
          const color = randomPath === 'path-bank' ? '#f43f5e' : '#22d3ee';
          return (
            <circle key={id} r="3" fill={color} filter="url(#glow)">
              <animateMotion dur="1.5s" repeatCount="1" path={`url(#${randomPath})`} calcMode="linear" />
              <animate attributeName="opacity" values="0;1;1;0" dur="1.5s" repeatCount="1" />
            </circle>
          );
        })}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </svg>

      {/* NODES */}
      
      {/* 1. Central Suspect */}
      <div className="network-node node-suspect" style={{ left: '50%', top: '55%' }}>
        <div className="node-icon" style={{ color: '#fff', boxShadow: '0 0 30px rgba(225, 29, 72, 0.8)' }}>
          <Users size={22} />
        </div>
        <div className="node-label" style={{ border: '1px solid #e11d48' }}>
          Suspect: +91-9876543210
          <span className="sub" style={{ color: '#ef4444', fontWeight: 700, fontSize: '11px' }}>Active Case: Multi-State Financial Fraud</span>
          <span className="sub">Alias: "Raju Bhai" (Jam Jam Gang)</span>
        </div>
      </div>

      {/* 2. Bank Node */}
      <div className="network-node" style={{ left: '26%', top: '22%' }}>
        <div className="node-icon" style={{ background: 'linear-gradient(135deg, #059669, #047857)', color: '#fff' }}>
          <CreditCard size={20} />
        </div>
        <div className="node-label">
          HDFC A/C: 50100234492
          <span className="sub" style={{ color: '#ef4444' }}>STATUS: FROZEN (₹2.4L)</span>
        </div>
      </div>

      {/* 3. IP Node */}
      <div className="network-node" style={{ left: '74%', top: '24%' }}>
        <div className="node-icon" style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff' }}>
          <Activity size={20} />
        </div>
        <div className="node-label">
          IP: 103.45.12.89 (Static)
          <span className="sub">ISP: Jio | Geo: Delhi (Okhla)</span>
        </div>
      </div>

      {/* 4. FIR 1 Node */}
      <div className="network-node" style={{ left: '28%', top: '85%' }}>
        <div className="node-icon" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff' }}>
          <Shield size={20} />
        </div>
        <div className="node-label">
          FIR: DL/2026/102
          <span className="sub" style={{ color: '#38bdf8', fontWeight: 600 }}>Fraud Type: UPI Phishing</span>
          <span className="sub">Section 420, 66D IT Act</span>
        </div>
      </div>

      {/* 5. FIR 2 Node */}
      <div className="network-node" style={{ left: '72%', top: '82%' }}>
        <div className="node-icon" style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff' }}>
          <Shield size={20} />
        </div>
        <div className="node-label">
          FIR: HR/2026/889
          <span className="sub" style={{ color: '#38bdf8', fontWeight: 600 }}>Fraud Type: Crypto Scam</span>
          <span className="sub">Cyber Crime PS, Gurugram</span>
        </div>
      </div>

      {/* 6. Device Node */}
      <div className="network-node" style={{ left: '50%', top: '15%' }}>
        <div className="node-icon" style={{ background: 'linear-gradient(135deg, #ca8a04, #a16207)', color: '#fff' }}>
          <Smartphone size={20} />
        </div>
        <div className="node-label">
          Device: OnePlus 9 (Rooted)
          <span className="sub">IMEI: 864321045982314</span>
        </div>
      </div>

      {/* 7. Crypto Node */}
      <div className="network-node" style={{ left: '18%', top: '55%' }}>
        <div className="node-icon" style={{ background: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#fff' }}>
          <Fingerprint size={20} />
        </div>
        <div className="node-label">
          Crypto Wallet (Binance)
          <span className="sub">BTC: 0.45 transferred to 1A1z...</span>
        </div>
      </div>

      {/* HUD UI Elements */}
      <div className="overlay-hud">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981', animation: 'pulse-ring 1s infinite' }} />
          <span style={{ color: '#10b981', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono' }}>
            ENGINE ACTIVE
          </span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 9, fontFamily: 'monospace', marginTop: 2 }}>
          REAL-TIME CORRELATION SCAN
        </div>
      </div>

      <div style={{ 
        position: 'absolute', bottom: 12, right: 12, 
        color: '#6366f1', fontSize: 9, fontFamily: 'monospace',
        background: 'rgba(99, 102, 241, 0.1)', padding: '4px 8px',
        borderRadius: 4, border: '1px solid rgba(99, 102, 241, 0.3)'
      }}>
        CONFIDENCE SCORE: 94%
      </div>
    </div>
  );
}
