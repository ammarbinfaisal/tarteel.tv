import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getClipById } from '@/lib/server/clips';
import { getSurahName } from '@/lib/utils';

const BG = '#000000';
const FG = '#F5F0E8';      // warm off-white — "tarteel"
const FG_DIM = '#A09880';  // warm gold-grey — ".tv", labels, rules

function DefaultOg() {
  return (
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
      {/* Warm vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, #1A1612 0%, #0A0806 100%)',
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
  );
}

interface ClipOgProps {
  surahName: string;
  ayahStart: number;
  ayahEnd: number;
  reciterName: string;
  riwayah?: string | null;
}

function ClipOg({ surahName, ayahStart, ayahEnd, reciterName, riwayah }: ClipOgProps) {
  return (
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
        padding: '60px',
      }}
    >
      {/* Warm vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 70% at 50% 50%, #1A1612 0%, #0A0806 100%)',
          display: 'flex',
        }}
      />

      {/* Site name — top left: "tarteel" white + ".tv" gold */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 56,
          display: 'flex',
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '-1px',
        }}
      >
        <span style={{ color: FG, opacity: 0.75 }}>tarteel</span>
        <span style={{ color: FG_DIM, opacity: 0.75 }}>.tv</span>
      </div>

      {/* Surah label */}
      <div
        style={{
          position: 'absolute',
          top: 170,
          display: 'flex',
          fontSize: 24,
          fontWeight: 500,
          color: FG_DIM,
          letterSpacing: '5px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        SURAH {surahName.toUpperCase()}
      </div>

      {/* Ayah range — large centrepiece */}
      <div
        style={{
          display: 'flex',
          fontSize: 140,
          fontWeight: 700,
          color: FG,
          letterSpacing: '-4px',
          lineHeight: 1,
          position: 'relative',
        }}
      >
        {ayahStart}–{ayahEnd}
      </div>

      {/* Reciter name */}
      <div
        style={{
          position: 'absolute',
          bottom: 160,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 34,
            fontWeight: 600,
            color: FG,
            opacity: 0.9,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {reciterName}
        </div>
        {riwayah && (
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              fontWeight: 400,
              color: FG_DIM,
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {riwayah}
          </div>
        )}
      </div>

      {/* Bottom thin rule */}
      <div
        style={{
          position: 'absolute',
          bottom: 60,
          left: 480,
          width: 240,
          height: 1,
          background: FG_DIM,
          opacity: 0.35,
          display: 'flex',
        }}
      />
    </div>
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clipId = searchParams.get('clipId');

    if (!clipId) {
      return new ImageResponse(<DefaultOg />, { width: 1200, height: 630 });
    }

    const clip = await getClipById(clipId);

    if (!clip) {
      throw new Error('Clip not found');
    }

    const surahName = getSurahName(clip.surah);

    return new ImageResponse(
      <ClipOg
        surahName={surahName}
        ayahStart={clip.ayahStart}
        ayahEnd={clip.ayahEnd}
        reciterName={clip.reciterName}
        riwayah={clip.riwayah}
      />,
      { width: 1200, height: 630 }
    );
  } catch (error) {
    console.error('Failed to generate OG image:', error);
    return new Response('Failed to generate image', { status: 500 });
  }
}
