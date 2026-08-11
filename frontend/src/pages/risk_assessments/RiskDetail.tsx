import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { RiskBadge } from './RiskList';
import RiskForm from './RiskForm';

const parseArray = (val: any): any[] => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    if (val.startsWith('{') && val.endsWith('}')) {
      return val.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    }
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      if (val.trim()) return val.split(',').map(s => s.trim());
    }
  }
  return [];
};

const renderArrayItem = (item: any): string => {
  if (typeof item === 'string') return item;
  if (typeof item === 'object' && item !== null) {
    return item.name || item.title || item.label || item.description || JSON.stringify(item);
  }
  return String(item);
};

const MatrixCell = ({ l, i, currentL, currentI }: { l: number, i: number, currentL: number, currentI: number }) => {
  const score = l * i;
  let bg = 'var(--bg-input)';
  let color = 'var(--text-muted)';
  
  if (score >= 15) { bg = 'var(--danger-muted)'; color = 'var(--danger)'; }
  else if (score >= 10) { bg = 'var(--orange-muted)'; color = 'var(--orange)'; }
  else if (score >= 5) { bg = 'var(--warning-muted)'; color = 'var(--warning)'; }
  else { bg = 'var(--success-muted)'; color = 'var(--success)'; }

  const isActive = l === currentL && i === currentI;

  return (
    <div style={{
      aspectRatio: '1',
      background: bg,
      color: color,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 16,
      fontWeight: 700,
      borderRadius: 8,
      border: isActive ? `3px solid ${color}` : `1px solid ${color}33`,
      boxShadow: isActive ? `0 0 15px ${color}66` : 'none',
      opacity: isActive ? 1 : 0.6,
      transform: isActive ? 'scale(1.1)' : 'scale(1)',
      zIndex: isActive ? 10 : 1,
      transition: 'all 0.2s ease',
    }}>
      {score}
    </div>
  );
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 50, color: 'red', background: 'white', position: 'fixed', inset: 0, zIndex: 99999, overflow: 'auto' }}>
          <h1>Fatal React Error</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function RiskDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: assessment, isLoading, error } = useQuery({
    queryKey: ['risk_assessments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_assessments')
        .select(`
          *,
          case:cases(id, case_number, title),
          assessor:users!risk_assessments_assessed_by_fkey(full_name)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('risk_assessments').delete().eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk_assessments'] });
      queryClient.invalidateQueries({ queryKey: ['available_cases_for_risk'] });
      navigate('/risk');
    },
  });

  if (isLoading) {
    return <div style={{ padding: 32 }}><div className="skeleton" style={{ height: 200, borderRadius: 16 }} /></div>;
  }

  if (error || !assessment) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <div className="empty-state-title">Assessment not found</div>
        <Link to="/risk" className="btn btn-primary">Back to Risk Assessments</Link>
      </div>
    );
  }

  if (isEditing) {
    return (
      <RiskForm
        mode="edit"
        initialData={assessment}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['risk_assessments', id] });
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="page-content animate-in">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Link to="/risk" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none' }}>← Risk Assessments</Link>
            <span style={{ color: 'var(--border-color)' }}>›</span>
            <span className="font-mono" style={{ color: 'var(--teal)', fontSize: 13 }}>{assessment.case?.case_number}</span>
          </div>
          <h1 className="page-header-title" style={{ marginBottom: 8 }}>Risk Assessment: {assessment.case?.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RiskBadge level={assessment.risk_level} />
          </div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline-secondary" onClick={() => setIsEditing(true)}>✏️ Edit</button>
          <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>🗑️ Delete</button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: 'var(--bg-modal)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 32, maxWidth: 420, width: '90%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h3 style={{ color: 'var(--text-heading)', marginBottom: 12 }}>Delete Assessment?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>This assessment will be permanently deleted. This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-outline-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="row" style={{ gap: '24px', flexWrap: 'wrap', margin: 0 }}>
        <div style={{ flex: '1 1 60%', minWidth: '320px', padding: 0 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
              
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Threat Actors</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {parseArray(assessment.threat_actors).length > 0 ? parseArray(assessment.threat_actors).map((ta: any, idx: number) => (
                    <span key={idx} style={{ background: 'var(--danger-muted)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                      {renderArrayItem(ta)}
                    </span>
                  )) : <span style={{ color: 'var(--text-muted)' }}>None identified</span>}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Affected Assets</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {parseArray(assessment.affected_assets).length > 0 ? parseArray(assessment.affected_assets).map((aa: any, idx: number) => (
                    <span key={idx} style={{ background: 'var(--teal-muted)', color: 'var(--teal)', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                      {renderArrayItem(aa)}
                    </span>
                  )) : <span style={{ color: 'var(--text-muted)' }}>None identified</span>}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 32 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mitigation Measures</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {parseArray(assessment.mitigation_measures).length > 0 ? parseArray(assessment.mitigation_measures).map((mm: any, idx: number) => (
                    <span key={idx} style={{ background: 'var(--success-muted)', color: 'var(--success)', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                      {renderArrayItem(mm)}
                    </span>
                  )) : <span style={{ color: 'var(--text-muted)' }}>None identified</span>}
                </div>
              </div>

              {assessment.analyst_notes && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 32 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Analyst Notes</h3>
                  <div style={{ padding: '16px 20px', background: 'var(--bg-input)', borderRadius: 12, borderLeft: '3px solid var(--teal)' }}>
                    <p style={{ color: 'var(--text-primary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', fontSize: 14 }}>
                      {assessment.analyst_notes}
                    </p>
                  </div>
                </div>
              )}
              
            </div>
          </div>
        </div>

        <div style={{ flex: '1 1 35%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '24px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 20px 0' }}>Risk Matrix (5x5)</h4>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Likelihood
              </div>
              
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                  {[5, 4, 3, 2, 1].map((l) => (
                    <React.Fragment key={`row-${l}`}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <MatrixCell key={`${l}-${i}`} l={l} i={i} currentL={assessment.likelihood} currentI={assessment.impact} />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 8 }}>
                  Impact
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '20px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Score Calculation</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                  L({assessment.likelihood}) × I({assessment.impact}) = {assessment.overall_risk_score}
                </div>
              </div>
              <RiskBadge level={assessment.risk_level} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '24px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-heading)', margin: '0 0 20px 0' }}>Assessment Metadata</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Assessed By', value: assessment.assessor?.full_name || 'System' },
                { label: 'Created', value: assessment.created_at ? format(new Date(assessment.created_at), 'PPP') : 'N/A' },
                { label: 'Updated', value: assessment.updated_at ? format(new Date(assessment.updated_at), 'PPP') : 'N/A' },
              ].map(({ label, value }, i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: i !== 2 ? 12 : 0, borderBottom: i !== 2 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ fontSize: 14, color: 'var(--text-muted)', flexShrink: 0 }}>{label}</span>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'right', overflow: 'hidden' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function RiskDetail() {
  return (
    <ErrorBoundary>
      <RiskDetailContent />
    </ErrorBoundary>
  );
}
