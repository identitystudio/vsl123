import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'render'; // 'render' or 'render-zip'
    const body = await req.json();

    const VPS_IP = '76.13.49.238';
    const VPS_URL = `http://${VPS_IP}:3001/${mode}`;

    console.log(`[Proxy] Forwarding request to VPS: ${VPS_URL}`);

    const response = await fetch(VPS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new NextResponse(errorText, { status: response.status });
    }

    const blob = await response.blob();
    
    // Forward the file back to the browser
    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment',
      },
    });
  } catch (error: any) {
    console.error('[VPS Proxy Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
