import { ImageResponse } from 'next/og';

export const alt = 'tarteel.tv — Quran Recitations';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

const BG = '#000000';
const FG = '#F5F0E8';      // warm off-white — "tarteel"
const FG_DIM = '#A09880';  // warm gold-grey — ".tv" and tagline

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: BG,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Warm radial vignette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 70% 70% at 50% 50%, #1A1612 0%, #0A0806 100%)',
            display: 'flex',
          }}
        />

        {/* Top rule */}
        <div
          style={{
            position: 'absolute',
            top: 248,
            left: 380,
            width: 440,
            height: 1,
            background: FG_DIM,
            opacity: 0.35,
            display: 'flex',
          }}
        />

        {/* Wordmark: "tarteel" warm-white + ".tv" gold-dim */}
        <div
          style={{
            display: 'flex',
            fontSize: 108,
            fontWeight: 700,
            letterSpacing: '-3px',
            lineHeight: 1,
            position: 'relative',
          }}
        >
          <span style={{ color: FG }}>tarteel</span>
          <span style={{ color: FG_DIM }}>.tv</span>
        </div>

        {/* Bottom rule */}
        <div
          style={{
            position: 'absolute',
            top: 392,
            left: 380,
            width: 440,
            height: 1,
            background: FG_DIM,
            opacity: 0.35,
            display: 'flex',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            position: 'absolute',
            top: 410,
            display: 'flex',
            fontSize: 26,
            fontWeight: 400,
            color: FG_DIM,
            letterSpacing: '5px',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          QURAN RECITATIONS
        </div>
      </div>
    ),
    { ...size }
  );
}
