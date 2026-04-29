import { getThemeConfig, type ImageTheme } from '@/lib/image-themes';
import { PIAPI_BASE, extractPiApiVideoUrl, getPiApiFailureMessage, persistVideoToCloudinary } from '@/lib/piapi-video';

function isIncompleteCloudinaryImageUrl(url: string) {
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname !== 'res.cloudinary.com') return false;

    const parts = parsed.pathname.split('/').filter(Boolean);
    const uploadIndex = parts.indexOf('upload');
    return uploadIndex >= 0 && uploadIndex === parts.length - 1;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt, theme = 'realism', apiKey } = await req.json();
    const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : imageUrl;

    console.log('🎬 PiAPI video request:', {
      imageUrl: normalizedImageUrl,
      prompt,
      theme,
    });

    if (!normalizedImageUrl || !prompt) {
      return Response.json({ error: 'Missing imageUrl or prompt' }, { status: 400 });
    }

    if (!apiKey) {
      return Response.json(
        { error: 'PiAPI key is missing. Please enter it in the theme selection options.' },
        { status: 400 }
      );
    }

    let parsedImageUrl: URL;
    try {
      parsedImageUrl = new URL(normalizedImageUrl);
    } catch {
      return Response.json({ error: 'Invalid image URL.' }, { status: 400 });
    }

    if (isIncompleteCloudinaryImageUrl(parsedImageUrl.toString())) {
      return Response.json(
        { error: 'Image URL is incomplete. Generate or upload an actual image before creating a video.' },
        { status: 400 }
      );
    }

    const themeConfig = getThemeConfig(theme as ImageTheme);
    const enhancedPrompt = `${prompt}. ${themeConfig.videoPromptModifier}`;

    const response = await fetch(PIAPI_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'veo3',
        task_type: 'veo3-video-fast',
        input: {
          prompt: enhancedPrompt,
          image_url: normalizedImageUrl,
          aspect_ratio: 'auto',
          duration: '8s',
          resolution: '720p',
          generate_audio: false,
        },
        config: {
          service_mode: 'public',
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `PiAPI request failed: ${response.statusText}`;

      try {
        const parsed = JSON.parse(text);
        errorMessage =
          getPiApiFailureMessage(parsed?.data?.error) ||
          parsed?.message ||
          errorMessage;
      } catch {
        // Fall back to raw status text when PiAPI does not return JSON.
      }

      console.error('PiAPI video submit failed:', response.status, text);
      return Response.json(
        { error: errorMessage },
        { status: response.status === 500 ? 402 : response.status }
      );
    }

    const result = await response.json();
    if (result.code !== 200 || !result.data?.task_id) {
      const errorMsg = getPiApiFailureMessage(result.data?.error) || result.message || 'Failed to submit video task';
      console.error('PiAPI video submission error:', errorMsg);
      return Response.json({ error: errorMsg }, { status: 400 });
    }

    const data = result.data;
    const normalizedStatus = String(data.status || '').toLowerCase();

    if (normalizedStatus === 'completed') {
      const rawVideoUrl = extractPiApiVideoUrl(data);
      if (!rawVideoUrl) {
        return Response.json(
          { error: 'Generation completed but no video URL was returned.' },
          { status: 500 }
        );
      }

      const permanentUrl = await persistVideoToCloudinary(rawVideoUrl);
      return Response.json({
        status: 'completed',
        taskId: data.task_id,
        videoUri: permanentUrl || rawVideoUrl,
        success: true,
      });
    }

    return Response.json({
      status: normalizedStatus || 'pending',
      taskId: data.task_id,
      success: true,
    });
  } catch (error: any) {
    console.error('❌ CRITICAL Image-to-Video failure:', error);
    return Response.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
