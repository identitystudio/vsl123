import { PIAPI_BASE, extractPiApiVideoUrl, getPiApiFailureMessage, persistVideoToCloudinary } from '@/lib/piapi-video';

const completedTasks = new Map<string, string>();
const pendingUploads = new Map<string, Promise<string | null>>();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const apiKey = searchParams.get('apiKey');

    if (!taskId || !apiKey) {
      return Response.json({ error: 'Missing taskId or apiKey' }, { status: 400 });
    }

    const response = await fetch(`${PIAPI_BASE}/${taskId}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('PiAPI video status check failed:', response.status, text);
      return Response.json(
        { error: `Status check failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const data = result.data;
    if (!data) {
      return Response.json({ error: 'Invalid response from PiAPI' }, { status: 500 });
    }

    const normalizedStatus = String(data.status || '').toLowerCase();

    if (data.error?.code && data.error.code > 0) {
      return Response.json({
        status: 'failed',
        error: getPiApiFailureMessage(data.error),
        providerError: data.error,
        taskId,
      });
    }

    if (normalizedStatus === 'failed' || normalizedStatus === 'error') {
      return Response.json({
        status: 'failed',
        error: getPiApiFailureMessage(data.error) || data.detail || 'Video generation failed',
        providerError: data.error || null,
        taskId,
      });
    }

    if (normalizedStatus === 'pending' || normalizedStatus === 'processing' || normalizedStatus === 'staged') {
      return Response.json({
        status: normalizedStatus,
        taskId,
        success: true,
      });
    }

    if (normalizedStatus === 'completed') {
      const cached = completedTasks.get(taskId);
      if (cached) {
        return Response.json({
          status: 'completed',
          taskId,
          videoUri: cached,
          success: true,
        });
      }

      const rawVideoUrl = extractPiApiVideoUrl(data);
      if (!rawVideoUrl) {
        return Response.json({
          status: 'failed',
          error: 'Generation completed but no video URL was returned.',
          taskId,
        });
      }

      let uploadPromise = pendingUploads.get(taskId);
      if (!uploadPromise) {
        uploadPromise = persistVideoToCloudinary(rawVideoUrl);
        pendingUploads.set(taskId, uploadPromise);
      }

      const permanentUrl = await uploadPromise;
      pendingUploads.delete(taskId);

      const finalUrl = permanentUrl || rawVideoUrl;
      completedTasks.set(taskId, finalUrl);

      return Response.json({
        status: 'completed',
        taskId,
        videoUri: finalUrl,
        success: true,
      });
    }

    return Response.json({
      status: normalizedStatus || 'processing',
      taskId,
      success: true,
    });
  } catch (error: any) {
    console.error('Image-to-video status error:', error);
    return Response.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
