import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ renderId: string }> }
) {
  try {
    const { renderId } = await params;
    const shotstackApiKey = process.env.SHOTSTACK_API_KEY;

    if (!shotstackApiKey) {
      return NextResponse.json(
        { error: 'Missing SHOTSTACK_API_KEY environment variable' },
        { status: 500 }
      );
    }

    if (!renderId) {
      return NextResponse.json({ error: 'renderId is required' }, { status: 400 });
    }

    // Check render status
    const statusRes = await fetch(`https://api.shotstack.io/edit/v1/render/${renderId}`, {
      headers: {
        'x-api-key': shotstackApiKey,
      },
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      throw new Error(`Shotstack status check failed (${statusRes.status}): ${errorText}`);
    }

    const statusData = await statusRes.json();
    const status = statusData.response.status; // 'queued', 'fetching', 'rendering', 'done', 'failed'
    const url = statusData.response.url;
    const error = statusData.response.error;

    if (status === 'failed') {
      return NextResponse.json(
        {
          status,
          error: error || 'Shotstack render failed without error message',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        status,
        renderId,
        url: status === 'done' ? url : null,
        message:
          status === 'done'
            ? 'Render complete!'
            : `Render ${status}... (${(Math.random() * 100).toFixed(0)}% complete)`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Shotstack status check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to check render status';

    return NextResponse.json(
      {
        status: 'error',
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
