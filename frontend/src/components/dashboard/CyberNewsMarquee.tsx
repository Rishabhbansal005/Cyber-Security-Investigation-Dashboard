import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

export default function CyberNewsMarquee() {
  const [news, setNews] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // Fetch live cyber news using GNews API
    const apikey = '500c7be6c81095bc9e063ccd3c634b44';
    const apiUrl = `https://gnews.io/api/v4/search?q=cybercrime&country=in&lang=en&apikey=${apikey}`;
    
    fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        if (data && data.articles) {
          setNews(data.articles.slice(0, 10)); // Top 10 news
        }
      })
      .catch(err => console.error("Error fetching news", err));
  }, []);

  if (news.length === 0) return null;

  const items = [...news, ...news];

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
          LIVE NEWS
        </div>
        <div style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
          maskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
          WebkitMaskImage: 'linear-gradient(to right,transparent,#000 24px,#000 calc(100% - 24px),transparent)',
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
              width: 'max-content',
            }}
          >
            {items.map((item, i) => (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '0 24px',
                  color: 'rgba(255,255,255,0.8)',
                  textDecoration: 'none',
                  borderRight: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 13,
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
              >
                <span style={{ 
                  color: '#eab308', 
                  fontSize: 10, 
                  fontWeight: 600, 
                  fontFamily: 'JetBrains Mono,monospace' 
                }}>
                  {item.source?.name || 'News'}
                </span>
                <span style={{
                  maxWidth: '400px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {item.title}
                </span>
                <ExternalLink size={12} opacity={0.5} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
