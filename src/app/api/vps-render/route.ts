import { NextResponse } from 'next/server';
import { gzipSync } from 'zlib';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max for serverless

const VPS_IP = '76.13.49.238';

// POST: Starts a new job — compresses body before sending to VPS
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'render';

    // Read raw body as ArrayBuffer to avoid Next.js JSON parsing limits
    const rawBody = await req.arrayBuffer();
    const rawSizeMB = (rawBody.byteLength / (1024 * 1024)).toFixed(2);

    // Gzip compress to reduce transfer size (HTML compresses ~80-90%)
    const compressed = gzipSync(Buffer.from(rawBody));
    const compSizeMB = (compressed.byteLength / (1024 * 1024)).toFixed(2);
    console.log(`[Proxy] Forwarding to VPS (${mode}): ${rawSizeMB} MB → ${compSizeMB} MB gzipped`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600000); // 10 min timeout for slow upload

    const response = await fetch(`http://${VPS_IP}:3001/${mode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
      body: compressed,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[VPS Proxy] VPS responded ${response.status}: ${errorText}`);
      return new NextResponse(errorText, { status: response.status });
    }

    const data = await response.json(); // Expected: { jobId: "..." }
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[VPS Proxy POST Error]:', error?.cause || error);
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
      
      const fileRes = await fetch(fileUrl, { cache: 'no-store' });
      if (!fileRes.ok) return NextResponse.json({ error: 'File not found on VPS' }, { status: 404 });

      const contentLength = fileRes.headers.get('Content-Length');
      console.log(`[Proxy] File size: ${contentLength} bytes`);

      // Create a response with the same body but fresh headers
      return new Response(fileRes.body, {
        headers: {
          'Content-Type': fileRes.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Length': contentLength || '',
          'Content-Disposition': `attachment; filename="${download}"`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
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
