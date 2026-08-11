import React from 'react';
import { useQuery } from '@tanstack/react-query';
import imageApi from '@/api/image';

interface ImageAnalysisViewProps {
  evidenceId: string;
}

export default function ImageAnalysisView({ evidenceId }: ImageAnalysisViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['image-analysis', evidenceId],
    queryFn: () => imageApi.analyze(evidenceId),
    retry: false
  });

  if (isLoading) {
    return <div className="text-center p-4">Loading image analysis...</div>;
  }

  if (error || !data) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🖼️</div>
        <div className="empty-state-title">No Image Analysis Found</div>
        <div className="empty-state-text">Start analysis to extract EXIF and GPS data.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-1">Image Forensics (EXIF Data)</h5>
        </div>
        <div className="d-flex gap-3">
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: data.analysis_summary?.has_exif ? 'var(--teal)' : 'var(--text-muted)' }}>
              {data.analysis_summary?.has_exif ? 'YES' : 'NO'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>EXIF Data</div>
          </div>
          <div style={{ textAlign: 'center', background: 'var(--bg-input)', padding: '8px 16px', borderRadius: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: data.analysis_summary?.has_gps ? 'var(--teal)' : 'var(--text-muted)' }}>
              {data.analysis_summary?.has_gps ? 'YES' : 'NO'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>GPS Location</div>
          </div>
        </div>
      </div>

      <div className="row">
        {data.gps_coordinates && (
          <div className="col-12 mb-4">
            <div className="card">
              <div className="card-header">
                <span className="card-title">📍 Extracted GPS Location</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Latitude: {data.gps_coordinates.lat.toFixed(6)}, Longitude: {data.gps_coordinates.lon.toFixed(6)}
                </div>
                <div className="mt-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${data.gps_coordinates.lat},${data.gps_coordinates.lon}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline-primary btn-sm"
                  >
                    View on Google Maps ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="col-12">
          <div className="card">
            <div className="card-header">
              <span className="card-title">📸 EXIF Metadata</span>
            </div>
            <div className="card-body p-0">
              {data.exif_data && Object.keys(data.exif_data).length > 0 ? (
                <div className="table-responsive">
                  <table className="table mb-0">
                    <thead style={{ background: 'var(--bg-input)' }}>
                      <tr>
                        <th>Tag</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.exif_data).map(([key, value]) => (
                        <tr key={key}>
                          <td className="font-mono" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{key}</td>
                          <td style={{ fontSize: 13, wordBreak: 'break-all' }}>{value as string}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
                  No EXIF metadata found in this image.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
