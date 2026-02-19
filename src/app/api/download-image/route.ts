export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');
    const fileName = searchParams.get('filename');

    if (!imageUrl || !fileName) {
      return new Response('Missing url or filename', { status: 400 });
    }

    const headers: Record<string, string> = {};

    // If this is a Google Generative Language file URL, it requires API key header
    const lowerUrl = imageUrl.toLowerCase();
    if (lowerUrl.includes('generativelanguage.googleapis.com')) {
      const apiKey = process.env.GOOGLE_API_KEY;
      if (apiKey) {
        headers['X-Goog-Api-Key'] = apiKey;
      }
    }

    // Fetch the image/video from the source
    const response = await fetch(imageUrl, { headers });
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }

    const blob = await response.blob();

    // Return with proper download headers
    return new Response(blob, {
      headers: {
        'Content-Type': blob.type,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': blob.size.toString(),
      },
    });
  } catch (error) {
    console.error('Download proxy error:', error);
    return new Response('Failed to download image', { status: 500 });
  }
}
