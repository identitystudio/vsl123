import { GoogleGenAI } from "@google/genai";
import { getThemeConfig, type ImageTheme } from "@/lib/image-themes";
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt, theme = 'realism' } = await req.json();
    console.log("🎬 Video Generation Request:", { imageUrl: imageUrl?.substring(0, 50), prompt, theme });

    if (!imageUrl || !prompt) {
      return Response.json(
        { error: "Missing imageUrl or prompt" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error("❌ Google API key missing");
      return Response.json(
        { error: "Google API key not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const themeConfig = getThemeConfig(theme as ImageTheme);

    // Fetch the image from URL
    console.log("📥 Fetching image to convert to video...");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error("❌ Failed to fetch image:", imageResponse.status, imageResponse.statusText);
      return Response.json(
        { error: `Failed to fetch image: ${imageResponse.statusText}` },
        { status: 400 }
      );
    }
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer).toString("base64");

    console.log("🚀 Starting Google Veo generation...");

    // Enhance prompt with theme-specific video modifier
    const enhancedPrompt = `${prompt}. ${themeConfig.videoPromptModifier}`;

    // Generate video with Veo 3.1
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: enhancedPrompt,
      image: {
        imageBytes: imageBytes,
        mimeType: mimeType,
      },
    });

    console.log("⏳ Operation started ID:", (operation as any).id || 'unknown');

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!operation.done && attempts < maxAttempts) {
      console.log(`⏱️ Polling attempt ${attempts + 1}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, 15000));
      
      try {
        operation = await ai.operations.getVideosOperation({
          operation: operation,
        });
      } catch (pollErr: any) {
        console.warn("⚠️ Poll attempt failed, retrying...", pollErr.message);
      }
      attempts++;
    }

    if (!operation.done) {
      console.error("❌ Video generation timed out");
      return Response.json(
        { error: "Video taking too long. Try again or check later." },
        { status: 504 }
      );
    }

    if ((operation as any).error) {
      const err = (operation as any).error;
      console.error("❌ Google AI error:", err);
      return Response.json(
        { error: `Google AI rejected: ${err.message || JSON.stringify(err)}` },
        { status: 500 }
      );
    }

    const raiReasons = operation.response?.raiMediaFilteredReasons;
    if (raiReasons && raiReasons.length > 0) {
      console.warn("⚠️ RAI Filter triggered:", raiReasons);
      return Response.json(
        { error: `Safety filter: ${raiReasons[0]}. Try a different prompt.` },
        { status: 400 }
      );
    }

    if (!operation.response?.generatedVideos?.[0]?.video?.uri) {
      console.error("❌ No video URI in response");
      return Response.json(
        { error: "Generation complete but no video file found." },
        { status: 500 }
      );
    }

    const videoUri = operation.response.generatedVideos[0].video.uri;
    console.log("✅ Video generated, URI:", videoUri);

    // Download and move to Cloudinary
    try {
      console.log("🛰️ Downloading video for Cloudinary transfer...");
      const videoResponse = await fetch(videoUri, {
        headers: { "X-Goog-Api-Key": apiKey },
      });

      if (!videoResponse.ok) {
        console.warn("⚠️ Download failed, returning Google URI as fallback");
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
      const publicId = `gen_video_${Date.now()}`;
      
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
