import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation } from '@tanstack/react-query';
import imageAuthApi, { type ImageAuthCompare, type ImageAuthResult } from '@/api/imageAuth';

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#64748b',
  marginBottom: 8,
};

const accept = { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'] };

function formatError(err: { response?: { data?: { detail?: unknown }; status?: number }; message?: string } | null) {
  if (!err) return 'Analysis failed.';
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (err.response?.status === 503) return 'Model file missing. Train the image authenticity model first.';
  if (!err.response) return 'Cannot reach the backend. Start it on port 8000.';
  return err.message || 'Analysis failed.';
}

function concernTone(level?: string) {
  if (level === 'high') {
    return {
      bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.45)', color: '#fda4af', pill: '#f43f5e',
      label: 'LOOK CLOSER',
      simple: 'The legacy fake-face test flagged this image. An officer should review it. This is not legal proof.',
    };
  }
  if (level === 'medium') {
    return {
      bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: '#fcd34d', pill: '#f59e0b',
      label: 'NOT SURE',
      simple: 'The result is mixed. Do not record the image as genuine or fake. Request the original JPEG from the phone gallery.',
    };
  }
  if (level === 'inconclusive') {
    return {
      bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.35)', color: '#cbd5e1', pill: '#64748b',
      label: 'CANNOT SAY',
      simple: 'No clear face was found. Ignore the percentage score.',
    };
  }
  return {
    bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#6ee7b7', pill: '#10b981',
    label: 'OLD GAN TEST: NOTHING FOUND',
      simple: 'This check only covers older GAN faces. Modern AI, morphs, and face-swaps often score green. Green does not mean the photo is genuine.',
  };
}

function flagColor(level: string) {
  if (level === 'alert') return { border: 'rgba(244,63,94,0.4)', bg: 'rgba(244,63,94,0.1)', c: '#fda4af' };
  if (level === 'warn') return { border: 'rgba(245,158,11,0.4)', bg: 'rgba(245,158,11,0.1)', c: '#fde68a' };
  if (level === 'ok') return { border: 'rgba(16,185,129,0.35)', bg: 'rgba(16,185,129,0.08)', c: '#6ee7b7' };
  return { border: 'rgba(129,140,248,0.3)', bg: 'rgba(99,102,241,0.08)', c: '#c7d2fe' };
}

function DropBox({
  title, hint, file, preview, onFile,
}: {
  title: string; hint: string; file: File | null; preview: string | null;
  onFile: (f: File) => void;
}) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) onFile(accepted[0]);
  }, [onFile]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, multiple: false, maxSize: 12 * 1024 * 1024, accept,
  });
  return (
    <div>
      <div style={labelStyle}>{title}</div>
      <div
        {...getRootProps()}
        style={{
          border: `1.5px dashed ${isDragActive || file ? '#818cf8' : 'rgba(148,163,184,0.35)'}`,
          borderRadius: 12,
          padding: preview ? 10 : '24px 14px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragActive ? 'rgba(99,102,241,0.08)' : 'rgba(8,13,22,0.45)',
        }}
      >
        <input {...getInputProps()} />
        {preview ? (
          <img src={preview} alt="" style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, objectFit: 'contain' }} />
        ) : (
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{hint}</div>
        )}
      </div>
      {file && <div className="font-mono" style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>{file.name} · {(file.size / 1024).toFixed(0)} KB</div>}
    </div>
  );
}

function aiTone(screen?: ImageAuthResult['ai_screen']) {
  if (!screen?.available) {
    return {
      bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.3)', color: '#94a3b8',
      label: 'AI VS REAL: NOT TRAINED YET',
      simple: 'The diffusion / DALL-E / Midjourney screen is not on this server yet. Only the old GAN-face test ran.',
    };
  }
  if (screen.concern_level === 'high') {
    return {
      bg: 'rgba(244,63,94,0.14)', border: 'rgba(244,63,94,0.45)', color: '#fda4af',
      label: 'AI VS REAL: LOOK CLOSER',
      simple: 'This still-image screen found traces typical of public diffusion / DALL-E / Midjourney data. It is a lead, not legal proof.',
    };
  }
  if (screen.concern_level === 'medium') {
    return {
      bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)', color: '#fcd34d',
      label: 'AI VS REAL: NOT SURE',
      simple: 'Mixed result. Do not record the image as AI-generated or as a camera photograph.',
    };
  }
  return {
    bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.35)', color: '#6ee7b7',
    label: 'AI VS REAL: NOTHING FOUND',
    simple: 'This check did not fire. ChatGPT Images, Flux, and new generators can still look clean. Green does not mean genuine.',
  };
}

function ResultPanel({ result, title }: { result: ImageAuthResult; title?: string }) {
  const tone = concernTone(result.concern_level);
  const ai = aiTone(result.ai_screen);
  const pct = Math.round((result.aggregate_manipulated_probability || 0) * 100);
  const aiPct = result.ai_screen?.available && result.ai_screen.ai_generated_probability != null
    ? Math.round(result.ai_screen.ai_generated_probability * 100)
    : null;
  const [noteLang, setNoteLang] = useState<'hi' | 'en'>('en');
  const note = result.case_note?.[noteLang] || '';

  return (
    <div className="d-flex flex-column gap-3">
      {title && <div style={{ ...labelStyle, color: '#818cf8', marginBottom: 0 }}>{title}</div>}
      <div style={{
        borderRadius: 14, padding: 18,
        background: `linear-gradient(165deg, ${tone.bg}, rgba(8,13,22,0.85))`,
        border: `1px solid ${tone.border}`,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: tone.color }}>{tone.label}</div>
        <div style={{ fontSize: 14, color: '#e2e8f0', marginTop: 6, lineHeight: 1.45 }}>{tone.simple}</div>
        <div className="font-mono" style={{ marginTop: 10, color: '#f8fafc' }}>{pct}% old GAN-face</div>
      </div>

      <div style={{
        borderRadius: 14, padding: 18,
        background: `linear-gradient(165deg, ${ai.bg}, rgba(8,13,22,0.85))`,
        border: `1px solid ${ai.border}`,
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: ai.color }}>{ai.label}</div>
        <div style={{ fontSize: 14, color: '#e2e8f0', marginTop: 6, lineHeight: 1.45 }}>{ai.simple}</div>
        <div className="font-mono" style={{ marginTop: 10, color: '#f8fafc' }}>
          {aiPct == null ? 'Model not loaded' : `${aiPct}% AI-generated (diffusion screen)`}
        </div>
      </div>

      {(result.flags || []).map((f) => {
        const c = flagColor(f.level);
        return (
          <div key={f.en} style={{ borderRadius: 10, padding: 12, border: `1px solid ${c.border}`, background: c.bg }}>
            <div style={{ fontSize: 13, color: c.c, lineHeight: 1.5 }}>{f.en}</div>
          </div>
        );
      })}

      <div className="card" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div style={labelStyle}>Case diary note (copy for FIR / NCRP)</div>
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setNoteLang(noteLang === 'hi' ? 'en' : 'hi')}>
                {noteLang === 'hi' ? 'English' : 'हिंदी'}
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => navigator.clipboard.writeText(note)}>
                Copy note
              </button>
            </div>
          </div>
          <pre style={{
            whiteSpace: 'pre-wrap', fontSize: 12, color: '#e2e8f0', margin: 0,
            background: 'rgba(8,13,22,0.6)', padding: 12, borderRadius: 8,
          }}>{note}</pre>
        </div>
      </div>

      <div className="card" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="card-body">
          <div style={labelStyle}>What is inside this file</div>
          <table className="table mb-0">
            <tbody>
              {(result.file_facts?.rows || []).map((row) => (
                <tr key={row.label}>
                  <td style={{ width: '34%', fontSize: 13, color: '#94a3b8', verticalAlign: 'top' }}>{row.label}</td>
                  <td style={{ fontSize: 13, color: '#e2e8f0', wordBreak: 'break-all' }}>
                    {row.value}
                    {row.plain && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{row.plain}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="card-body">
          <div style={labelStyle}>Camera diary</div>
          <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{result.camera_diary?.plain}</p>
          <table className="table mb-0">
            <tbody>
              {(result.camera_diary?.rows || []).map((row) => (
                <tr key={row.label}>
                  <td style={{ width: '42%', fontSize: 13, color: '#94a3b8' }}>{row.label}</td>
                  <td style={{ fontSize: 13, color: row.present === false ? '#fcd34d' : '#e2e8f0' }}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.ela_png && (
        <div className="card" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="card-body">
            <div style={labelStyle}>Edit heat (ELA)</div>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>
              Bright patches can indicate uneven re-saving or editing. This is an investigative aid, not proof.
            </p>
            <img src={result.ela_png} alt="ELA" style={{ maxWidth: '100%', borderRadius: 8 }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ImageAuthenticity() {
  const [mode, setMode] = useState<'one' | 'two'>('two');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [victim, setVictim] = useState<File | null>(null);
  const [disputed, setDisputed] = useState<File | null>(null);
  const [vPrev, setVPrev] = useState<string | null>(null);
  const [dPrev, setDPrev] = useState<string | null>(null);

  const setOne = (f: File) => {
    setFile(f);
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(f); });
  };
  const setV = (f: File) => {
    setVictim(f);
    setVPrev((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(f); });
  };
  const setD = (f: File) => {
    setDisputed(f);
    setDPrev((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(f); });
  };

  const oneMut = useMutation({ mutationFn: () => imageAuthApi.analyze(file as File) });
  const twoMut = useMutation({
    mutationFn: () => imageAuthApi.compare(victim as File, disputed as File),
  });

  const oneErr = oneMut.error as { response?: { data?: { detail?: unknown }; status?: number }; message?: string } | null;
  const twoErr = twoMut.error as { response?: { data?: { detail?: unknown }; status?: number }; message?: string } | null;
  const cmp = twoMut.data as ImageAuthCompare | undefined;

  const tab = (id: 'one' | 'two', text: string) => (
    <button
      type="button"
      onClick={() => setMode(id)}
      style={{
        padding: '8px 14px',
        borderRadius: 8,
        border: mode === id ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
        background: mode === id ? 'rgba(99,102,241,0.2)' : 'transparent',
        color: mode === id ? '#e0e7ff' : '#94a3b8',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {text}
    </button>
  );

  return (
    <div className="animate-in">
      <div style={{
        height: 3, borderRadius: 99, marginBottom: 18,
        background: 'linear-gradient(90deg, #FF9933 0 33%, #ffffff 33% 66%, #138808 66% 100%)', opacity: 0.85,
      }} />

      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <div style={{ ...labelStyle, color: '#818cf8', marginBottom: 6 }}>Cyber Crime Cell · Screening assist</div>
          <h1 className="page-header-title">Image Authenticity</h1>
        </div>
      </div>

      <div className="card mb-3" style={{ border: '1px solid rgba(129,140,248,0.2)' }}>
        <div className="card-body">
          <div style={labelStyle}>Officer checklist</div>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7 }}>
            <li>Obtain the <strong>original JPEG</strong> from the phone gallery, not only a WhatsApp forward.</li>
            <li>Upload the alleged misused image separately under <strong>Compare two files</strong>.</li>
            <li>Copy both SHA-256 fingerprints into the case diary.</li>
            <li>Do not record a green GAN score as “genuine photograph.” Newer AI images are often missed.</li>
            <li>Attach the profile URL, date, and screenshots to the NCRP / FIR.</li>
          </ol>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3">
        {tab('two', 'Compare two files')}
        {tab('one', 'Single file')}
      </div>

      {mode === 'two' ? (
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card" style={{ border: '1px solid rgba(129,140,248,0.18)' }}>
              <div className="card-body d-flex flex-column gap-3">
                <DropBox title="1. Complainant original (gallery)" hint="Drop the victim’s original photograph" file={victim} preview={vPrev} onFile={setV} />
                <DropBox title="2. Disputed / alleged misuse" hint="Drop the photograph being circulated or misused" file={disputed} preview={dPrev} onFile={setD} />
                <button
                  className="btn btn-primary w-100"
                  disabled={!victim || !disputed || twoMut.isPending}
                  onClick={() => twoMut.mutate()}
                >
                  {twoMut.isPending ? 'Comparing…' : 'Compare both photos'}
                </button>
                {twoErr && twoMut.isError && <div style={{ fontSize: 13, color: '#fda4af' }}>{formatError(twoErr)}</div>}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-7">
            {!cmp ? (
              <div className="card" style={{ minHeight: 240, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="card-body" style={{ color: '#cbd5e1', fontSize: 14, lineHeight: 1.65 }}>
                  <div style={labelStyle}>What this tab does</div>
                  <p style={{ marginBottom: 10 }}>
                    You submit two files. The system does <strong>not</strong> decide whether a face was swapped or generated by AI. It compares the <strong>files</strong>:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li>Whether both files are byte-for-byte the same (identical SHA-256 hash).</li>
                    <li>File type, size, and dimensions for each.</li>
                    <li>Whether camera metadata (phone, time, GPS) is present or stripped.</li>
                    <li>A legacy GAN-face screen and a separate AI vs real still-image screen, plus an edit-heat (ELA) preview.</li>
                    <li>A short note you can copy into the case diary or NCRP.</li>
                  </ul>
                  <p style={{ marginTop: 12, marginBottom: 0, color: '#94a3b8' }}>
                    Typical use: complainant’s gallery original versus a profile or chat image alleged to be misused.
                  </p>
                </div>
              </div>
            ) : (
              <div className="d-flex flex-column gap-3">
                <div className="card" style={{
                  border: cmp.comparison.same_file ? '1px solid rgba(245,158,11,0.45)' : '1px solid rgba(129,140,248,0.35)',
                  background: 'rgba(99,102,241,0.08)',
                }}>
                  <div className="card-body">
                    <div style={labelStyle}>What this means for the case</div>
                    <p style={{ fontSize: 15, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.5 }}>{cmp.comparison.summary_en}</p>
                    <div style={{ fontSize: 13, color: '#a5b4fc' }}><strong>Recommended next step:</strong> {cmp.comparison.next_en}</div>
                  </div>
                </div>
                <ResultPanel result={cmp.victim} title="Complainant original" />
                <ResultPanel result={cmp.disputed} title="Disputed / alleged misuse" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card" style={{ border: '1px solid rgba(129,140,248,0.18)' }}>
              <div className="card-body">
                <DropBox title="Evidence image" hint="Drop a still photograph" file={file} preview={preview} onFile={setOne} />
                <button
                  className="btn btn-primary w-100 mt-3"
                  disabled={!file || oneMut.isPending}
                  onClick={() => oneMut.mutate()}
                >
                  {oneMut.isPending ? 'Screening…' : 'Run screen'}
                </button>
                {oneErr && oneMut.isError && <div className="mt-2" style={{ fontSize: 13, color: '#fda4af' }}>{formatError(oneErr)}</div>}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-7">
            {oneMut.data ? <ResultPanel result={oneMut.data} /> : (
              <div className="card" style={{ minHeight: 200, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="card-body" style={{ color: '#94a3b8' }}>Upload one image to screen it, or use Compare two files for a complainant-versus-disputed pair.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
