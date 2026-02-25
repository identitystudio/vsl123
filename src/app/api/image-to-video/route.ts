import crypto from 'crypto';
import { getThemeConfig, type ImageTheme } from "@/lib/image-themes";

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt, theme = 'realism', apiKey } = await req.json();
    console.log("🎬 Video Generation Request (webhook):", { imageUrl: imageUrl?.substring(0, 50), prompt, theme });

    if (!imageUrl || !prompt) {
      return Response.json(
        { error: "Missing imageUrl or prompt" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      console.warn("⚠️ Webhook API key not provided");
      return Response.json(
        { error: "Webhook API key is missing. Please enter it in the theme selection options." },
        { status: 400 }
      );
    }

    console.log("🚀 Starting webhook video generation...");

    const themeConfig = getThemeConfig(theme as ImageTheme);
    const enhancedPrompt = `${prompt}. ${themeConfig.videoPromptModifier}`;

    const webhookUrl = "https://themacularprogram.app.n8n.cloud/webhook/video-generation";
    
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        prompt: enhancedPrompt,
        image_url: imageUrl,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Webhook HTTP error:", response.status, text);
      return Response.json(
        { error: `Webhook failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Webhook should return an array with one object
    if (!Array.isArray(data) || data.length === 0) {
      console.error("❌ Invalid webhook response format:", data);
      return Response.json(
        { error: "Invalid response from webhook." },
        { status: 500 }
      );
    }

    const result = data[0];

    // Check message logic from webhook
    if (result.message && result.message.toLowerCase() !== "success") {
      console.error("❌ Webhook error message:", result.message);
      return Response.json(
        { error: result.message }, // Example: "insufficient funds"
        { status: 400 }
      );
    }

    // Check inner code and errors
    if (result.code !== 200 || !result.data || result.data.status !== "completed") {
      const logError = Array.isArray(result.data?.logs) ? result.data.logs[0] : null;
      const errorMsg = result.data?.error?.message || logError || result.message || "Video generation failed";
      console.error("❌ Webhook generation failed:", errorMsg);
      return Response.json(
        { error: errorMsg },
        { status: 400 }
      );
    }

    const videoUri = result.data?.output?.video;
    
    if (!videoUri) {
      console.error("❌ No video URI in webhook response");
      return Response.json(
        { error: "Generation complete but no video file found." },
        { status: 500 }
      );
    }

    console.log("✅ Webhook video generated, URI:", videoUri);

    // Download and move to Cloudinary (since webhook URL may be ephemeral)
    try {
      console.log("🛰️ Downloading video for Cloudinary transfer...");
      const videoResponse = await fetch(videoUri);

      if (!videoResponse.ok) {
        console.warn("⚠️ Download failed, returning webhook URI as fallback");
        return Response.json({ videoUri, success: true });
      }

      const videoBuffer = await videoResponse.arrayBuffer();
      const base64Video = Buffer.from(videoBuffer).toString('base64');
      
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const clApiKey = process.env.CLOUDINARY_API_KEY;
      const clApiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!cloudName || !clApiKey || !clApiSecret) {
        console.warn("⚠️ Cloudinary not configured");
        return Response.json({ videoUri, success: true });
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const publicId = `gen_video_webhook_${Date.now()}`;
      
      const params = {
        folder: 'vsl123-background-videos', // Use existing successful folder
        public_id: publicId,
        timestamp: timestamp.toString(),
      };

      const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key as keyof typeof params]}`)
        .join('&');

      const stringToSign = sortedParams + clApiSecret;
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

      console.log("☁️ Uploading to Cloudinary...");
      const formData = new FormData();
      formData.append('file', `data:video/mp4;base64,${base64Video}`);
      formData.append('api_key', clApiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('folder', 'vsl123-background-videos');
      formData.append('public_id', publicId);
      formData.append('signature', signature);
      formData.append('resource_type', 'video');

      const clResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!clResponse.ok) {
        const clErrorText = await clResponse.text();
        console.error("❌ Cloudinary upload failed:", clErrorText);
        return Response.json(
          { error: "Failed to save video to cloud. Check logs." },
          { status: 500 }
        );
      }

      const clData = await clResponse.json();
      console.log("✨ Final Cloudinary URL:", clData.secure_url);

      return Response.json({
        videoUri: clData.secure_url,
        success: true,
      });
    } catch (processErr: any) {
      console.error("❌ Final processing error:", processErr);
      return Response.json({ videoUri, success: true });
    }
  } catch (error: any) {
    console.error("❌ CRITICAL Image-to-Video failure:", error);
    return Response.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
