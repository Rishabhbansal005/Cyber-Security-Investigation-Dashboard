import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ThreatObject } from '@/api/threat_intel';

interface ThreatVisualizerProps {
  events: ThreatObject[];
}

// Simulated map nodes (abstract grid coordinates)
const NODES = [
  { id: 'n1', x: 20, y: 30, label: 'New York' },
  { id: 'n2', x: 80, y: 25, label: 'London' },
  { id: 'n3', x: 70, y: 70, label: 'Lagos' },
  { id: 'n4', x: 30, y: 75, label: 'Sao Paulo' },
  { id: 'n5', x: 130, y: 40, label: 'Beijing' },
  { id: 'n6', x: 110, y: 80, label: 'Jakarta' },
  { id: 'n7', x: 90, y: 35, label: 'Moscow' },
  { id: 'n8', x: 85, y: 50, label: 'Dubai' },
  { id: 'hq', x: 115, y: 45, label: 'INDIA-HQ', isHq: true }, // India approximately
];

export default function ThreatVisualizer({ events }: ThreatVisualizerProps) {
  const [activeAttacks, setActiveAttacks] = useState<any[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<any[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const queueRef = useRef<ThreatObject[]>([...events]);

  const handleBlockIP = (id: string) => {
    setTerminalLogs(prev => prev.map(log => 
      log.id === id ? { ...log, blocked: true } : log
    ));
    // Optional: Could trigger a toast notification here
  };

  // Keep queue updated if events change
  useEffect(() => {
    queueRef.current = [...events];
  }, [events]);

  // Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      // Pick a random event from the queue, or create a mock one if empty
      const evt_raw = queueRef.current.length > 0 ? queueRef.current.pop() : undefined;

      const evt: any = evt_raw || {
        ioc_list: [`${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.x.x`],
        threat_name: 'Malware Payload',
        malware_family: 'Unknown',
        confidence: Math.random() * 100
      };

      // Pick random source node and target node
      const sourceNode = NODES[Math.floor(Math.random() * (NODES.length - 1))]; // Exclude HQ from source
      const targetNode = NODES.find(n => n.isHq) || NODES[0];

      const attackId = Math.random().toString(36).substr(2, 9);
      const isCritical = (evt.confidence || evt.threat_score || 50) > 75;
      
      const newAttack = {
        id: attackId,
        source: sourceNode,
        target: targetNode,
        color: isCritical ? '#ef4444' : '#38bdf8' // Red or Blue
      };

      // Add to map
      setActiveAttacks(prev => [...prev, newAttack]);
      
      // Remove from map after animation
      setTimeout(() => {
        setActiveAttacks(prev => prev.filter(a => a.id !== attackId));
      }, 1500);

      // Add to terminal
      const logTime = new Date().toLocaleTimeString('en-GB', { hour12: false });
      const malware = evt.malware_family && evt.malware_family !== 'Unknown' ? evt.malware_family : 'Generic Threat';
      const type = evt.threat_name || 'Attack';
      const ioc = evt.ioc_list?.[0] || 'Unknown IOC';
      
      const logEntry = {
        id: attackId,
        time: logTime,
        isCritical,
        type,
        ioc,
        malware,
        target: targetNode.label,
        blocked: false
      };
      
      setTerminalLogs(prev => {
        const next = [...prev, logEntry];
        if (next.length > 50) return next.slice(next.length - 50); // Keep last 50
        return next;
      });

    }, 2000); // New attack every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  return (
    <div style={{ 
      display: 'flex', 
      width: '100%', 
      height: '100%', 
      background: 'radial-gradient(circle at center, rgba(30,41,59,0.4) 0%, rgba(2,6,23,0.95) 100%)',
      overflow: 'hidden',
      borderRadius: '0 0 8px 8px'
    }}>
      
      {/* ─── MAP AREA ─────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Background Grid */}
        <div style={{ 
          position: 'absolute', inset: 0, 
          backgroundImage: 'linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        
        {/* SVG Drawing Area */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice">
          
          {/* Static Nodes */}
          {NODES.map(node => (
            <g key={node.id}>
              {/* Pulse effect for HQ */}
              {node.isHq && (
                <motion.circle
                  cx={node.x} cy={node.y} r={1.5}
                  fill="none" stroke="#22d3ee" strokeWidth={0.5}
                  animate={{ r: [1.5, 6], opacity: [1, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
              <circle 
                cx={node.x} cy={node.y} r={node.isHq ? 1.5 : 0.8} 
                fill={node.isHq ? '#22d3ee' : '#475569'} 
              />
              <text 
                x={node.x} y={node.y + 3} 
                fill={node.isHq ? '#22d3ee' : '#475569'} 
                fontSize="2" 
                textAnchor="middle"
                fontFamily="var(--font-mono)"
                letterSpacing="0.1"
              >
                {node.label}
              </text>
            </g>
          ))}

          {/* Animated Attack Lines */}
          <AnimatePresence>
            {activeAttacks.map(attack => {
              // Calculate control point for curved arc
              const cx = (attack.source.x + attack.target.x) / 2;
              const cy = Math.min(attack.source.y, attack.target.y) - 20; // Arc upwards
              const pathDef = `M ${attack.source.x} ${attack.source.y} Q ${cx} ${cy} ${attack.target.x} ${attack.target.y}`;
              
              return (
                <motion.g key={attack.id}>
                  {/* Faint trail */}
                  <path 
                    d={pathDef} 
                    fill="none" 
                    stroke={attack.color} 
                    strokeWidth={0.2} 
                    opacity={0.2} 
                  />
                  {/* Glowing Laser */}
                  <motion.path
                    d={pathDef}
                    fill="none"
                    stroke={attack.color}
                    strokeWidth={0.8}
                    initial={{ pathLength: 0, opacity: 1 }}
                    animate={{ pathLength: 1, opacity: [1, 1, 0] }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                  {/* Impact Explosion */}
                  <motion.circle
                    cx={attack.target.x} cy={attack.target.y}
                    r={0.5}
                    fill={attack.color}
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 5, opacity: 0 }}
                    transition={{ delay: 1, duration: 0.5 }}
                  />
                </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>

        <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>CRITICAL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>HIGH/MED</span>
          </div>
        </div>
      </div>

      {/* ─── TERMINAL AREA ────────────────────────────────────── */}
      <div style={{ 
        width: '320px', 
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(2,6,23,0.8)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          fontSize: '11px',
          fontWeight: 600,
          color: '#22c55e',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.1em',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: 6, height: 6, background: '#22c55e', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
          LIVE INTERCEPT LOG
        </div>
        
        <div 
          ref={terminalRef}
          style={{ 
            flex: 1, 
            padding: '16px', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <style>{`
            .terminal-line {
              font-family: 'JetBrains Mono', monospace;
              font-size: 11px;
              line-height: 1.4;
              word-break: break-all;
            }
            .terminal-line.critical { color: #ef4444; }
            .terminal-line.warn { color: #eab308; }
            
            /* Custom scrollbar for terminal */
            ::-webkit-scrollbar { width: 4px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
          `}</style>
          
          {terminalLogs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`terminal-line ${log.isCritical ? 'critical' : 'warn'}`}
            >
              [{log.time}] {log.isCritical ? 'CRITICAL' : 'WARN'} - {log.type} from {' '}
              <span 
                onClick={() => handleBlockIP(log.id)}
                style={{
                  cursor: log.blocked ? 'default' : 'pointer',
                  textDecoration: log.blocked ? 'line-through' : 'underline',
                  color: log.blocked ? '#64748b' : '#38bdf8',
                  background: log.blocked ? 'transparent' : 'rgba(56,189,248,0.1)',
                  padding: '0 2px',
                  borderRadius: '2px'
                }}
                title={log.blocked ? 'IP Blocked' : 'Click to Block IP'}
              >
                {log.ioc}
              </span>
              {' '} [{log.malware}] -{'>'} {log.target}
              {log.blocked && <span style={{ marginLeft: '8px', color: '#10b981', fontSize: '10px' }}>[BLOCKED]</span>}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
