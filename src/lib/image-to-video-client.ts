type GenerateImageToVideoParams = {
  imageUrl: string;
  prompt: string;
  theme?: string;
  apiKey: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function generateImageToVideo({
  imageUrl,
  prompt,
  theme,
  apiKey,
  pollIntervalMs = 10000,
  timeoutMs = 8 * 60 * 1000,
}: GenerateImageToVideoParams): Promise<string> {
  const response = await fetch('/api/image-to-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageUrl,
      prompt,
      theme,
      apiKey,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate video');
  }

  if (data.videoUri) {
    return data.videoUri;
  }

  if (!data.taskId) {
    throw new Error('No task ID returned from PiAPI');
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await sleep(pollIntervalMs);

    const statusResponse = await fetch(
      `/api/image-to-video-status?taskId=${encodeURIComponent(data.taskId)}&apiKey=${encodeURIComponent(apiKey)}`
    );
    const statusData = await statusResponse.json().catch(() => ({}));

    if (!statusResponse.ok) {
      throw new Error(statusData.error || 'Video status check failed');
    }

    if (statusData.status === 'completed' && statusData.videoUri) {
      return statusData.videoUri;
    }

    if (statusData.status === 'failed') {
      throw new Error(statusData.error || 'Video generation failed');
    }
  }

  throw new Error('Video generation timed out. Please try again in a moment.');
}
