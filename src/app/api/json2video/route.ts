import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action, apiKey, data, projectId } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    if (action === 'create') {
      // Create new video project
      console.log('Creating json2video project with data:', JSON.stringify(data, null, 2));
      
      const response = await fetch('https://api.json2video.com/v2/movies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(data),
      });

      const responseText = await response.text();
      console.log('json2video raw response:', responseText);
      console.log('json2video status:', response.status);

      if (!response.ok) {
        console.error('json2video error response:', responseText);
        return NextResponse.json({ error: responseText }, { status: response.status });
      }

      try {
        const result = JSON.parse(responseText);
        console.log('json2video parsed result:', result);
        return NextResponse.json(result);
      } catch (e) {
        console.error('Failed to parse json2video response:', e);
        return NextResponse.json({ error: 'Invalid JSON response', raw: responseText }, { status: 500 });
      }
    }

    if (action === 'status') {
      // Check project status
      const response = await fetch(`https://api.json2video.com/v2/movies/${projectId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json({ error }, { status: response.status });
      }

      const result = await response.json();
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('json2video proxy error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
