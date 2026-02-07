import { ImageResponse } from 'next/og';
import { getClipById } from '@/lib/server/clips';
import { searchParamsCache } from '@/lib/searchparams.server';
import { getSurahName } from '@/lib/utils';

export const alt = 'Quran Recitation Clip';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

type Props = {
  params: Promise<Record<string, never>>;
};

export default async function Image({ params }: Props) {
  // Get searchParams from the URL (this won't work directly in opengraph-image)
  // Instead we'll create a route-based image generator

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
          }}
        >
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              color: 'white',
              margin: 0,
              textAlign: 'center',
            }}
          >
            tarteel.tv
          </h1>
          <p
            style={{
              fontSize: '32px',
              color: 'rgba(255, 255, 255, 0.9)',
              margin: 0,
              textAlign: 'center',
            }}
          >
            Beautiful Quran Recitations
          </p>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
