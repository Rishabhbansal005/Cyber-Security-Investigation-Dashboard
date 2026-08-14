import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import intelligenceApi, {
  type AnalyzeComplaintResponse,
  type ExtractedEntity,
  type StoredAnalysis,
} from '@/api/intelligence';

function maskListValue(e: ExtractedEntity): string {
  return e.value_masked || e.value_raw;
}

function entityType(e: ExtractedEntity): string {
  return e.type || e.entity_type || 'unknown';
}

export default function CaseAiAnalysisTab({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [showFullEntities, setShowFullEntities] = React.useState(false);

  const analysisQuery = useQuery({
    queryKey: ['case-analysis', caseId],
    queryFn: () => intelligenceApi.getAnalysis(caseId),
    retry: false,
  });

  const entitiesQuery = useQuery({
    queryKey: ['case-entities', caseId],
    queryFn: () => intelligenceApi.getEntities(caseId),
    retry: false,
    enabled: !analysisQuery.isError,
  });

  const similarQuery = useQuery({
    queryKey: ['case-similar', caseId],
    queryFn: () => intelligenceApi.getSimilar(caseId),
    retry: false,
    enabled: !analysisQuery.isError,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => intelligenceApi.analyzeComplaint(caseId),
    onSuccess: (data: AnalyzeComplaintResponse) => {
      queryClient.invalidateQueries({ queryKey: ['case-analysis', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-entities', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case-similar', caseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-ml-stats'] });
      queryClient.setQueryData(['case-analysis-live', caseId], data);
    },
  });

  const live = queryClient.getQueryData<AnalyzeComplaintResponse>(['case-analysis-live', caseId]);
  const stored: StoredAnalysis | null | undefined = analysisQuery.data;
  const err = analyzeMutation.error as { response?: { data?: { detail?: string }; status?: number } } | null;
  const missingModel = err?.response?.status === 503;

  const category = live?.classification.predicted_category ?? stored?.predicted_category;
  const confidence = live?.classification.confidence ?? stored?.category_confidence;
  const scores = live?.classification.probabilities ?? stored?.category_scores ?? {};
  const reasons = live?.priority.reasons ?? stored?.explanation ?? [];
  const priorityLabel = live?.priority.priority_label ?? stored?.priority_label;
  const priorityScore = live?.priority.priority_score ?? stored?.priority_score;
  const features = live?.priority.features_used ?? stored?.features_used ?? [];
  const entities = live?.entities ?? entitiesQuery.data ?? [];
  const similar = live?.similar_cases ?? similarQuery.data ?? [];
  const disclaimer =
    live?.disclaimer ||
    stored?.disclaimer ||
    'Prototype trained on public/synthetic complaint text. Scores are model confidence, not legal certainty.';
  const complaintText = live?.complaint_text;

  const hasAny = Boolean(category || live);

  return (
    <div>
      <div style={{
        padding: '10px 14px',
        marginBottom: 16,
        borderRadius: 8,
        border: '1px solid rgba(245,158,11,0.35)',
        background: 'rgba(245,158,11,0.08)',
        color: '#fbbf24',
        fontSize: 12,
        lineHeight: 1.5,
      }}>
        Prototype / not legal certainty. Predictions require officer review. This does not determine guilt and does not freeze accounts or recommend arrest.
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>{disclaimer}</p>
        <button
          className="btn btn-primary"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? 'Analyzing…' : 'Analyze complaint'}
        </button>
      </div>

      {missingModel && (
        <div className="alert alert-danger">
          {err?.response?.data?.detail || 'Model not trained. Run the classifier and priority training scripts on the backend.'}
        </div>
      )}

      {analyzeMutation.isError && !missingModel && (
        <div className="alert alert-danger">
          {(err?.response?.data?.detail as string) || 'Analysis failed.'}
        </div>
      )}

      {!hasAny && !analyzeMutation.isPending && !analyzeMutation.isError && (
        <div className="empty-state">
          <div className="empty-state-title">No AI analysis yet</div>
          <div className="empty-state-text">
            Run analysis on this FIR’s title and description. Outputs are investigation leads for review, not legal findings.
          </div>
        </div>
      )}

      {hasAny && (
        <div className="row g-3">
          {complaintText && (
            <div className="col-12">
              <h6 style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Complaint text analyzed
              </h6>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{complaintText}</p>
            </div>
          )}

          <div className="col-12 col-md-6">
            <div className="card" style={{ background: 'rgba(8,13,22,0.5)' }}>
              <div className="card-body">
                <h6 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Predicted crime type
                </h6>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{category || '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Confidence {confidence != null ? `${Math.round(Number(confidence) * 100)}%` : '—'} · requires review
                </div>
                {Object.entries(scores)
                  .sort((a, b) => Number(b[1]) - Number(a[1]))
                  .slice(0, 6)
                  .map(([label, p]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                      <span>{label}</span>
                      <span className="font-mono">{Math.round(Number(p) * 100)}%</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div className="card" style={{ background: 'rgba(8,13,22,0.5)' }}>
              <div className="card-body">
                <h6 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                  Why this priority
                </h6>
                <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
                  {priorityLabel || '—'} · {priorityScore ?? '—'}/100
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                  Prototype score from documented features — not a police-labelled priority.
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)' }}>
                  {(Array.isArray(reasons) ? reasons : []).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {features.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                    Features used: {features.join(', ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h6 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', margin: 0 }}>
                Extracted entities {showFullEntities ? '(full — this case only)' : '(masked in list)'}
              </h6>
              {entities.length > 0 && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setShowFullEntities((v) => !v)}
                >
                  {showFullEntities ? 'Mask values' : 'Show full (detail)'}
                </button>
              )}
            </div>
            {entities.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>None extracted from complaint text.</p>
            ) : (
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {entities.map((e, i) => (
                    <tr key={`${entityType(e)}-${i}`}>
                      <td style={{ fontSize: 12, textTransform: 'capitalize' }}>{entityType(e).replace('_', ' ')}</td>
                      <td className="font-mono" style={{ fontSize: 12 }}>
                        {showFullEntities ? (e.value_raw || maskListValue(e)) : maskListValue(e)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="col-12 col-md-6">
            <h6 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              Potentially related cases
            </h6>
            {similar.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No similar complaints stored yet. Analyze more FIRs to compare.</p>
            ) : (
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Case</th>
                    <th>Similarity</th>
                  </tr>
                </thead>
                <tbody>
                  {similar.map((s) => (
                    <tr key={s.case_id}>
                      <td>
                        <Link to={`/cases/${s.case_id}`} style={{ color: '#818cf8', fontSize: 13 }}>
                          {s.case_number || s.title || s.case_id}
                        </Link>
                        {s.title && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.title}</div>
                        )}
                      </td>
                      <td className="font-mono" style={{ fontSize: 12 }}>
                        {Math.round(s.similarity * 100)}% · requires review
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
