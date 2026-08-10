import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'SohamYoga — Find Your Inner Peace';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
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
        {/* Logo area */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: 80,
              height: 80,
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 24,
            }}
          >
            <div style={{ color: 'white', fontSize: 36, fontWeight: 900 }}>SY</div>
          </div>
          <div style={{ color: 'white', fontSize: 48, fontWeight: 800, letterSpacing: -1 }}>
            SohamYoga
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            color: '#86efac',
            fontSize: 28,
            fontWeight: 600,
            marginBottom: 20,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Find Your Inner Peace
        </div>

        {/* Description */}
        <div
          style={{
            color: '#cbd5e1',
            fontSize: 20,
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.5,
          }}
        >
          Premium Yoga Classes · AI Pose Coach · Booking · Community
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            left: 60,
            right: 60,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ color: '#64748b', fontSize: 16 }}>Vancouver, BC · Canada</div>
          <div style={{ color: '#64748b', fontSize: 16 }}>sohamyoga.com</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
