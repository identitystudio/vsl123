import { NextRequest, NextResponse } from 'next/server';

// Helper to handle rate limiting with exponential backoff  
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delay = 1000
): Promise<Response> {
  try {
    const response = await fetch(url, options);

    // If rate limited (429) or server error (5xx), retry
    if ((response.status === 429 || response.status >= 500) && retries > 0) {
      console.log(`Request failed with ${response.status}. Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }

    return response;
  } catch (error) {
    if (retries > 0) {
      console.log(`Network error. Retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2);
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { html } = await request.json();

    if (!html || typeof html !== 'string') {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    const hctiUserId = process.env.HCTI_USER_ID;
    const hctiApiKey = process.env.HCTI_API_KEY;

    if (!hctiUserId || !hctiApiKey) {
      return NextResponse.json(
        { error: 'Missing HCTI credentials in environment variables' },
        { status: 500 }
      );
    }

    // Convert HTML to image using HCTI
    const response = await fetchWithRetry(
      'https://hcti.io/v1/image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic ' + Buffer.from(`${hctiUserId}:${hctiApiKey}`).toString('base64'),
        },
        body: JSON.stringify({
          html,
          viewport_width: 1920,
          viewport_height: 1080,
        }),
      },
      5, // More retries for better reliability
      1000
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `HCTI API error (${response.status}):`,
        errorText
      );
      return NextResponse.json(
        { error: `HCTI API error (${response.status}): ${errorText || 'Unknown error'}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    if (!result.url) {
      return NextResponse.json(
        { error: 'Failed to get image URL from HCTI response' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: result.url,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('HTML to image conversion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
