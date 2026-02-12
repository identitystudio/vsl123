import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, perPage = 5 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Pexels API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=landscape`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Pexels rate limit reached. Please wait a few minutes or skip images.' },
          { status: 429 }
        );
      }
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();

    const photos = data.photos.map((photo: {
      id: number;
      src: { large2x: string; medium: string };
      photographer: string;
      alt: string;
    }) => ({
      id: photo.id,
      url: photo.src.large2x,
      thumbnail: photo.src.medium,
      photographer: photo.photographer,
      alt: photo.alt,
    }));

    return NextResponse.json({ photos });
  } catch (error: unknown) {
    console.error('Pexels search error:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to search images';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
