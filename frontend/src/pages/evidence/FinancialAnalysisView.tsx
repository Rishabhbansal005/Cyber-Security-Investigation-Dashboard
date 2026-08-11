import React from 'react';
import { useQuery } from '@tanstack/react-query';
import financialApi from '@/api/financial';

interface FinancialAnalysisViewProps {
  evidenceId: string;
}

export default function FinancialAnalysisView({ evidenceId }: FinancialAnalysisViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['financial-analysis', evidenceId],
    queryFn: () => financialApi.analyze(evidenceId),
    retry: false
  });

  if (isLoading) {
    return <div className="text-center p-4">Loading financial analysis...</div>;
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💰</div>
        <div className="empty-state-title">No Financial Analysis Found</div>
        <div className="empty-state-text">Start analysis to extract bank statement intelligence.</div>
      </div>
    );
  }

  if (data.status === 'error' || data.status === 'partial') {
    return (
      <div className="card mt-4" style={{ borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(245, 158, 11, 0.05)' }}>
        <div className="card-body">
          <h6 style={{ color: 'var(--warning)', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>
            ⚠️ Financial Analysis Issue
          </h6>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            {data.error || 'Could not fully parse the statement file. Check if it matches standard formats.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-1">Financial Forensics (Bank Statements)</h5>
        </div>
        <div className="d-flex gap-3">
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>
              {data.total_records || 0}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Transactions</div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">📉 Top Payees (Debits)</span>
            </div>
            <div className="card-body p-0">
              {data.top_payees && data.top_payees.length > 0 ? (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead style={{ background: 'var(--bg-input)' }}>
                      <tr>
                        <th>Payee</th>
                        <th>Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.top_payees.map((item, idx) => (
                        <tr key={idx}>
                          <td className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.name}</td>
                          <td style={{ fontSize: 13, color: 'var(--danger)' }}>${item.total_amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No outgoing transactions data available.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6 mb-4">
          <div className="card h-100">
            <div className="card-header">
              <span className="card-title">💸 Largest Transactions (Absolute)</span>
            </div>
            <div className="card-body p-0">
              {data.largest_transactions && data.largest_transactions.length > 0 ? (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead style={{ background: 'var(--bg-input)' }}>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.largest_transactions.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: 13 }}>{item.date}</td>
                          <td className="font-mono" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.description}</td>
                          <td style={{ fontSize: 13, fontWeight: 'bold', color: item.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {item.amount < 0 ? '-' : '+'}${Math.abs(item.amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No transaction data available.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
