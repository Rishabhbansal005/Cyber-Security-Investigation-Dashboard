import React from 'react';
import { useQuery } from '@tanstack/react-query';
import usbApi from '@/api/usb';
import { format } from 'date-fns';

interface UsbAnalysisViewProps {
  evidenceId: string;
}

export default function UsbAnalysisView({ evidenceId }: UsbAnalysisViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usb-analysis', evidenceId],
    queryFn: () => usbApi.getAnalysis(evidenceId),
    refetchInterval: (query) => query.state.data?.analysis_status === 'analyzing' ? 2000 : false,
    retry: false
  });

  if (isLoading) {
    return <div className="text-center p-4">Loading USB analysis...</div>;
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔌</div>
        <div className="empty-state-title">No USB Analysis Found</div>
        <div className="empty-state-text">Start analysis to extract connected devices from registry.</div>
      </div>
    );
  }

  if (data.analysis_status === 'failed') {
    return (
      <div className="card mt-4" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}>
        <div className="card-body">
          <h6 style={{ color: 'var(--danger)', fontSize: 16, fontWeight: 700, margin: '0 0 4px 0' }}>
            ⚠️ USB Forensics Failed
          </h6>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
            An error occurred while parsing registry hives or link shortcuts.
          </p>
          {data.error_message && (
            <pre style={{ marginTop: 16, background: '#0f172a', padding: 12, borderRadius: 6, fontSize: 12, color: '#fca5a5', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {data.error_message}
            </pre>
          )}
        </div>
      </div>
    );
  }

  if (data.analysis_status === 'analyzing') {
    return (
      <div className="empty-state">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <div className="empty-state-title">Analysis in Progress</div>
        <div className="empty-state-text">Parsing registry hives...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-1">USB & File Transfer Forensics</h5>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Status: <span style={{ color: 'var(--success)', textTransform: 'capitalize' }}>{data.analysis_status}</span>
          </div>
        </div>
        <div className="d-flex gap-3">
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--teal)' }}>{data.analysis_summary?.total_devices || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Devices</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)' }}>{data.analysis_summary?.file_transfers || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>File Transfers</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>{(data.analysis_summary?.suspicious_devices_count || 0) + (data.analysis_summary?.suspicious_transfers || 0)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Suspicious</div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <h6 className="mb-0">All Connected Devices</h6>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table mb-0">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Serial Number</th>
                  <th>First Connected</th>
                  <th>Last Connected</th>
                  <th>Connections</th>
                </tr>
              </thead>
              <tbody>
                {data.connected_devices.map((d, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{d.vendor}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.product}</div>
                    </td>
                    <td className="font-mono" style={{ fontSize: 13 }}>{d.serial_number}</td>
                    <td style={{ fontSize: 13 }}>{format(new Date(d.first_connected), 'MMM d, yyyy HH:mm:ss')}</td>
                    <td style={{ fontSize: 13 }}>{format(new Date(d.last_connected), 'MMM d, yyyy HH:mm:ss')}</td>
                    <td>{d.connection_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {data.suspicious_devices && data.suspicious_devices.length > 0 && (
        <div className="card border-danger">
          <div className="card-header bg-danger text-white">
            <h6 className="mb-0">Suspicious Devices Detected</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th>Identifier / Target</th>
                    <th>Detail / Value</th>
                    <th>Reason</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suspicious_devices.map((s: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.vendor || s.file_name || 'Unknown'}</td>
                      <td className="font-mono" style={{ fontSize: 13 }}>{s.serial_number || s.target_path || 'N/A'}</td>
                      <td>{s.reason}</td>
                      <td><span className="badge bg-danger">{s.severity?.toUpperCase() || 'HIGH'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
