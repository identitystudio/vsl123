import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Cloudinary upload endpoint called');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string;

    console.log('File details:', { 
      fileName, 
      fileExists: !!file, 
      fileSize: file?.size,
      fileType: file?.type 
    });

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Get Cloudinary credentials from environment
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    console.log('Environment check:', {
      cloudName: cloudName ? '✓' : '✗ MISSING',
      apiKey: apiKey ? '✓' : '✗ MISSING',
      apiSecret: apiSecret ? '✓' : '✗ MISSING',
    });

    if (!cloudName || !apiKey || !apiSecret) {
      console.error('❌ Missing Cloudinary credentials');
      return NextResponse.json(
        { 
          error: 'Missing Cloudinary credentials. Please check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
          env: {
            cloudName: !!cloudName,
            apiKey: !!apiKey,
            apiSecret: !!apiSecret,
          }
        },
        { status: 500 }
      );
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const blob = new Blob([buffer], { type: file.type });

    // Prepare Cloudinary upload with authentication
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = fileName?.replace(/\s+/g, '_').replace(/\.[^/.]+$/, '') || `video_${Date.now()}`;
    
    const uploadFormData = new FormData();
    uploadFormData.append('file', blob, file.name);
    uploadFormData.append('api_key', apiKey);
    uploadFormData.append('folder', 'vsl123-background-videos');
    uploadFormData.append('public_id', publicId);
    uploadFormData.append('resource_type', 'video');
    uploadFormData.append('timestamp', timestamp.toString());

    // Generate signature for authentication
    // Only include folder, public_id, and timestamp in signature
    const params = {
      folder: 'vsl123-background-videos',
      public_id: publicId,
      timestamp: timestamp.toString(),
    };

    // Sort parameters alphabetically
    const sortedParams = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key as keyof typeof params]}`)
      .join('&');

    const stringToSign = sortedParams + apiSecret;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    uploadFormData.append('signature', signature);

    console.log(`📤 Uploading to Cloudinary: ${fileName}`);

    // Upload to Cloudinary
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      {
        method: 'POST',
        body: uploadFormData,
      }
    );

    console.log('Cloudinary response status:', uploadResponse.status);

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      console.error('❌ Cloudinary error:', errorData);
      return NextResponse.json(
        { 
          error: errorData.error?.message || 'Cloudinary upload failed',
          details: errorData
        },
        { status: 500 }
      );
    }

    const uploadData = await uploadResponse.json();

    console.log('✅ Background video uploaded to Cloudinary:', {
      publicId: uploadData.public_id,
      url: uploadData.secure_url,
    });

    // Return Cloudinary URL
    return NextResponse.json(
      {
        success: true,
        url: uploadData.secure_url,
        publicId: uploadData.public_id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Cloudinary upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
