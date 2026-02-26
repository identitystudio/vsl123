import crypto from 'crypto';

const PIAPI_BASE = 'https://api.piapi.ai/api/v1/task';

const MIN_AVATAR_DIMENSION = 512;

/**
 * Extract image dimensions from a data URL by parsing PNG/JPEG binary headers.
 */
function getDataUrlImageDimensions(dataUrl: string): { width: number; height: number } | null {
  try {
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) return null;
    const buffer = Buffer.from(base64Data, 'base64');

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xFF) { offset++; continue; }
        const marker = buffer[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * POST /api/talking-head-avatar
 * 
 * Submits a Kling Avatar task directly to PiAPI.
 * Returns instantly with a taskId for polling — no timeout issues on Vercel.
 */
export async function POST(req: Request) {
  try {
    const { image_url, local_dubbing_url, prompt, apiKey } = await req.json();
    console.log("🗣️ Talking Head Avatar Request:", {
      image_url: image_url?.substring(0, 50),
      local_dubbing_url: local_dubbing_url?.substring(0, 50),
      prompt,
    });

    if (!image_url) {
      return Response.json(
        { error: "Missing image_url — upload an avatar face image" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return Response.json(
        { error: "PiAPI key is missing. Please enter it in the avatar section." },
        { status: 400 }
      );
    }

    // If image_url is a data URL, validate dimensions and upload to Cloudinary
    let finalImageUrl = image_url;
    if (image_url.startsWith('data:')) {
      const dims = getDataUrlImageDimensions(image_url);
      if (dims && (dims.width < MIN_AVATAR_DIMENSION || dims.height < MIN_AVATAR_DIMENSION)) {
        return Response.json(
          { error: `Image too small (${dims.width}×${dims.height}px). Kling AI requires at least ${MIN_AVATAR_DIMENSION}×${MIN_AVATAR_DIMENSION}px.` },
          { status: 400 }
        );
      }

      console.log("☁️ Uploading avatar image to Cloudinary...");
      finalImageUrl = await uploadToCloudinary(image_url);
      if (!finalImageUrl) {
        return Response.json(
          { error: "Failed to upload avatar image to cloud storage." },
          { status: 500 }
        );
      }
      console.log("✅ Avatar image uploaded:", finalImageUrl);
    }

    // Submit directly to PiAPI — returns instantly with task_id
    console.log("🚀 Submitting to PiAPI Kling Avatar API...");

    const piApiResponse = await fetch(PIAPI_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "kling",
        task_type: "avatar",
        input: {
          image_url: finalImageUrl,
          local_dubbing_url: local_dubbing_url || "",
          prompt: prompt || "Person speaks naturally",
          mode: "std",
          batch_size: 1,
        },
      }),
    });

    if (!piApiResponse.ok) {
      const text = await piApiResponse.text();
      console.error("❌ PiAPI error:", piApiResponse.status, text);
      return Response.json(
        { error: `PiAPI request failed: ${piApiResponse.statusText}` },
        { status: piApiResponse.status }
      );
    }

    const result = await piApiResponse.json();

    if (result.code !== 200 || !result.data?.task_id) {
      const errorMsg = result.data?.error?.message || result.message || "Failed to submit avatar task";
      console.error("❌ PiAPI task submission failed:", errorMsg);
      return Response.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    console.log("✅ Task submitted! task_id:", result.data.task_id, "status:", result.data.status);

    return Response.json({
      taskId: result.data.task_id,
      status: result.data.status, // "pending"
      success: true,
    });
  } catch (error: any) {
    console.error("❌ CRITICAL Talking Head Avatar failure:", error);
    return Response.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

async function uploadToCloudinary(dataUrl: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const clApiKey = process.env.CLOUDINARY_API_KEY;
  const clApiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !clApiKey || !clApiSecret) {
    console.warn("⚠️ Cloudinary not configured");
    return null;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `avatar_face_${Date.now()}`;

  const params = {
    folder: 'vsl123-talking-heads',
    public_id: publicId,
    timestamp: timestamp.toString(),
  };

  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key as keyof typeof params]}`)
    .join('&');

  const signature = crypto.createHash('sha1').update(sortedParams + clApiSecret).digest('hex');

  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('api_key', clApiKey);
  formData.append('timestamp', timestamp.toString());
  formData.append('folder', 'vsl123-talking-heads');
  formData.append('public_id', publicId);
  formData.append('signature', signature);

  const clResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!clResponse.ok) {
    console.error("❌ Cloudinary upload failed:", await clResponse.text());
    return null;
  }

  return (await clResponse.json()).secure_url;
}
