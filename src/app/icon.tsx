import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#000000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#F5F0E8',
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            lineHeight: 1,
          }}
        >
          t
        </span>
      </div>
    ),
    { ...size }
  );
}
