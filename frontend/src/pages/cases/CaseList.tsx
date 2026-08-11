import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import casesApi from '@/api/cases';
import { StatusBadge, PriorityBadge } from '@/components/shared/Badges';
import type { Case, CaseStatus, CasePriority } from '@/types';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'active', label: 'Active' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

const PRIORITY_OPTIONS = [
  { value: '', label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const SearchIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" strokeLinecap="round" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
    <path d="M8 3v10M3 8h10" strokeLinecap="round" />
  </svg>
);

export default function CaseList() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ status: '', priority: '', search: searchParams.get('search') ?? '' });
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const { data: allCases = [], isLoading, error } = useQuery({
    queryKey: ['cases', 'list'],
    queryFn: async (): Promise<Case[]> => {
      const response = await casesApi.list({ page: 1, page_size: 100 });
      return response.items;
    },
    staleTime: 30_000,
  });

  const cases = useMemo(() => {
    let result = allCases;
    if (filters.status) result = result.filter((c) => c.status === filters.status);
    if (filters.priority) result = result.filter((c) => c.priority === filters.priority);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (c) => c.title.toLowerCase().includes(q) || c.case_number?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allCases, filters]);

  const total = cases.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pagedCases = cases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleFilter = (key: string, value: string) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const hasFilters = filters.status || filters.priority || filters.search;

  return (
    <div className="animate-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">Case Management</h1>
          <p className="page-header-subtitle">
            {isLoading ? 'Loading…' : `${total} case${total !== 1 ? 's' : ''} in the system`}
          </p>
        </div>
        <div className="page-header-actions">
          <Link to="/cases/new" className="btn btn-primary" id="btn-new-case">
            <PlusIcon /> New Case
          </Link>
        </div>
      </div>

      {/* Table Card */}
      <div className="card">
        {/* Filter Bar */}
        <div className="filter-bar">
          {/* Search */}
          <div className="search-wrapper" style={{ flex: 1, minWidth: 200 }}>
            <span className="search-icon" style={{ color: 'var(--txt-muted)' }}>
              <SearchIcon />
            </span>
            <input
              id="case-search"
              type="text"
              className="form-control"
              placeholder="Search by title or case number…"
              value={filters.search}
              onChange={(e) => handleFilter('search', e.target.value)}
            />
          </div>

          <select
            id="case-filter-status"
            className="form-select"
            style={{ width: 'auto', minWidth: 140 }}
            value={filters.status}
            onChange={(e) => handleFilter('status', e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            id="case-filter-priority"
            className="form-select"
            style={{ width: 'auto', minWidth: 140 }}
            value={filters.priority}
            onChange={(e) => handleFilter('priority', e.target.value)}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {hasFilters && (
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => setFilters({ status: '', priority: '', search: '' })}
            >
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: 0 }}>
          {error ? (
            <div className="alert alert-danger m-4" style={{ margin: 20 }}>
              Failed to load cases. Check your connection and try again.
            </div>
          ) : isLoading ? (
            <div style={{ padding: '20px 20px' }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8, borderRadius: 6 }} />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No cases found</div>
              <div className="empty-state-text">
                {hasFilters
                  ? 'No cases match your current filters. Try adjusting the search criteria.'
                  : 'No investigation cases have been created yet.'}
              </div>
              {!hasFilters && (
                <Link to="/cases/new" className="btn btn-primary">
                  <PlusIcon /> Create First Case
                </Link>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-clickable mb-0">
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCases.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link
                          to={`/cases/${c.id}`}
                          className="font-mono"
                          style={{ color: '#818cf8', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}
                        >
                          {c.case_number}
                        </Link>
                      </td>
                      <td>
                        <div>
                          <Link
                            to={`/cases/${c.id}`}
                            style={{ color: '#f1f5f9', fontWeight: 500, textDecoration: 'none', fontSize: 13 }}
                          >
                            {c.title}
                          </Link>
                          {c.tags.length > 0 && (
                            <div style={{ marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {c.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 10,
                                    background: 'rgba(99,102,241,0.1)',
                                    color: '#818cf8',
                                    padding: '1px 7px',
                                    borderRadius: 4,
                                    fontFamily: 'monospace',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        {c.category ? (
                          <span style={{ fontSize: 12, color: '#64748b', textTransform: 'capitalize' }}>
                            {c.category.replace('_', ' ')}
                          </span>
                        ) : <span style={{ color: '#2d3a52' }}>—</span>}
                      </td>
                      <td><PriorityBadge priority={c.priority} /></td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#475569' }}>
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/cases/${c.id}`}
                          className="btn btn-sm btn-outline-secondary"
                          id={`btn-view-case-${c.id}`}
                          style={{ fontSize: 11 }}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
          }}>
            <span style={{ color: '#475569', fontFamily: 'monospace' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="btn btn-outline-secondary btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
