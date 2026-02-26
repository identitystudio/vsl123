import crypto from 'crypto';

const PIAPI_BASE = 'https://api.piapi.ai/api/v1/task';

/**
 * GET /api/talking-head-avatar-status?taskId=xxx&apiKey=xxx
 * 
 * Polls PiAPI for the status of a Kling Avatar task.
 * Returns the current status and video URL when completed.
 * Each call takes <2 seconds — no Vercel timeout issues.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const apiKey = searchParams.get('apiKey');

    if (!taskId || !apiKey) {
      return Response.json(
        { error: "Missing taskId or apiKey" },
        { status: 400 }
      );
    }

    const response = await fetch(`${PIAPI_BASE}/${taskId}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ PiAPI status check failed:", response.status, text);
      return Response.json(
        { error: `Status check failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const data = result.data;

    if (!data) {
      return Response.json(
        { error: "Invalid response from PiAPI" },
        { status: 500 }
      );
    }

    // Check for actual errors (code > 0 means real failure)
    if (data.error?.code && data.error.code > 0 && data.error.message) {
      console.error("❌ PiAPI task error:", data.error);
      return Response.json({
        status: "failed",
        error: data.error.message,
        taskId,
      });
    }

    // Check for explicitly failed status
    if (data.status === "failed" || data.status === "error") {
      const errorMsg = data.error?.message || data.detail || "Avatar generation failed";
      console.error("❌ Task failed with status:", data.status, errorMsg);
      return Response.json({
        status: "failed",
        error: errorMsg,
        taskId,
      });
    }

    // Still processing
    if (data.status === "pending" || data.status === "processing") {
      return Response.json({
        status: data.status,
        taskId,
        success: true,
      });
    }

    // Completed — extract video URL
    if (data.status === "completed") {
      // Priority: video_url > works[].video.resource_without_watermark > works[].video.resource > output.video
      let videoUrl = data.output?.video_url || "";

      if (!videoUrl && Array.isArray(data.output?.works) && data.output.works.length > 0) {
        videoUrl =
          data.output.works[0].video?.resource_without_watermark ||
          data.output.works[0].video?.resource ||
          "";
      }

      if (!videoUrl) {
        videoUrl = data.output?.video || "";
      }

      if (!videoUrl) {
        return Response.json({
          status: "failed",
          error: "Generation completed but no video URL found.",
          taskId,
        });
      }

      // Persist video to Cloudinary for permanent storage
      const permanentUrl = await persistVideoToCloudinary(videoUrl);

      return Response.json({
        status: "completed",
        videoUrl: permanentUrl || videoUrl,
        taskId,
        success: true,
      });
    }

    // Any other status (queued, running, etc.) — treat as still processing
    console.log("⏳ Task status:", data.status, "(still processing)");
    return Response.json({
      status: "processing",
      taskId,
      success: true,
    });
  } catch (error: any) {
    console.error("❌ Status check error:", error);
    return Response.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

/**
 * Downloads ephemeral video and uploads to Cloudinary for permanent storage.
 */
async function persistVideoToCloudinary(videoUrl: string): Promise<string | null> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const clApiKey = process.env.CLOUDINARY_API_KEY;
  const clApiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !clApiKey || !clApiSecret) {
    console.warn("⚠️ Cloudinary not configured, returning original URL");
    return null;
  }

  try {
    console.log("🛰️ Downloading avatar video for Cloudinary...");
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) return null;

    const videoBuffer = await videoResponse.arrayBuffer();
    const base64Video = Buffer.from(videoBuffer).toString('base64');

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `avatar_video_${Date.now()}`;

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
    formData.append('file', `data:video/mp4;base64,${base64Video}`);
    formData.append('api_key', clApiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', 'vsl123-talking-heads');
    formData.append('public_id', publicId);
    formData.append('signature', signature);
    formData.append('resource_type', 'video');

    const clResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      { method: 'POST', body: formData }
    );

    if (!clResponse.ok) {
      console.error("❌ Cloudinary video upload failed:", await clResponse.text());
      return null;
    }

    const clData = await clResponse.json();
    console.log("✨ Avatar video saved permanently:", clData.secure_url);
    return clData.secure_url;
  } catch (err: any) {
    console.error("❌ Video persistence error:", err?.message);
    return null;
  }
}
