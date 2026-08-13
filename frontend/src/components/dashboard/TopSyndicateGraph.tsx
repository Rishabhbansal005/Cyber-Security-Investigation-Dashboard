import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactFlow, { Background, Controls, NodeProps, Handle, Position, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import dashboardApi from '@/api/dashboard';

/* ── Custom Node Components (Slightly smaller for dashboard) ── */

const EvidenceNode = ({ data }: NodeProps) => (
  <div style={{
    padding: '8px 12px', minWidth: '120px', textAlign: 'center',
    background: 'linear-gradient(135deg, #0d1f2d, #0a1a26)',
    border: '1px solid var(--teal)',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0,212,255,0.2)',
  }}>
    <Handle type="target" position={Position.Top} style={{ background: 'var(--teal)', width: 6, height: 6 }} />
    <div style={{ marginBottom: 2 }}>
      <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase' }}>
        Evidence
      </span>
    </div>
    <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', wordBreak: 'break-all' }}>{data.label}</div>
    <Handle type="source" position={Position.Bottom} style={{ background: 'var(--teal)', width: 6, height: 6 }} />
  </div>
);

const IOCNode = ({ data }: NodeProps) => {
  const color = data.severity === 'critical' ? 'var(--danger)'
              : data.severity === 'high'     ? 'var(--orange)'
              : 'var(--warning)';
  const bg = data.severity === 'critical' ? 'rgba(239,68,68,0.08)'
           : data.severity === 'high'     ? 'rgba(255,107,53,0.08)'
           : 'rgba(245,158,11,0.08)';

  return (
    <div style={{
      padding: '8px 12px', minWidth: '140px', textAlign: 'center',
      background: bg,
      border: `1px solid ${color}`,
      borderRadius: '8px',
      boxShadow: `0 0 10px ${color}40`,
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 6, height: 6 }} />
      <div style={{ marginBottom: 2 }}>
        <span style={{ fontSize: '8px', fontWeight: 800, color, textTransform: 'uppercase' }}>
          {data.type}
        </span>
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', wordBreak: 'break-all' }}>
        {data.label}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6 }} />
    </div>
  );
};

const nodeTypes = {
  evidenceNode: EvidenceNode,
  iocNode:      IOCNode,
  findingNode:  IOCNode, // Use IOC node style for simplicity
};

/* ── Main Component ── */

export default function TopSyndicateGraph() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-top-syndicate'],
    queryFn: () => dashboardApi.getTopSyndicate(),
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const initialNodes = useMemo(() => {
    let ex = 40, ix = 40;
    const ey = 40, iy = 160;

    const nodes = data?.nodes || [];
    return nodes.map((node: any) => {
      let position = { x: 0, y: 0 };
      if (node.type === 'evidenceNode') { position = { x: ex, y: ey }; ex += 200; }
      else                              { position = { x: ix, y: iy }; ix += 220; }
      return { ...node, position };
    });
  }, [data?.nodes]);

  const initialEdges = useMemo(() => {
    const edges = data?.edges || [];
    return edges.map((e: any) => ({
      ...e,
      type: 'smoothstep',
      animated: true,
      style: { strokeWidth: 2, stroke: 'rgba(244,63,94,0.6)' },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(244,63,94,0.6)' },
    }));
  }, [data?.edges]);

  const hasData = initialNodes.length > 0;

  return (
    <div style={{ 
      position: 'relative', width: '100%', height: '440px', 
      background: '#040814', borderRadius: 8, overflow: 'hidden', 
      border: '1px solid rgba(244, 63, 94, 0.2)',
      boxShadow: 'inset 0 0 40px rgba(244, 63, 94, 0.05)'
    }}>
      {/* Header HUD */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 4
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, background: '#f43f5e', borderRadius: '50%', boxShadow: '0 0 10px #f43f5e', animation: 'pulse-ring 1.5s infinite' }} />
          <span style={{ color: '#f43f5e', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono' }}>
            TOP PRIORITY SYNDICATE
          </span>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 10, fontFamily: 'monospace', marginTop: 2 }}>
          {data?.title ? data.title.toUpperCase() : 'REAL-TIME CORRELATION SCAN'}
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
          Loading network...
        </div>
      ) : hasData ? (
        <ReactFlow
          nodes={initialNodes}
          edges={initialEdges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          attributionPosition="bottom-right"
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(244,63,94,0.05)" gap={20} size={1} />
          <Controls style={{ background: '#0f172a', border: '1px solid #1e293b' }} />
        </ReactFlow>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '1px dashed #334155', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
          </div>
          <div style={{ color: '#f8fafc', fontWeight: 600, fontSize: 14 }}>No Active Syndicates Detected</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4, maxWidth: 280 }}>
            The correlation engine is online but has not found any multi-case overlapping evidence yet.
          </div>
        </div>
      )}
    </div>
  );
}
