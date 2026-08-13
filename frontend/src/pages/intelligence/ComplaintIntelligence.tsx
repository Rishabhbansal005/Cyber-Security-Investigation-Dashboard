import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import intelligenceApi, { type AnalyzeComplaintResponse, type ExtractedEntity } from '@/api/intelligence';
import casesApi from '@/api/cases';

function formatAnalyzeError(err: { response?: { data?: { detail?: unknown }; status?: number }; message?: string } | null) {
  if (!err) return 'Analysis failed.';
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => (typeof d === 'string' ? d : (d as { msg?: string }).msg || JSON.stringify(d))).join(' ');
  }
  if (err.response?.status === 401) {
    return 'Backend rejected the request. Restart the API and try again.';
  }
  if (err.response?.status === 404) {
    return 'Analyze API not found. Restart the FastAPI backend.';
  }
  if (!err.response) {
    return 'Cannot reach the backend. Start it on port 8000, then try again.';
  }
  return err.message || 'Analysis failed.';
}

function entityType(e: ExtractedEntity) {
  return e.type || e.entity_type || 'unknown';
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#64748b',
  marginBottom: 8,
};

function ResultCard({ item, showFull }: { item: AnalyzeComplaintResponse; showFull: boolean }) {
  const clf = item.classification;
  const scores = Object.entries(clf?.probabilities || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 5);
  const conf = clf?.confidence != null ? Math.round(clf.confidence * 100) : 0;

  return (
    <div className="row g-3">
      <div className="col-12">
        <div style={labelStyle}>Complaint</div>
        <div style={{
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 14,
          lineHeight: 1.6,
          color: '#e2e8f0',
          whiteSpace: 'pre-wrap',
        }}>
          {item.complaint_text?.replace(/^pasted-text\s*/i, '') || item.complaint_text}
        </div>
      </div>

      <div className="col-12 col-md-6">
        <div style={{
          height: '100%',
          borderRadius: 12,
          padding: 18,
          background: 'linear-gradient(180deg, rgba(99,102,241,0.12), rgba(8,13,22,0.6))',
          border: '1px solid rgba(129,140,248,0.22)',
        }}>
          <div style={labelStyle}>Predicted type</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 10 }}>
            {clf?.predicted_category || '—'}
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', marginBottom: 8, overflow: 'hidden' }}>
            <div style={{ width: `${conf}%`, height: '100%', background: '#818cf8', borderRadius: 99 }} />
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>Confidence {conf}%</div>
          {scores.map(([label, p]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: '#cbd5e1' }}>
              <span>{label}</span>
              <span className="font-mono" style={{ color: '#818cf8' }}>{Math.round(Number(p) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="col-12 col-md-6">
        <div style={{
          height: '100%',
          borderRadius: 12,
          padding: 18,
          background: 'linear-gradient(180deg, rgba(34,211,238,0.1), rgba(8,13,22,0.6))',
          border: '1px solid rgba(34,211,238,0.2)',
        }}>
          <div style={labelStyle}>Suggested priority</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
            {item.priority?.priority_label || '—'}
            <span style={{ fontSize: 14, color: '#67e8f9', marginLeft: 8 }}>{item.priority?.priority_score ?? '—'}/100</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#cbd5e1', lineHeight: 1.55 }}>
            {(item.priority?.reasons || []).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="col-12 col-md-6">
        <div style={{
          borderRadius: 12,
          padding: 16,
          background: 'rgba(8,13,22,0.55)',
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: 140,
        }}>
          <div style={labelStyle}>
            Phone / UPI / URL {showFull ? '· visible' : '· hidden digits'}
          </div>
          {(item.entities || []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>None found in this text.</p>
          ) : (
            <table className="table mb-0">
              <tbody>
                {item.entities.map((e, i) => (
                  <tr key={`${entityType(e)}-${i}`}>
                    <td style={{ fontSize: 12, textTransform: 'capitalize', color: '#94a3b8' }}>{entityType(e).replace('_', ' ')}</td>
                    <td className="font-mono" style={{ fontSize: 12, color: '#e2e8f0' }}>
                      {showFull ? e.value_raw : (e.value_masked || e.value_raw)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="col-12 col-md-6">
        <div style={{
          borderRadius: 12,
          padding: 16,
          background: 'rgba(8,13,22,0.55)',
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: 140,
        }}>
          <div style={labelStyle}>Similar cases</div>
          {(item.similar_cases || []).length === 0 ? (
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No close match in current FIRs.</p>
          ) : (
            <table className="table mb-0">
              <tbody>
                {item.similar_cases.map((s) => (
                  <tr key={s.case_id}>
                    <td>
                      <Link to={`/cases/${s.case_id}`} style={{ color: '#818cf8', fontSize: 13 }}>
                        {s.case_number || s.title || s.case_id}
                      </Link>
                    </td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{Math.round(s.similarity * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ComplaintIntelligence() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [caseId, setCaseId] = useState('');
  const [showFull, setShowFull] = useState(false);
  const [selected, setSelected] = useState(0);

  const { data: casesResponse } = useQuery({
    queryKey: ['cases', 'for-complaint-ai'],
    queryFn: () => casesApi.list({ page_size: 100 }),
  });
  const cases = casesResponse?.items || [];

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 8 * 1024 * 1024,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/pdf': ['.pdf'],
    },
  });

  const mutation = useMutation({
    mutationFn: () => intelligenceApi.analyzeFile({
      file: file || undefined,
      text: text.trim() || undefined,
      caseId: caseId || undefined,
    }),
    onSuccess: () => setSelected(0),
  });

  const err = mutation.error as { response?: { data?: { detail?: string }; status?: number } } | null;
  const result = mutation.data;
  const item = result?.items?.[selected];

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Complaint AI</h1>
          <p className="page-header-subtitle">
            Drop a complaint file or paste the FIR. The model suggests a crime type for officer review.
          </p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card" style={{ border: '1px solid rgba(129,140,248,0.15)' }}>
            <div className="card-body">
              <div style={labelStyle}>1. Input</div>
              <div
                {...getRootProps()}
                style={{
                  border: `1.5px dashed ${isDragActive || file ? '#818cf8' : 'rgba(148,163,184,0.35)'}`,
                  borderRadius: 12,
                  padding: '28px 18px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragActive ? 'rgba(99,102,241,0.12)' : 'rgba(15,23,42,0.65)',
                  marginBottom: 14,
                }}
              >
                <input {...getInputProps()} />
                <div style={{ fontSize: 22, marginBottom: 8 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                  {file ? file.name : 'Drop complaint file here'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                  Or click to browse · .txt / .csv / .json / .pdf · max 8 MB
                </div>
              </div>
              {file && (
                <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={() => setFile(null)}>
                  Remove file
                </button>
              )}

              <label className="form-label">Or type / paste the complaint</label>
              <textarea
                className="form-control"
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the complaint or FIR narrative…"
              />

              <label className="form-label" style={{ marginTop: 14 }}>Save against an FIR (optional)</label>
              <select className="form-select" value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">Do not save to a case</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>{c.case_number} — {c.title}</option>
                ))}
              </select>

              <button
                className="btn btn-primary"
                style={{ marginTop: 16, width: '100%', padding: '10px 16px', fontWeight: 600 }}
                disabled={mutation.isPending || (!file && !text.trim())}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? 'Analyzing…' : 'Analyze complaint'}
              </button>
              {err && (
                <div className="alert alert-danger mt-3" style={{ fontSize: 13 }}>
                  {formatAnalyzeError(err)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card h-100" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 0 }}>2. Result</div>
                {item && (item.entities || []).length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    title={showFull
                      ? 'Hide middle digits of phone, UPI, and email'
                      : 'Show the full phone, UPI, and email found in the text'}
                    onClick={() => setShowFull((v) => !v)}
                  >
                    {showFull ? 'Hide numbers' : 'Show numbers'}
                  </button>
                )}
              </div>

              {!item && !mutation.isPending && (
                <div className="empty-state" style={{ padding: 36 }}>
                  <div className="empty-state-title">Waiting for a complaint</div>
                  <div className="empty-state-text">
                    Use the box on the left: drop a file, or paste text, then Analyze.
                  </div>
                </div>
              )}
              {mutation.isPending && (
                <div style={{ color: '#94a3b8', fontSize: 13 }}>Reading the complaint…</div>
              )}
              {result && item && (
                <>
                  {result.items.length > 1 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {result.items.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          className={`btn btn-sm ${selected === i ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => setSelected(i)}
                        >
                          Row {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                  <ResultCard item={item} showFull={showFull} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
