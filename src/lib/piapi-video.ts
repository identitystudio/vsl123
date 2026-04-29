import crypto from 'crypto';

export const PIAPI_BASE = 'https://api.piapi.ai/api/v1/task';

export function extractPiApiVideoUrl(data: any): string {
  const output = data?.output;
  if (!output) return '';

  if (typeof output.video_url === 'string' && output.video_url) return output.video_url;
  if (typeof output.video === 'string' && output.video) return output.video;
  if (typeof output.url === 'string' && output.url) return output.url;
  if (typeof output.resource === 'string' && output.resource) return output.resource;
  if (typeof output.resource_without_watermark === 'string' && output.resource_without_watermark) {
    return output.resource_without_watermark;
  }

  if (Array.isArray(output.videos) && output.videos.length > 0) {
    const firstVideo = output.videos[0];
    if (typeof firstVideo === 'string') return firstVideo;
    if (typeof firstVideo?.url === 'string' && firstVideo.url) return firstVideo.url;
    if (typeof firstVideo?.video_url === 'string' && firstVideo.video_url) return firstVideo.video_url;
    if (typeof firstVideo?.resource === 'string' && firstVideo.resource) return firstVideo.resource;
    if (typeof firstVideo?.resource_without_watermark === 'string' && firstVideo.resource_without_watermark) {
      return firstVideo.resource_without_watermark;
    }
  }

  if (Array.isArray(output.works) && output.works.length > 0) {
    const work = output.works[0];
    if (typeof work?.video?.resource_without_watermark === 'string' && work.video.resource_without_watermark) {
      return work.video.resource_without_watermark;
    }
    if (typeof work?.video?.resource === 'string' && work.video.resource) return work.video.resource;
    if (typeof work?.video_url === 'string' && work.video_url) return work.video_url;
    if (typeof work?.url === 'string' && work.url) return work.url;
  }

  return '';
}

export function getPiApiFailureMessage(error: { code?: number; message?: string; raw_message?: string } | null | undefined): string {
  if (!error) return 'Video generation failed';
  return error.message || error.raw_message || 'Video generation failed';
}

export async function persistVideoToCloudinary(videoUrl: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  try {
    const response = await fetch(videoUrl);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    const blob = new Blob([buffer], { type: 'video/mp4' });
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `veo3_video_${Date.now()}`;

    const params = {
      folder: 'vsl123-veo3-videos',
      public_id: publicId,
      timestamp: timestamp.toString(),
    };

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    const signature = crypto.createHash('sha1').update(sortedParams + apiSecret).digest('hex');

    const formData = new FormData();
    formData.append('file', blob, `${publicId}.mp4`);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', params.folder);
    formData.append('public_id', publicId);
    formData.append('signature', signature);
    formData.append('resource_type', 'video');

    const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      console.error('Cloudinary video upload failed:', await uploadResponse.text());
      return null;
    }

    const uploadData = await uploadResponse.json();
    return uploadData.secure_url || null;
  } catch (error: any) {
    console.error('Cloudinary persistence error:', error?.message || error);
    return null;
  }
}
