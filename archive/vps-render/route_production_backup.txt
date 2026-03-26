import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const VPS_IP = '76.13.49.238';

// POST: Starts a new job
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'render';
    const body = await req.json();

    console.log(`[Proxy] Starting Job on VPS for ${body.slides?.length} slides`);

    const response = await fetch(`http://${VPS_IP}:3001/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(errorText, { status: response.status });
    }

    const data = await response.json(); // Expected: { jobId: "..." }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VPS Proxy POST Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: Checks job status
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const download = searchParams.get('download');

    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    // Handle File Download (Streaming Proxy to fix Insecure Connection)
    if (download) {
      const fileUrl = `http://${VPS_IP}:3001/outputs/${download}`;
      console.log(`[Proxy] Streaming file from VPS: ${fileUrl}`);
      
      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) return NextResponse.json({ error: 'File not found on VPS' }, { status: 404 });

      // Create a response with the same body but fresh headers
      return new Response(fileRes.body, {
        headers: {
          'Content-Type': fileRes.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': fileRes.headers.get('Content-Length') || '',
          'Content-Disposition': `attachment; filename="${download}"`,
        },
      });
    }

    const response = await fetch(`http://${VPS_IP}:3001/status/${jobId}`);
    if (!response.ok) return NextResponse.json({ error: 'Job not found on VPS' }, { status: 404 });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VPS Proxy GET Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
