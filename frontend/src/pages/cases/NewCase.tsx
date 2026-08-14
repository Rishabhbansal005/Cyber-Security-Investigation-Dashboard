import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import casesApi from '@/api/cases';
import type { CasePriority, CaseCategory } from '@/types';

const PRIORITIES: { value: CasePriority; label: string; color: string; desc: string }[] = [
  { value: 'low',      label: 'Low',      color: '#34d399', desc: 'Routine investigation' },
  { value: 'medium',   label: 'Medium',   color: '#fbbf24', desc: 'Elevated concern' },
  { value: 'high',     label: 'High',     color: '#fb923c', desc: 'Significant threat' },
  { value: 'critical', label: 'Critical', color: '#f43f5e', desc: 'Immediate response required' },
];

const CATEGORIES: { value: CaseCategory; label: string }[] = [
  { value: 'cybercrime',      label: 'Cybercrime (General)' },
  { value: 'data_breach',     label: 'Data Breach' },
  { value: 'malware',         label: 'Malware Infection' },
  { value: 'ransomware',      label: 'Ransomware' },
  { value: 'phishing',        label: 'Phishing' },
  { value: 'insider_threat',  label: 'Insider Threat' },
  { value: 'fraud',           label: 'Online Fraud' },
  { value: 'ddos',            label: 'DDoS Attack' },
  { value: 'espionage',       label: 'Cyber Espionage' },
  { value: 'other',           label: 'Other' },
];

export default function NewCase() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as CasePriority,
    status: 'open' as const,
    category: '' as CaseCategory | '',
    jurisdiction: '',
    incident_date: '',
    fir_number: '',
    police_station: '',
    ncrp_complaint_id: '',
    complainant_name: '',
    sections_of_law: '',
    funds_frozen_inr: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async (formData: typeof form) => {
      return casesApi.create({
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        status: formData.status,
        category: formData.category || undefined,
        jurisdiction: formData.jurisdiction || undefined,
        incident_date: formData.incident_date
          ? new Date(formData.incident_date).toISOString()
          : undefined,
        tags: formData.tags,
        fir_number: formData.fir_number || undefined,
        police_station: formData.police_station || undefined,
        ncrp_complaint_id: formData.ncrp_complaint_id || undefined,
        complainant_name: formData.complainant_name || undefined,
        sections_of_law: formData.sections_of_law
          ? formData.sections_of_law.split(',').map((s) => s.trim()).filter(Boolean)
          : [],
        funds_frozen_inr: formData.funds_frozen_inr ? Number(formData.funds_frozen_inr) : 0,
      });
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      navigate(`/cases/${newCase.id}`);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to create case.');
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !form.tags?.includes(tag)) {
      setForm((f) => ({ ...f, tags: [...(f.tags ?? []), tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags?.filter((t) => t !== tag) }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Case title is required.'); return; }
    mutation.mutate(form);
  };

  return (
    <div style={{ maxWidth: 740 }} className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">New Investigation Case</h1>
          <p className="page-header-subtitle">Open a new case to begin tracking an investigation</p>
        </div>
        <button className="btn btn-outline-secondary" onClick={() => navigate('/cases')}>
          Cancel
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '10px 14px',
          background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)',
          borderRadius: 8, marginBottom: 20, fontSize: 13, color: '#fb7185',
        }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="8" cy="8" r="6.5" /><path d="M8 5v3M8 10h.01" strokeLinecap="round" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* ── Case Information ─────────────── */}
        <div className="card mb-3">
          <div className="card-header">
            <span className="card-title">Case Information</span>
          </div>
          <div className="card-body">
            {/* Title */}
            <div className="mb-4">
              <label htmlFor="case-title" className="form-label">
                Case Title <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <input
                id="case-title" name="title" type="text" className="form-control"
                placeholder="e.g. Corporate Network Intrusion – Acme Corp"
                value={form.title} onChange={handleChange} required autoFocus
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label htmlFor="case-description" className="form-label">Description</label>
              <textarea
                id="case-description" name="description" className="form-control"
                placeholder="Brief description of the incident, initial findings, and scope…"
                rows={4} value={form.description} onChange={handleChange}
              />
            </div>

            {/* Priority — card-style selector */}
            <div className="mb-4">
              <label className="form-label">Priority</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {PRIORITIES.map((p) => {
                  const isSelected = form.priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      id={`priority-${p.value}`}
                      onClick={() => setForm((f) => ({ ...f, priority: p.value }))}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: `1px solid ${isSelected ? p.color : 'rgba(255,255,255,0.08)'}`,
                        background: isSelected ? `${p.color}18` : 'rgba(255,255,255,0.02)',
                        color: isSelected ? p.color : '#64748b',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: isSelected ? p.color : 'rgba(255,255,255,0.15)',
                          display: 'inline-block', flexShrink: 0,
                        }} />
                        {p.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category */}
            <div className="mb-4">
              <label htmlFor="case-category" className="form-label">Category</label>
              <select
                id="case-category" name="category" className="form-select"
                value={form.category ?? ''} onChange={handleChange}
              >
                <option value="">Select incident category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Incident Date + Jurisdiction */}
            <div className="row g-3 mb-4">
              <div className="col-6">
                <label htmlFor="case-incident-date" className="form-label">Incident Date</label>
                <input
                  id="case-incident-date" name="incident_date" type="datetime-local"
                  className="form-control"
                  value={form.incident_date as string} onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label htmlFor="case-jurisdiction" className="form-label">Jurisdiction</label>
                <input
                  id="case-jurisdiction" name="jurisdiction" type="text"
                  className="form-control"
                  placeholder="e.g. Delhi, Noida, Gurugram"
                  value={form.jurisdiction} onChange={handleChange}
                />
              </div>
            </div>

            <div className="row g-3 mb-4">
              <div className="col-6">
                <label htmlFor="case-fir" className="form-label">FIR Number</label>
                <input
                  id="case-fir" name="fir_number" type="text"
                  className="form-control"
                  placeholder="e.g. FIR-DL-2026-102"
                  value={form.fir_number} onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label htmlFor="case-ps" className="form-label">Police Station</label>
                <input
                  id="case-ps" name="police_station" type="text"
                  className="form-control"
                  placeholder="e.g. Cyber PS, Dwarka"
                  value={form.police_station} onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label htmlFor="case-ncrp" className="form-label">NCRP / 1930 ID</label>
                <input
                  id="case-ncrp" name="ncrp_complaint_id" type="text"
                  className="form-control"
                  placeholder="National Cybercrime portal complaint ID"
                  value={form.ncrp_complaint_id} onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label htmlFor="case-complainant" className="form-label">Complainant</label>
                <input
                  id="case-complainant" name="complainant_name" type="text"
                  className="form-control"
                  placeholder="Complainant name"
                  value={form.complainant_name} onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label htmlFor="case-sections" className="form-label">Sections of law</label>
                <input
                  id="case-sections" name="sections_of_law" type="text"
                  className="form-control"
                  placeholder="e.g. 66C IT Act, 318 BNS"
                  value={form.sections_of_law} onChange={handleChange}
                />
              </div>
              <div className="col-6">
                <label htmlFor="case-freeze" className="form-label">Funds frozen (INR)</label>
                <input
                  id="case-freeze" name="funds_frozen_inr" type="number" min="0"
                  className="form-control"
                  placeholder="Amount confirmed frozen by bank"
                  value={form.funds_frozen_inr} onChange={handleChange}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="form-label">Tags</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text" className="form-control"
                  placeholder="Type a tag and press Enter…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                />
                <button type="button" className="btn btn-outline-secondary" onClick={addTag}>
                  Add
                </button>
              </div>
              {(form.tags?.length ?? 0) > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {form.tags?.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: 'rgba(99,102,241,0.10)', color: '#818cf8',
                        padding: '4px 10px', borderRadius: 4, fontSize: 11,
                        border: '1px solid rgba(99,102,241,0.2)', fontFamily: 'monospace',
                      }}
                    >
                      {tag}
                      <button
                        type="button" onClick={() => removeTag(tag)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 14, padding: 0, lineHeight: 1 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/cases')}>
            Cancel
          </button>
          <button
            id="btn-create-case" type="submit" className="btn btn-primary"
            disabled={mutation.isPending}
            style={{ minWidth: 130 }}
          >
            {mutation.isPending ? (
              <><span className="spinner-border spinner-border-sm" role="status" /> Creating…</>
            ) : 'Create Case'}
          </button>
        </div>
      </form>
    </div>
  );
}
