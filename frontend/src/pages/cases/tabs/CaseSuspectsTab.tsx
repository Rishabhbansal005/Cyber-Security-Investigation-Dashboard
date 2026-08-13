import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import suspectsApi from '@/api/suspects';
import evidenceApi from '@/api/evidence';
import type { Suspect, SuspectCreate, Evidence } from '@/types';
import { format } from 'date-fns';

export default function CaseSuspectsTab({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<SuspectCreate>>({
    name: '',
    aliases: [],
    mobile_numbers: [],
    email_ids: [],
    ip_addresses: [],
    criminal_history: '',
    social_media_accounts: [],
    notes: '',
    status: 'under_investigation',
    funds_linked_inr: 0,
  });

  const { data: suspects, isLoading } = useQuery({
    queryKey: ['suspects', caseId],
    queryFn: () => suspectsApi.listForCase(caseId),
  });

  const { data: evidence } = useQuery({
    queryKey: ['evidence', caseId],
    queryFn: () => evidenceApi.listForCase(caseId),
  });

  const createMutation = useMutation({
    mutationFn: (data: SuspectCreate) => suspectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspects', caseId] });
      setIsAdding(false);
      setFormData({
        name: '',
        aliases: [],
        mobile_numbers: [],
        email_ids: [],
        ip_addresses: [],
        criminal_history: '',
        social_media_accounts: [],
        notes: '',
        status: 'under_investigation',
        funds_linked_inr: 0,
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => suspectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspects', caseId] });
    }
  });

  const updateSuspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SuspectCreate> }) => suspectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suspects', caseId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    }
  });

  const updateEvidenceMutation = useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => evidenceApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence', caseId] });
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    createMutation.mutate({ ...formData, case_id: caseId } as SuspectCreate);
  };

  const handleArrayInput = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SuspectCreate) => {
    const value = e.target.value;
    const arrayValue = value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData({ ...formData, [field]: arrayValue });
  };

  if (isLoading) return <div>Loading suspects...</div>;

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-heading)' }}>Suspect Management</h3>
        {!isAdding && (
          <button className="btn btn-primary btn-sm" onClick={() => setIsAdding(true)}>
            + Add Suspect
          </button>
        )}
      </div>

      {isAdding && (
        <div className="card mb-4" style={{ border: '1px solid var(--teal)' }}>
          <div className="card-body">
            <h5 style={{ marginBottom: 16 }}>Add New Suspect</h5>
            <form onSubmit={handleCreate}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full Name *</label>
                  <input type="text" className="form-control" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Aliases (comma separated)</label>
                  <input type="text" className="form-control" onChange={e => handleArrayInput(e, 'aliases')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Mobile Numbers (comma separated)</label>
                  <input type="text" className="form-control" onChange={e => handleArrayInput(e, 'mobile_numbers')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email IDs (comma separated)</label>
                  <input type="text" className="form-control" onChange={e => handleArrayInput(e, 'email_ids')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">IP Addresses (comma separated)</label>
                  <input type="text" className="form-control" onChange={e => handleArrayInput(e, 'ip_addresses')} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={formData.status || 'under_investigation'} onChange={e => setFormData({ ...formData, status: e.target.value as SuspectCreate['status'] })}>
                    <option value="under_investigation">Under investigation</option>
                    <option value="arrested">Arrested</option>
                    <option value="absconding">Absconding</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Linked freeze amount (INR)</label>
                  <input type="number" min="0" className="form-control" value={formData.funds_linked_inr || 0} onChange={e => setFormData({ ...formData, funds_linked_inr: Number(e.target.value) })} />
                </div>
                <div className="col-md-12">
                  <label className="form-label">Criminal History</label>
                  <textarea className="form-control" rows={3} value={formData.criminal_history} onChange={e => setFormData({ ...formData, criminal_history: e.target.value })}></textarea>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Save Suspect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {suspects?.length === 0 && !isAdding ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">No Suspects Added</div>
          <div className="empty-state-text">Track potential suspects, their aliases, and contact info.</div>
        </div>
      ) : (
        <div className="row g-4">
          {suspects?.map(suspect => (
            <div key={suspect.id} className="col-12 col-xl-6">
              <div className="card h-100">
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h5 style={{ margin: 0, fontWeight: 700, color: 'var(--text-heading)', fontSize: '16px' }}>{suspect.name}</h5>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      className="form-select form-select-sm"
                      value={suspect.status || 'under_investigation'}
                      onChange={(e) => updateSuspectMutation.mutate({ id: suspect.id, data: { status: e.target.value as SuspectCreate['status'] } })}
                      style={{ fontSize: 12, width: 180 }}
                    >
                      <option value="under_investigation">Under investigation</option>
                      <option value="arrested">Arrested</option>
                      <option value="absconding">Absconding</option>
                      <option value="discharged">Discharged</option>
                    </select>
                    <button className="btn btn-sm btn-outline-danger" style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 600 }} onClick={() => {
                      if (confirm('Delete this suspect?')) deleteMutation.mutate(suspect.id);
                    }}>Delete Suspect</button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="row g-4">
                    {[
                      { label: 'Aliases', value: suspect.aliases?.length ? suspect.aliases.join(', ') : 'None' },
                      { label: 'Mobiles', value: suspect.mobile_numbers?.length ? suspect.mobile_numbers.join(', ') : 'None' },
                      { label: 'Emails', value: suspect.email_ids?.length ? suspect.email_ids.join(', ') : 'None' },
                      { label: 'IP Addresses', value: suspect.ip_addresses?.length ? suspect.ip_addresses.join(', ') : 'None' },
                      { label: 'Linked freeze (INR)', value: suspect.funds_linked_inr ? `₹ ${Number(suspect.funds_linked_inr).toLocaleString('en-IN')}` : 'None' },
                    ].map((item, idx) => (
                      <div key={idx} className="col-6">
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</div>
                      </div>
                    ))}
                    <div className="col-12">
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Criminal History</div>
                      <div style={{ fontSize: 13, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', padding: '10px 14px', borderRadius: 6, marginTop: 4, color: 'var(--text-primary)' }}>
                        {suspect.criminal_history || 'No known history.'}
                      </div>
                    </div>
                    
                    {/* Evidence Linking */}
                    <div className="col-12 mt-4">
                      <h6 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-heading)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 12 }}>
                        Uploaded Evidence
                      </h6>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {evidence?.filter((e: Evidence) => e.suspect_id === suspect.id).map((e: Evidence) => (
                          <li key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid var(--border-subtle)', borderRadius: 6, marginBottom: 8, background: 'rgba(255,255,255,0.02)', fontSize: 13 }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>📎 {e.original_file_name}</span>
                            <button 
                              className="btn btn-link btn-sm" 
                              style={{ padding: 0, color: 'var(--danger)', fontSize: 12, textDecoration: 'none' }}
                              onClick={() => updateEvidenceMutation.mutate({ id: e.id, data: { suspect_id: null } })}
                            >Unlink</button>
                          </li>
                        ))}
                      </ul>
                      
                      {evidence?.filter((e: Evidence) => e.suspect_id !== suspect.id).length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12, fontStyle: 'italic' }}>
                          No available evidence in this case to link.
                        </div>
                      ) : (
                        <select 
                          className="form-select form-select-sm mt-3" 
                          style={{ fontSize: 13, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: 6 }}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateEvidenceMutation.mutate({ id: e.target.value, data: { suspect_id: suspect.id } });
                              e.target.value = '';
                            }
                          }}
                        >
                          <option value="">+ Link Evidence to Suspect</option>
                          {evidence?.filter((e: Evidence) => e.suspect_id !== suspect.id).map((e: Evidence) => (
                            <option key={e.id} value={e.id}>{e.original_file_name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
