import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { folder, resourceType } = await request.json();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary not configured' },
        { status: 500 }
      );
    }

    const safeFolder = typeof folder === 'string' && folder.trim() ? folder.trim() : 'vsl123-uploads';
    const safeResourceType = resourceType === 'video' ? 'video' : 'image';
    const timestamp = Math.floor(Date.now() / 1000);
    const publicIdPrefix = safeResourceType === 'video' ? 'vid' : 'img';
    const publicId = `${publicIdPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const params = {
      folder: safeFolder,
      public_id: publicId,
      timestamp: timestamp.toString(),
    };

    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    const signature = crypto.createHash('sha1').update(sortedParams + apiSecret).digest('hex');

    return NextResponse.json({
      cloudName,
      apiKey,
      folder: safeFolder,
      publicId,
      timestamp,
      signature,
      resourceType: safeResourceType,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/${safeResourceType}/upload`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Cloudinary signature' },
      { status: 500 }
    );
  }
}
