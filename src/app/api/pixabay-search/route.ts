import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { query, perPage = 1 } = await request.json();
    const apiKey = process.env.PIXABAY_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Pixabay API key missing' }, { status: 500 });
    }

    const response = await fetch(
      `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=${perPage}&safesearch=true`
    );

    if (!response.ok) {
      throw new Error(`Pixabay API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Map Pixabay format to a common format or just return it
    // Pixabay returns { hits: [ { webformatURL: '...' } ] }
    const photos = data.hits?.map((hit: any) => ({
      url: hit.largeImageURL || hit.webformatURL,
      photographer: hit.user,
    }));

    return NextResponse.json({ photos });
  } catch (error: any) {
    console.error('Pixabay search error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
