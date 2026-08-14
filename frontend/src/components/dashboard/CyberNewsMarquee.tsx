import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, ExternalLink } from 'lucide-react';
import dashboardApi from '@/api/dashboard';

export default function CyberNewsMarquee() {
  const [paused, setPaused] = useState(false);
  const { data: news = [], isLoading, isError } = useQuery({
    queryKey: ['dashboard-forensic-news'],
    queryFn: () => dashboardApi.getForensicNews(),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const headlines = news.length > 0
    ? news
    : isLoading
      ? [{ title: 'Fetching live digital forensics and cybercrime headlines…', url: null, source: 'LIVE' }]
      : [{ title: isError ? 'News feed could not load. Confirm GNEWS_API_KEY in backend/.env and restart the API.' : 'No forensic headlines returned yet.', url: null, source: 'LIVE' }];

  const items = news.length > 0 ? [...headlines, ...headlines] : headlines;

  return (
    <>
      <style>{`
        @keyframes news-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .news-track {
          animation: news-scroll 60s linear infinite;
        }
        .news-track.news-paused {
          animation-play-state: paused;
        }
      `}</style>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 48,
          marginBottom: 16,
          flexShrink: 0,
          overflow: 'hidden',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(8,13,22,0.6)',
          display: 'flex',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div style={{
          position: 'relative',
          zIndex: 3,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 16px',
          background: 'rgba(234, 179, 8, 0.1)',
          borderRight: '1px solid rgba(234, 179, 8, 0.2)',
          color: '#eab308',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          fontFamily: 'JetBrains Mono,monospace',
          whiteSpace: 'nowrap',
        }}>
          <Newspaper size={14} />
          FORENSIC NEWS
        </div>
        <div style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div
            className={`news-track${paused ? ' news-paused' : ''}`}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              paddingLeft: 16,
              whiteSpace: 'nowrap',
            }}
          >
            {items.map((article, i) => {
              const Tag = article.url ? 'a' : 'span';
              return (
                <Tag
                  key={i}
                  href={article.url || undefined}
                  target={article.url ? '_blank' : undefined}
                  rel={article.url ? 'noopener noreferrer' : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#cbd5e1',
                    fontSize: 13,
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ color: '#eab308', fontSize: 10, fontWeight: 700 }}>{article.source}</span>
                  {article.title}
                  {article.url ? <ExternalLink size={12} color="#64748b" /> : null}
                </Tag>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
