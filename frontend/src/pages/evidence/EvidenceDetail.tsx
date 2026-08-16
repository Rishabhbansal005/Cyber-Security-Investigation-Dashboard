import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import evidenceApi from '@/api/evidence';
import { networkApi } from '@/api/network';
import { memoryApi } from '@/api/memory';
import browserApi from '@/api/browser';
import usbApi from '@/api/usb';
import { format } from 'date-fns';
import NetworkAnalysisView from './NetworkAnalysisView';
import MemoryAnalysisView from './MemoryAnalysisView';
import BrowserAnalysisView from './BrowserAnalysisView';
import UsbAnalysisView from './UsbAnalysisView';
import EventLogAnalysisView from './EventLogAnalysisView';
import eventLogsApi from '@/api/eventLogs';
import ImageAnalysisView from './ImageAnalysisView';
import imageApi from '@/api/image';
import CdrAnalysisView from './CdrAnalysisView';
import cdrApi from '@/api/cdr';
import FinancialAnalysisView from './FinancialAnalysisView';
import financialApi from '@/api/financial';

export default function EvidenceDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [verifying, setVerifying] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileUrlLoading, setFileUrlLoading] = useState(false);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const { data: ev, isLoading, error: queryError } = useQuery({
    queryKey: ['evidence', id],
    queryFn: () => evidenceApi.get(id!),
    enabled: !!id,
  });

  const verifyMutation = useMutation({
    mutationFn: () => evidenceApi.verifyIntegrity(id!),
    onMutate: () => setVerifying(true),
    onSuccess: (data) => {
      queryClient.setQueryData(['evidence', id], data);
      setVerifying(false);
    },
    onError: (err) => {
      console.error('Verification failed', err);
      setVerifying(false);
      alert('Verification failed. See console for details.');
    }
  });

  const isNetworkCapture = ev?.evidence_type === 'network_capture' || 
                           ev?.original_file_name.endsWith('.pcap') || 
                           ev?.original_file_name.endsWith('.pcapng');
                           
  const isMemoryDump = ev?.evidence_type === 'memory_dump' || 
                       ev?.original_file_name.endsWith('.raw') || 
                       ev?.original_file_name.endsWith('.mem') || 
                       ev?.original_file_name.endsWith('.dmp');

  const isBrowserArtifact = ev?.original_file_name.toLowerCase().includes('history') ||
                            ev?.original_file_name.toLowerCase().includes('places.sqlite') ||
                            ev?.original_file_name.toLowerCase().includes('bookmarks');

  const isUsbArtifact = ev?.original_file_name.toLowerCase().includes('system') ||
                        ev?.original_file_name.toLowerCase().includes('setupapi') ||
                        ev?.original_file_name.toLowerCase().endsWith('.lnk');

  const isEventLogArtifact = ev?.original_file_name.toLowerCase().endsWith('.evtx');
  
  const isCdrArtifact = ev?.original_file_name.toLowerCase().endsWith('.csv') && ev?.evidence_type === 'document';
  
  const isFinancialArtifact = ev?.original_file_name.toLowerCase().endsWith('.csv') && ev?.evidence_type === 'other';

  const handleAnalyzeNetwork = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await networkApi.analyze(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start network analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeMemory = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await memoryApi.analyze(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start memory analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeBrowser = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await browserApi.startAnalysis(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      // We also need to invalidate the specific analysis query so the UI updates
      queryClient.invalidateQueries({ queryKey: ['browser-analysis', ev.id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start browser analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeUsb = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await usbApi.startAnalysis(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['usb-analysis', ev.id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start USB analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeEventLogs = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await eventLogsApi.startAnalysis(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['event-log-analysis', ev.id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start Event Log analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await imageApi.analyze(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['image-analysis', ev.id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start image analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeCdr = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await cdrApi.analyze(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['cdr-analysis', ev.id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start CDR analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnalyzeFinancial = async () => {
    if (!ev) return;
    setAnalyzing(true);
    setError(null);
    try {
      await financialApi.analyze(ev.id);
      queryClient.invalidateQueries({ queryKey: ['evidence', id] });
      queryClient.invalidateQueries({ queryKey: ['financial-analysis', ev.id] });
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to start Financial analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewFile = async () => {
    if (!ev) return;
    setFileUrlLoading(true);
    try {
      const { signed_url } = await evidenceApi.getSignedUrl(ev.id, 300);
      window.open(signed_url, '_blank', 'noopener,noreferrer');
      // Also store it for inline preview of images
      setFilePreviewUrl(signed_url);
    } catch (err: any) {
      alert('Could not generate download link. The file may have been deleted from storage.');
    } finally {
      setFileUrlLoading(false);
    }
  };

  const imgExts = ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp'];
  const imgMimes = ['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'];
  const isImage = ev
    ? (imgMimes.includes(ev.mime_type || '') ||
       ev.evidence_type === 'screenshot' ||
       imgExts.some(ext => ev.original_file_name.toLowerCase().endsWith(ext)))
    : false;

  const isPdf = ev
    ? (ev.mime_type === 'application/pdf' || ev.original_file_name.toLowerCase().endsWith('.pdf'))
    : false;

  if (isLoading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border-color)', borderTopColor: 'var(--teal)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)' }}>Loading evidence...</div>
      </div>
    );
  }

  if (queryError || !ev) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🚫</div>
        <div className="empty-state-title">Evidence Not Found</div>
        <div className="empty-state-text">This evidence doesn't exist or you don't have access.</div>
        <button onClick={() => window.history.back()} className="btn btn-primary">Go Back</button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <Link to={`/cases/${ev.case_id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 13 }}>
              ← Back to Case
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span className="font-mono" style={{ color: 'var(--teal)', fontSize: 13 }}>
              {ev.evidence_number}
            </span>
          </div>
          <h1 className="page-header-title">{ev.original_file_name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
            {ev.is_verified ? (
              <span style={{ background: 'var(--success-muted)', color: 'var(--success)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid rgba(16,185,129,0.3)' }}>
                ✅ VERIFIED
              </span>
            ) : (
              <span style={{ background: 'rgba(100,116,139,0.15)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                ⚠️ UNVERIFIED
              </span>
            )}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {ev.evidence_type.replace('_', ' ')}
            </span>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleViewFile}
          disabled={fileUrlLoading}
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
        >
          {fileUrlLoading ? (
            <><span className="spinner-border spinner-border-sm" role="status" /> Opening...</>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                <path d="M4 14v3h12v-3" strokeLinecap="round"/>
                <path d="M10 3v10M7 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              View / Download File
            </>
          )}
        </button>
      </div>

      <div className="row g-4">
        {/* Left Column: Metadata */}
        <div className="col-12 col-md-5">
          <div className="card mb-4">
            <div className="card-body">
              <h6 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                File Details
              </h6>
              {[
                { label: 'Original Name', value: ev.original_file_name },
                { label: 'File Type', value: ev.file_type.toUpperCase() },
                { label: 'MIME Type', value: ev.mime_type || 'Unknown' },
                { label: 'File Size', value: `${(ev.file_size / 1024 / 1024).toFixed(2)} MB` },
                { label: 'Acquisition Method', value: ev.acquisition_method || 'N/A' },
                { label: 'Source Device', value: ev.source_device || 'N/A' },
                { label: 'Source Location', value: ev.source_location || 'N/A' },
                { label: 'Uploaded At', value: format(new Date(ev.uploaded_at), 'MMM d, yyyy HH:mm') },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Integrity Hashes */}
        <div className="col-12 col-md-7">
          <div className="card mb-4" style={{ border: ev.is_verified ? '1px solid rgba(16,185,129,0.4)' : undefined }}>
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <h6 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-heading)', marginBottom: 4 }}>
                    Cryptographic Integrity
                  </h6>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Cryptographic hashing ensures the evidence file has not been tampered with.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {isNetworkCapture && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeNetwork}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Network'}
                    </button>
                  )}
                  {isMemoryDump && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeMemory}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Memory'}
                    </button>
                  )}
                  {isBrowserArtifact && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeBrowser}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Browser'}
                    </button>
                  )}
                  {isUsbArtifact && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeUsb}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze USB'}
                    </button>
                  )}
                  {isEventLogArtifact && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeEventLogs}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Event Logs'}
                    </button>
                  )}
                  {isImage && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeImage}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Image'}
                    </button>
                  )}
                  {isCdrArtifact && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeCdr}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze CDR'}
                    </button>
                  )}
                  {isFinancialArtifact && (
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={handleAnalyzeFinancial}
                      disabled={analyzing}
                    >
                      {analyzing ? 'Analyzing...' : 'Analyze Financial'}
                    </button>
                  )}
                  {!ev.is_verified && (
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={() => verifyMutation.mutate()}
                      disabled={verifying}
                    >
                      {verifying ? 'Calculating...' : 'Verify Integrity'}
                    </button>
                  )}
                </div>
              </div>

              {[
                { label: 'MD5', value: ev.hash_md5 },
                { label: 'SHA1', value: ev.hash_sha1 },
                { label: 'SHA256', value: ev.hash_sha256 },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>
                    {label}
                  </div>
                  <div 
                    className="font-mono" 
                    style={{ 
                      background: 'var(--bg-input)', 
                      padding: '10px 14px', 
                      borderRadius: 6, 
                      fontSize: 13, 
                      color: value ? 'var(--text-primary)' : 'var(--text-secondary)',
                      wordBreak: 'break-all',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    {value || '(Click Verify Integrity to calculate)'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h6 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
                Chain of Custody
              </h6>
              {ev.chain_of_custody && ev.chain_of_custody.length > 0 ? (
                <div style={{ position: 'relative', paddingLeft: 20 }}>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: 7, width: 2, background: 'var(--border-color)' }}></div>
                  {ev.chain_of_custody.map((event, idx) => (
                    <div key={idx} style={{ position: 'relative', marginBottom: 20 }}>
                      <div style={{ position: 'absolute', left: -20, top: 4, width: 10, height: 10, borderRadius: '50%', background: 'var(--teal)', border: '2px solid var(--bg-card)' }}></div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)' }}>
                        {event.action.toUpperCase()}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                        {format(new Date(event.timestamp), 'MMM d, yyyy HH:mm')} by {event.user_name || 'System'}
                      </div>
                      {event.notes && (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{event.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No chain of custody records found.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Inline File Preview ──────────────────────────────── */}
      {filePreviewUrl && isImage && (
        <div className="card mb-4 mt-4" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">📎 File Preview — {ev.original_file_name}</span>
            <a href={filePreviewUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#818cf8', fontFamily: 'monospace' }}>
              Open in new tab ↗
            </a>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <img
              src={filePreviewUrl}
              alt={ev.original_file_name}
              style={{ width: '100%', maxHeight: 600, objectFit: 'contain', background: '#0a0e1a', display: 'block' }}
            />
          </div>
        </div>
      )}

      {filePreviewUrl && isPdf && (
        <div className="card mb-4 mt-4" style={{ overflow: 'hidden' }}>
          <div className="card-header">
            <span className="card-title">📄 File Preview — {ev.original_file_name}</span>
            <a href={filePreviewUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#818cf8', fontFamily: 'monospace' }}>
              Open in new tab ↗
            </a>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <iframe
              src={filePreviewUrl}
              title={ev.original_file_name}
              style={{ width: '100%', height: 600, border: 'none', background: '#fff' }}
            />
          </div>
        </div>
      )}

      {isNetworkCapture && (
        <div style={{ marginTop: 24 }}>
          <NetworkAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isMemoryDump && (
        <div style={{ marginTop: 24 }}>
          <MemoryAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isBrowserArtifact && (
        <div style={{ marginTop: 24 }}>
          <BrowserAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isUsbArtifact && (
        <div style={{ marginTop: 24 }}>
          <UsbAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isEventLogArtifact && (
        <div style={{ marginTop: 24 }}>
          <EventLogAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isImage && (
        <div style={{ marginTop: 24 }}>
          <ImageAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isCdrArtifact && (
        <div style={{ marginTop: 24 }}>
          <CdrAnalysisView evidenceId={ev.id} />
        </div>
      )}
      {isFinancialArtifact && (
        <div style={{ marginTop: 24 }}>
          <FinancialAnalysisView evidenceId={ev.id} />
        </div>
      )}
    </div>
  );
}
