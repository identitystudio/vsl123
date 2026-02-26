import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/upload-video
 * 
 * Uploads a video to Cloudinary and returns a permanent URL.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = (formData.get('folder') as string) || 'vsl123-videos';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary not configured' },
        { status: 500 }
      );
    }

    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const params = {
      folder,
      public_id: publicId,
      timestamp: timestamp.toString(),
    };

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    const signature = crypto.createHash('sha1').update(sortedParams + apiSecret).digest('hex');

    const uploadFormData = new FormData();
    uploadFormData.append('file', blob, file.name);
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('folder', folder);
    uploadFormData.append('public_id', publicId);
    uploadFormData.append('timestamp', timestamp.toString());
    uploadFormData.append('signature', signature);

    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: 'POST', body: uploadFormData }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      return NextResponse.json(
        { error: errorData.error?.message || 'Video upload failed' },
        { status: 500 }
      );
    }

    const data = await uploadResponse.json();

    return NextResponse.json({
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
