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

// Validate required environment variables
function validateEnv() {
  const required = {
    HCTI_USER_ID: process.env.HCTI_USER_ID,
    HCTI_API_KEY: process.env.HCTI_API_KEY,
    SHOTSTACK_API_KEY: process.env.SHOTSTACK_API_KEY,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(', ')}. Configure these in your .env.local file.`
    );
  }

  return {
    hctiUserId: required.HCTI_USER_ID!,
    hctiApiKey: required.HCTI_API_KEY!,
    shotstackApiKey: required.SHOTSTACK_API_KEY!,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { htmlContent, slides } = await request.json();

    if (!htmlContent || !Array.isArray(slides) || slides.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: htmlContent and slides array required' },
        { status: 400 }
      );
    }

    // Get credentials from environment variables (secure)
    const { hctiUserId, hctiApiKey, shotstackApiKey } = validateEnv();

    // Step 1: Render all slides to images using HCTI
    console.log(`Rendering ${slides.length} slides to images...`);
    const clips: any[] = [];
    let startTime = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const slideHtml = slide.html;

      if (!slideHtml) {
        console.warn(`Slide ${i} missing HTML content, skipping...`);
        continue;
      }

      // Wrap in proper HTML document
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"></script><style>*{margin:0;padding:0;}body{width:1920px;height:1080px;overflow:hidden;}</style></head><body>${slideHtml}</body></html>`;

      // Small delay between requests to avoid rate limiting
      if (i > 0) await new Promise((r) => setTimeout(r, 500));

      // Call HCTI API with retry logic
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
        5, // Increase retries for better reliability
        1000
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HCTI API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      const imageUrl = result.url;

      if (!imageUrl) {
        throw new Error(`Failed to get image URL from HCTI response`);
      }

      const duration = slide.duration || 3; // Default 3 seconds

      // Add visual clip
      clips.push({
        asset: {
          type: 'image',
          src: imageUrl,
        },
        start: startTime,
        length: duration,
        fit: 'contain',
        effect: 'zoomIn',
      });

      startTime += duration;
      console.log(`Slide ${i + 1}/${slides.length} rendered successfully`);
    }

    // Step 2: Build audio track if audio exists
    const audioClips: any[] = [];
    let audioStartTime = 0;

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const duration = clips[i]?.length || 3;

      if (slide.audioUrl) {
        audioClips.push({
          asset: {
            type: 'audio',
            src: slide.audioUrl,
          },
          start: audioStartTime,
          fit: 'crop',
        });
      }
      audioStartTime += duration;
    }

    // Step 3: Create Shotstack render request
    console.log('Preparing Shotstack payload...');
    const payload = {
      timeline: {
        background: '#000000',
        tracks: [
          { clips }, // Visuals
          ...(audioClips.length > 0 ? [{ clips: audioClips }] : []), // Audio
        ],
      },
      output: {
        format: 'mp4',
        size: {
          width: 1920,
          height: 1080,
        },
        fps: 30,
      },
    };

    const renderRes = await fetch('https://api.shotstack.io/edit/v1/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': shotstackApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!renderRes.ok) {
      const errorText = await renderRes.text();
      throw new Error(`Shotstack API error (${renderRes.status}): ${errorText}`);
    }

    const renderData = await renderRes.json();
    const renderId = renderData.response.id;

    if (!renderId) {
      throw new Error('Failed to get render ID from Shotstack');
    }

    console.log('Shotstack Render ID:', renderId);

    // Return the render ID so frontend can poll for completion
    return NextResponse.json(
      {
        success: true,
        renderId,
        message: 'Slides rendered and Shotstack render job created',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Shotstack export error:', error);
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
