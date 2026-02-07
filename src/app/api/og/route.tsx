import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getClipById } from '@/lib/server/clips';
import { getSurahName } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clipId = searchParams.get('clipId');

    if (!clipId) {
      // Return default OG image
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
          width: 1200,
          height: 630,
        }
      );
    }

    const clip = await getClipById(clipId);

    if (!clip) {
      throw new Error('Clip not found');
    }

    const surahName = getSurahName(clip.surah);

    return new ImageResponse(
      (
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
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
          {/* Header */}
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              top: '40px',
              left: '40px',
              fontSize: '36px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            tarteel.tv
          </div>

          {/* Main content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '30px',
              textAlign: 'center',
            }}
          >
            {/* Surah badge */}
            <div
              style={{
                display: 'flex',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <span
                style={{
                  fontSize: '24px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontWeight: '600',
                  letterSpacing: '2px',
                }}
              >
                SURAH {surahName.toUpperCase()}
              </span>
            </div>

            {/* Ayah range */}
            <h1
              style={{
                fontSize: '96px',
                fontWeight: 'bold',
                color: 'white',
                margin: 0,
                lineHeight: 1,
              }}
            >
              {clip.ayahStart}-{clip.ayahEnd}
            </h1>

            {/* Reciter name */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <p
                style={{
                  fontSize: '36px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  margin: 0,
                  fontWeight: '600',
                }}
              >
                {clip.reciterName}
              </p>
              {clip.riwayah && (
                <p
                  style={{
                    fontSize: '24px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    margin: 0,
                  }}
                >
                  {clip.riwayah}
                </p>
              )}
            </div>
          </div>

          {/* Footer decoration */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              display: 'flex',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '60px',
                height: '6px',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '3px',
              }}
            />
            <div
              style={{
                width: '60px',
                height: '6px',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '3px',
                opacity: 0.6,
              }}
            />
            <div
              style={{
                width: '60px',
                height: '6px',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '3px',
                opacity: 0.3,
              }}
            />
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error('Failed to generate OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
