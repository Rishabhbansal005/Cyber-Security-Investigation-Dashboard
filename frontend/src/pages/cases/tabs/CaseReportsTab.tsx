import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import apiClient from '@/api/client';
import { format } from 'date-fns';
import { ReportStatusBadge } from '../../reports/ReportList';
import { useAuth } from '@/context/AuthContext';

export default function CaseReportsTab({ caseId, caseNumber }: { caseId: string, caseNumber: string }) {
  const [showGenerate, setShowGenerate] = useState(false);
  const [reportFormat, setReportFormat] = useState<'pdf' | 'ppt'>('pdf');
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState({
    include_executive_summary: true,
    include_evidence_list: true,
    include_findings: true,
    include_timeline: true,
    include_risk_assessment: true,
  });

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['case_reports', caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select(`*, generator:users!reports_generated_by_fkey(full_name)`)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const data = query.state.data as any[] | undefined;
      return data?.some(r => r.status === 'generating') ? 5000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        case_id: caseId,
        title: title || `Investigation Report - ${caseNumber}`,
        report_type: 'investigation',
        report_format: reportFormat,
        ...sections
      };
      const res = await apiClient.post('/reports', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case_reports', caseId] });
      setShowGenerate(false);
      setTitle('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || err.message || 'Failed to generate report');
    }
  });

  const handleDownload = async (reportId: string) => {
    try {
      const res = await apiClient.get(`/reports/${reportId}/download`);
      window.open(res.data.download_url, '_blank');
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Failed to download report');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case_reports', caseId] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || err.message || 'Failed to delete report');
    }
  });

  if (showGenerate) {
    return (
      <div className="animate-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Generate Report</h3>
          <button className="btn btn-outline-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
        </div>

        <div className="card" style={{ maxWidth: 800 }}>
          <div className="card-body" style={{ padding: '32px' }}>
            <h3 style={{ color: 'var(--text-heading)', marginBottom: 24 }}>Report Configuration</h3>
            
            <div className="mb-4">
              <label className="form-label">Report Title</label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`e.g. Investigation Report - ${caseNumber}`}
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Report Format</label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="report_format"
                    checked={reportFormat === 'pdf'}
                    onChange={() => setReportFormat('pdf')}
                    style={{ accentColor: 'var(--teal)' }}
                  />
                  <span>PDF Document</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="report_format"
                    checked={reportFormat === 'ppt'}
                    onChange={() => setReportFormat('ppt')}
                    style={{ accentColor: 'var(--teal)' }}
                  />
                  <span>AI PPT Presentation</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="form-label" style={{ marginBottom: 16 }}>Included Sections</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'include_executive_summary', label: 'Executive Summary', desc: 'High-level overview of the case and outcome' },
                  { key: 'include_evidence_list', label: 'Evidence List', desc: 'Detailed log of all acquired evidence and chain of custody' },
                  { key: 'include_findings', label: 'Findings', desc: 'Identified artifacts, IOCs, and MITRE ATT&CK mapping' },
                  { key: 'include_timeline', label: 'Timeline', desc: 'Chronological sequence of events' },
                  { key: 'include_risk_assessment', label: 'Risk Assessment', desc: 'Risk matrix scoring, assets, and mitigation' },
                ].map(({ key, label, desc }) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', padding: '16px', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                    <input
                      type="checkbox"
                      checked={(sections as any)[key]}
                      onChange={(e) => setSections({ ...sections, [key]: e.target.checked })}
                      style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--teal)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '32px 0 24px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-outline-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                {generateMutation.isPending ? 'Initiating Generation...' : (reportFormat === 'ppt' ? 'Generate AI PPT' : 'Generate Report')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const [show65bGenerate, setShow65bGenerate] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('');
  
  const { data: evidenceList = [], isLoading: isEvidenceLoading } = useQuery({
    queryKey: ['case_evidence_for_65b', caseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evidence')
        .select('*')
        .eq('case_id', caseId);
      if (error) throw error;
      return data;
    },
    enabled: show65bGenerate
  });

  const handleDownload65b = async () => {
    if (!selectedEvidenceId) return;
    try {
      window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/reports/65b/${selectedEvidenceId}`, '_blank');
      setShow65bGenerate(false);
      setSelectedEvidenceId('');
    } catch (err: any) {
      alert(err.message || 'Failed to download 65B Certificate');
    }
  };

  if (show65bGenerate) {
    return (
      <div className="animate-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Generate Section 65B Certificate</h3>
          <button className="btn btn-outline-secondary" onClick={() => setShow65bGenerate(false)}>Cancel</button>
        </div>

        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-body" style={{ padding: '32px' }}>
            <h3 style={{ color: 'var(--text-heading)', marginBottom: 24 }}>Certificate Details</h3>
            
            <div className="mb-4">
              <label className="form-label">Select Evidence</label>
              <select 
                className="form-select" 
                value={selectedEvidenceId} 
                onChange={(e) => setSelectedEvidenceId(e.target.value)}
                disabled={isEvidenceLoading}
              >
                <option value="">-- Select an Evidence Item --</option>
                {evidenceList.map((ev: any) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.evidence_number} - {ev.original_file_name}
                  </option>
                ))}
              </select>
              {isEvidenceLoading && <div className="mt-2 text-muted" style={{ fontSize: 12 }}>Loading evidence...</div>}
              {evidenceList.length === 0 && !isEvidenceLoading && (
                <div className="mt-2 text-danger" style={{ fontSize: 12 }}>No evidence found for this case. Upload evidence first.</div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '32px 0 24px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-outline-secondary" onClick={() => setShow65bGenerate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleDownload65b} disabled={!selectedEvidenceId}>
                Download Certificate
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>Case Reports</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0 0' }}>Generate and view PDF and PPT reports</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline-primary" onClick={() => setShow65bGenerate(true)}>
            + Generate 65B Certificate
          </button>
          <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>
            + Generate Report
          </button>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ padding: 24 }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 60, marginBottom: 12, borderRadius: 8 }} />)}
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📄</div>
            <div className="empty-state-title">No reports generated</div>
            <div className="empty-state-text">Click the button above to generate a new investigation report.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-clickable">
              <thead>
                <tr>
                  <th>Report Title</th>
                  <th>Status</th>
                  <th>Generated By</th>
                  <th>Date</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r: any) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                      {r.file_size && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {(r.file_size / 1024 / 1024).toFixed(2)} MB
                        </div>
                      )}
                    </td>
                    <td><ReportStatusBadge status={r.status} /></td>
                    <td style={{ fontSize: 13 }}>{r.generator?.full_name || 'System'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {r.generated_at ? format(new Date(r.generated_at), 'MMM d, HH:mm') : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleDownload(r.id)}
                          disabled={r.status !== 'ready'}
                          style={{ padding: '4px 10px' }}
                        >
                          ↓ Download
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => {
                              if (confirm('Delete this report?')) deleteMutation.mutate(r.id);
                            }}
                            style={{ padding: '4px 10px' }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
