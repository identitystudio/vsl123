export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || prompt.trim().length === 0) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    console.log('🚀 API: Received prompt for webhook:', prompt);

    const response = await fetch(
      'https://themacularprogram.app.n8n.cloud/webhook/generate-infographics',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: prompt.trim() }),
      }
    );

    console.log('📡 Webhook Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Webhook Failed:', errorText);
      throw new Error(`Webhook returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Webhook Response:', JSON.stringify(data).substring(0, 100) + '...');
    return Response.json(data);
  } catch (error) {
    console.error('Generate infographics error:', error);
    return Response.json(
      { error: 'Failed to generate infographics' },
      { status: 500 }
    );
  }
}
