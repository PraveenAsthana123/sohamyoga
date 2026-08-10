import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Careers at SohamYoga — Join Our Team';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #312e81 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '60px',
        }}
      >
        <div style={{ color: '#93c5fd', fontSize: 20, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>
          JOIN OUR TEAM
        </div>
        <div style={{ color: 'white', fontSize: 56, fontWeight: 800, textAlign: 'center', lineHeight: 1.1, marginBottom: 24 }}>
          Teach with Us
        </div>
        <div style={{ color: '#cbd5e1', fontSize: 24, textAlign: 'center', maxWidth: 700 }}>
          Yoga Instructors · Studio Staff
        </div>
        <div
          style={{
            marginTop: 48,
            display: 'flex',
            gap: 24,
          }}
        >
          {['Calgary, AB', 'All Levels Welcome'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(37, 99, 235, 0.3)',
                border: '1px solid rgba(147, 197, 253, 0.4)',
                color: '#93c5fd',
                padding: '8px 20px',
                borderRadius: 100,
                fontSize: 16,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', bottom: 40, color: '#64748b', fontSize: 16 }}>
          sohamyoga.ca/careers
        </div>
      </div>
    ),
    { ...size },
  );
}
