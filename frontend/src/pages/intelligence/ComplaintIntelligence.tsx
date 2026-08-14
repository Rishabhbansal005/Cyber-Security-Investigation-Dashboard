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
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#64748b',
  marginBottom: 8,
};

const CRIME_TYPES = [
  'Financial Fraud', 'UPI Fraud', 'Phishing', 'Job/Employment Scam', 'Investment Scam',
  'Social Media Scam', 'Account Takeover', 'Identity Theft', 'Online Shopping Scam',
  'Sextortion', 'Cyberbullying/Harassment', 'Other',
];

function priorityTone(label?: string) {
  const u = (label || '').toUpperCase();
  if (u === 'HIGH') return { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)', color: '#fca5a5', pill: '#ef4444' };
  if (u === 'MEDIUM') return { bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.35)', color: '#fcd34d', pill: '#f59e0b' };
  return { bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)', color: '#6ee7b7', pill: '#10b981' };
}

function ResultCard({
  item,
  showFull,
}: {
  item: AnalyzeComplaintResponse;
  showFull: boolean;
}) {
  const clf = item.classification;
  const scores = Object.entries(clf?.probabilities || {}).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 4);
  const conf = clf?.confidence != null ? Math.round(clf.confidence * 100) : 0;
  const draft = item.ncrp_draft;
  const hits = item.identifier_hits || [];
  const [fbNote, setFbNote] = React.useState('');
  const [picked, setPicked] = React.useState(clf?.predicted_category || '');
  const tone = priorityTone(item.priority?.priority_label);

  React.useEffect(() => {
    setPicked(clf?.predicted_category || '');
    setFbNote('');
  }, [item.complaint_text, clf?.predicted_category]);

  const fb = useMutation({
    mutationFn: (agreed: boolean) => intelligenceApi.sendFeedback({
      complaint_text: item.complaint_text,
      predicted_category: clf?.predicted_category,
      correct_category: agreed ? (clf?.predicted_category || picked) : picked,
      agreed,
    }),
    onSuccess: (_, agreed) => setFbNote(
      agreed
        ? 'Classification confirmed. Logged for the next training cycle.'
        : 'Correction saved. It will be included the next time the model is trained.',
    ),
  });

  const copyDraft = () => {
    if (!draft) return;
    const lines = [
      `Category: ${draft.suggested_category || ''}`,
      `Amount (INR): ${draft.amount_lost_inr ?? ''}`,
      `UPI: ${draft.upi_id || ''}`,
      `Phone: ${draft.phone || ''}`,
      `URL: ${draft.url || ''}`,
      `Txn/UTR: ${draft.transaction_id || ''}`,
      `Email: ${draft.email || ''}`,
    ].join('\n');
    navigator.clipboard.writeText(lines);
    setFbNote('NCRP draft fields copied.');
  };

  const narrative = item.complaint_text?.replace(/^pasted-text\s*/i, '') || item.complaint_text;

  return (
    <div className="row g-3">
      <div className="col-12 col-md-7">
        <div style={{
          height: '100%',
          borderRadius: 14,
          padding: 20,
          background: 'linear-gradient(165deg, rgba(99,102,241,0.16), rgba(8,13,22,0.75))',
          border: '1px solid rgba(129,140,248,0.28)',
        }}>
          <div style={labelStyle}>Crime type</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {clf?.predicted_category || '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 6 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${conf}%`, height: '100%', background: '#818cf8', borderRadius: 99 }} />
            </div>
            <span style={{ fontSize: 12, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{conf}% confidence</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Other likely types</div>
          {scores.map(([label, p]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: '#cbd5e1' }}>
              <span>{label}</span>
              <span className="font-mono" style={{ color: '#a5b4fc' }}>{Math.round(Number(p) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="col-12 col-md-5">
        <div style={{
          height: '100%',
          borderRadius: 14,
          padding: 20,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
        }}>
          <div style={labelStyle}>Suggested priority</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#0b1220',
              background: tone.pill,
              borderRadius: 6,
              padding: '4px 10px',
            }}>
              {item.priority?.priority_label || '—'}
            </span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc' }}>
              {item.priority?.priority_score ?? '—'}<span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>/100</span>
            </span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 13, color: '#cbd5e1', lineHeight: 1.55 }}>
            {(item.priority?.reasons || []).slice(0, 4).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>
            Advisory score only. Does not freeze accounts or assign guilt.
          </div>
        </div>
      </div>

      <div className="col-12">
        <div style={labelStyle}>Narrative</div>
        <div style={{
          background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '14px 16px',
          fontSize: 14,
          lineHeight: 1.65,
          color: '#e2e8f0',
          whiteSpace: 'pre-wrap',
        }}>
          {narrative}
        </div>
      </div>

      <div className="col-12">
        <div style={{
          borderRadius: 12,
          padding: '14px 16px',
          background: 'rgba(15,23,42,0.55)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Officer confirmation</div>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 0, marginBottom: 12 }}>
            Confirm the type if it is correct, or choose the right category and save a correction.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <button type="button" className="btn btn-sm btn-primary" disabled={fb.isPending} onClick={() => fb.mutate(true)}>
              Confirm type
            </button>
            <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 220 }} value={picked} onChange={(e) => setPicked(e.target.value)}>
              {CRIME_TYPES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={fb.isPending} onClick={() => fb.mutate(false)}>
              Save correction
            </button>
          </div>
          {fbNote && <div style={{ fontSize: 12, color: '#86efac', marginTop: 10 }}>{fbNote}</div>}
        </div>
      </div>

      {draft && (
        <div className="col-12">
          <div style={{
            borderRadius: 12,
            padding: 16,
            background: 'rgba(8,13,22,0.55)',
            border: '1px solid rgba(251,191,36,0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ ...labelStyle, marginBottom: 0 }}>NCRP / 1930 draft</div>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={copyDraft}>Copy</button>
            </div>
            <div className="row g-2" style={{ fontSize: 13, color: '#e2e8f0' }}>
              {[
                ['Category', draft.suggested_category],
                ['Amount INR', draft.amount_lost_inr != null ? String(draft.amount_lost_inr) : '—'],
                ['UPI', draft.upi_id || '—'],
                ['Phone', draft.phone || '—'],
                ['URL', draft.url || '—'],
                ['UTR / Txn', draft.transaction_id || '—'],
              ].map(([k, v]) => (
                <div key={k} className="col-6 col-md-4">
                  <div style={{ color: '#64748b', fontSize: 11 }}>{k}</div>
                  <div className="font-mono" style={{ wordBreak: 'break-all' }}>{v || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hits.length > 0 && (
        <div className="col-12">
          <div style={{
            borderRadius: 12,
            padding: 16,
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.25)',
          }}>
            <div style={labelStyle}>Matching identifiers in other FIRs</div>
            {hits.map((h) => (
              <div key={`${h.type}-${h.value}`} style={{ fontSize: 13, color: '#fecdd3', marginBottom: 8 }}>
                <span className="font-mono">{h.type}: {h.value}</span>
                {' '}— {h.count} other case{h.count === 1 ? '' : 's'}
                <div>
                  {h.cases.map((c) => (
                    <Link key={c.case_id} to={`/cases/${c.case_id}`} style={{ color: '#818cf8', marginRight: 10, fontSize: 12 }}>
                      {c.case_number || c.title || c.case_id}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="col-12 col-md-6">
        <div style={{
          borderRadius: 12,
          padding: 16,
          background: 'rgba(8,13,22,0.55)',
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: 140,
        }}>
          <div style={labelStyle}>
            Extracted identifiers {showFull ? '· unmasked' : '· masked'}
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
          <h1 className="page-header-title">Complaint intelligence</h1>
          <p className="page-header-subtitle">
            Classify pasted or uploaded FIR text, extract identifiers, and draft NCRP fields. Predictions require officer review.
          </p>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card" style={{ border: '1px solid rgba(129,140,248,0.15)' }}>
            <div className="card-body">
              <div style={labelStyle}>Input</div>
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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#818cf8', marginBottom: 8 }}>Upload file</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                  {file ? file.name : 'Drop complaint here, or click to browse'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                  PDF, TXT, CSV, or JSON · max 8 MB · selectable text in PDFs
                </div>
              </div>
              {file && (
                <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={() => setFile(null)}>
                  Remove file
                </button>
              )}

              <label className="form-label">Paste complaint text</label>
              <textarea
                className="form-control"
                rows={7}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="English, Hindi, or Hinglish…"
              />

              <label className="form-label" style={{ marginTop: 14 }}>Link to an existing FIR (optional)</label>
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
                <div style={{ ...labelStyle, marginBottom: 0 }}>Analysis</div>
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
