import React, { useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import casesApi from '@/api/cases';
import type { EvidenceType, Case } from '@/types';

const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'forensic_uploads';

const EVIDENCE_TYPES: { value: EvidenceType; label: string; icon: string }[] = [
  { value: 'digital',         label: 'Digital File',           icon: '💾' },
  { value: 'network_capture', label: 'Network Capture (PCAP)', icon: '📡' },
  { value: 'memory_dump',     label: 'Memory Dump',            icon: '🧠' },
  { value: 'disk_image',      label: 'Disk Image',             icon: '💿' },
  { value: 'log_file',        label: 'Log File',               icon: '📋' },
  { value: 'document',        label: 'Document',               icon: '📄' },
  { value: 'screenshot',      label: 'Screenshot',             icon: '🖼️' },
  { value: 'email',           label: 'Email Export',           icon: '📧' },
  { value: 'other',           label: 'Other',                  icon: '📁' },
];

interface UploadState {
  file: File | null;
  progress: number;
  status: 'idle' | 'uploading' | 'success' | 'error';
  errorMsg: string;
  evidenceId: string | null;
}

/** Compute a simple hash using the browser's SubtleCrypto API */
async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function EvidenceUpload() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCase = searchParams.get('case') ?? '';
  const queryClient = useQueryClient();
  const { supabaseUser } = useAuth();

  const [uploadState, setUploadState] = useState<UploadState>({
    file: null,
    progress: 0,
    status: 'idle',
    errorMsg: '',
    evidenceId: null,
  });

  const [form, setForm] = useState({
    case_id: preselectedCase,
    evidence_type: 'digital' as EvidenceType,
    source_device: '',
    source_location: '',
    acquisition_method: '',
    tags: '',
  });

  // Load cases directly via API (so mock cases and permissions are handled consistently)
  const { data: casesResponse } = useQuery({
    queryKey: ['cases', 'for-upload'],
    queryFn: () => casesApi.list({ page_size: 100 }),
  });
  const cases = casesResponse?.items || [];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setUploadState((s) => ({ ...s, file: acceptedFiles[0], status: 'idle', errorMsg: '' }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 500 * 1024 * 1024, // 500MB
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadState.file || !form.case_id || !supabaseUser) return;

    setUploadState((s) => ({ ...s, status: 'uploading', progress: 5, errorMsg: '' }));

    const file = uploadState.file;
    const userId = supabaseUser.id;

    try {
      // ── Step 1: Compute SHA-256 hash in browser (best-effort, ~1-2s for small files)
      setUploadState((s) => ({ ...s, progress: 10 }));
      let sha256 = '';
      try {
        sha256 = await computeSHA256(file);
      } catch {
        // Non-fatal: hash computation may fail for very large files
        console.warn('[Evidence] Could not compute SHA-256 in browser');
      }

      // ── Step 2: Upload file to Supabase Storage
      setUploadState((s) => ({ ...s, progress: 20 }));
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${userId}/${form.case_id}/${timestamp}_${safeName}`;

      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }
      setUploadState((s) => ({ ...s, progress: 70 }));

      // ── Step 3: Parse tags
      const tagsArray = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [];

      // ── Step 4: Insert metadata into public.evidence
      const { data: evidenceRow, error: dbError } = await supabase
        .from('evidence')
        .insert({
          case_id: form.case_id,
          file_name: safeName,
          original_file_name: file.name,
          file_type: file.name.split('.').pop()?.toLowerCase() || 'unknown',
          mime_type: file.type || null,
          file_size: file.size,
          storage_path: storagePath,
          storage_bucket: STORAGE_BUCKET,
          hash_sha256: sha256 || null,
          evidence_type: form.evidence_type,
          source_device: form.source_device || null,
          source_location: form.source_location || null,
          acquisition_method: form.acquisition_method || null,
          tags: tagsArray,
          uploaded_by: userId,
          chain_of_custody: JSON.stringify([{
            action: 'uploaded',
            user_id: userId,
            timestamp: new Date().toISOString(),
            notes: `Uploaded via CCID web interface. File: ${file.name}`,
          }]),
        })
        .select('id')
        .single();

      if (dbError) {
        // Attempt to clean up the uploaded file if DB insert fails
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      setUploadState((s) => ({
        ...s,
        progress: 100,
        status: 'success',
        evidenceId: evidenceRow?.id ?? null,
      }));

      // Invalidate evidence cache for this case
      queryClient.invalidateQueries({ queryKey: ['evidence', form.case_id] });
      queryClient.invalidateQueries({ queryKey: ['cases', 'dashboard-direct'] });

      // Auto-redirect to case detail after 2s
      setTimeout(() => navigate(`/cases/${form.case_id}`), 2000);

    } catch (err: unknown) {
      setUploadState((s) => ({
        ...s,
        status: 'error',
        progress: 0,
        errorMsg: err instanceof Error ? err.message : 'Upload failed. Please try again.',
      }));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // ── Success Screen
  if (uploadState.status === 'success') {
    return (
      <div style={{ maxWidth: 700 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '56px 40px' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
            <h2 style={{ color: 'var(--success)', marginBottom: 12 }}>Evidence Uploaded!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 8, maxWidth: 420, margin: '0 auto 16px' }}>
              The file has been securely stored in Supabase Storage and the metadata recorded in the database.
            </p>
            {uploadState.evidenceId && (
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 24 }}>
                Evidence ID: {uploadState.evidenceId}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to={`/cases/${form.case_id}`} className="btn btn-primary">
                View Case →
              </Link>
              <button
                className="btn btn-outline-secondary"
                onClick={() => {
                  setUploadState({ file: null, progress: 0, status: 'idle', errorMsg: '', evidenceId: null });
                  setForm((f) => ({ ...f, tags: '', source_device: '', source_location: '', acquisition_method: '' }));
                }}
              >
                Upload Another
              </button>
            </div>
            <div style={{ marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
              Redirecting to case in 2 seconds...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Upload Form
  return (
    <div style={{ maxWidth: 700 }}>
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Upload Evidence</h1>
          <p className="page-header-subtitle">
            Upload digital evidence to Supabase Storage with SHA-256 hash verification
          </p>
        </div>
      </div>

      <form onSubmit={handleUpload} noValidate>
        {/* File Drop Zone */}
        <div className="card mb-4">
          <div className="card-header">
            <h6 style={{ fontWeight: 700, margin: 0, fontSize: 14 }}>Evidence File</h6>
          </div>
          <div className="card-body">
            <div
              {...getRootProps()}
              className={`dropzone${isDragActive ? ' active' : ''}`}
            >
              <input {...getInputProps()} id="evidence-file-input" />
              {uploadState.file ? (
                <div>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📎</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {uploadState.file.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {formatFileSize(uploadState.file.size)} · {uploadState.file.type || 'Unknown type'}
                  </div>
                  <button
                    type="button"
                    style={{ marginTop: 12, background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
                    onClick={(e) => { e.stopPropagation(); setUploadState((s) => ({ ...s, file: null })); }}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="dropzone-icon">📁</div>
                  <div className="dropzone-text">
                    {isDragActive ? 'Drop the file here...' : 'Drag & drop evidence file here, or click to browse'}
                  </div>
                  <div className="dropzone-hint">Max 500MB · All file types accepted</div>
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploadState.status === 'uploading' && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>
                    {uploadState.progress < 20
                      ? 'Computing SHA-256 hash...'
                      : uploadState.progress < 70
                      ? 'Uploading to Supabase Storage...'
                      : 'Recording metadata...'}
                  </span>
                  <span>{uploadState.progress}%</span>
                </div>
                <div className="progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${uploadState.progress}%`, transition: 'width 0.4s ease' }}
                  />
                </div>
              </div>
            )}

            {uploadState.errorMsg && (
              <div className="alert alert-danger mt-3" style={{ fontSize: 13 }}>
                ⚠️ {uploadState.errorMsg}
                {uploadState.errorMsg.includes('not found') || uploadState.errorMsg.includes('bucket') ? (
                  <div style={{ marginTop: 8, fontSize: 11 }}>
                    💡 Tip: Make sure you have run <code>setup_storage.sql</code> in your Supabase SQL Editor to create the storage bucket.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Evidence Metadata */}
        <div className="card mb-4">
          <div className="card-header">
            <h6 style={{ fontWeight: 700, margin: 0, fontSize: 14 }}>Evidence Metadata</h6>
          </div>
          <div className="card-body">
            {/* Case Selector */}
            <div className="mb-3">
              <label htmlFor="ev-case-id" className="form-label">
                Investigation Case <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                id="ev-case-id"
                name="case_id"
                className="form-select"
                value={form.case_id}
                onChange={handleChange}
                required
              >
                <option value="">Select a case...</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.case_number} — {c.title}
                  </option>
                ))}
              </select>
              {cases.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  No cases found. <Link to="/cases/new" style={{ color: 'var(--teal)' }}>Create a case first</Link>.
                </div>
              )}
            </div>

            {/* Evidence Type */}
            <div className="mb-3">
              <label className="form-label">Evidence Type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EVIDENCE_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, evidence_type: t.value }))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      border: `1px solid ${form.evidence_type === t.value ? 'var(--teal)' : 'var(--border-color)'}`,
                      background: form.evidence_type === t.value ? 'var(--teal-muted)' : 'var(--bg-input)',
                      color: form.evidence_type === t.value ? 'var(--teal)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      transition: 'var(--transition)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label htmlFor="ev-source-device" className="form-label">Source Device</label>
                <input
                  id="ev-source-device"
                  name="source_device"
                  className="form-control"
                  placeholder="e.g., Dell Latitude 7420"
                  value={form.source_device}
                  onChange={handleChange}
                />
              </div>
              <div className="col-12 col-md-6">
                <label htmlFor="ev-source-location" className="form-label">Source Location</label>
                <input
                  id="ev-source-location"
                  name="source_location"
                  className="form-control"
                  placeholder="e.g., Server Room B, Rack 3"
                  value={form.source_location}
                  onChange={handleChange}
                />
              </div>
              <div className="col-12">
                <label htmlFor="ev-acquisition" className="form-label">Acquisition Method</label>
                <input
                  id="ev-acquisition"
                  name="acquisition_method"
                  className="form-control"
                  placeholder="e.g., FTK Imager forensic copy, Live acquisition via winpmem"
                  value={form.acquisition_method}
                  onChange={handleChange}
                />
              </div>
              <div className="col-12">
                <label htmlFor="ev-tags" className="form-label">Tags (comma-separated)</label>
                <input
                  id="ev-tags"
                  name="tags"
                  className="form-control"
                  placeholder="malware, network, windows"
                  value={form.tags}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Info Banner */}
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'rgba(0,212,255,0.05)', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
              <span>🔐</span>
              <span>
                SHA-256 hash is computed in your browser before upload. File is stored in a private Supabase Storage bucket.
                Chain of custody is recorded automatically.
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button
            id="btn-upload-evidence"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={!uploadState.file || !form.case_id || uploadState.status === 'uploading'}
          >
            {uploadState.status === 'uploading' ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                {uploadState.progress < 20 ? 'Hashing...' : 'Uploading...'}
              </>
            ) : (
              '⬆️ Upload Evidence'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
