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
        { error: "PI API key is missing. Please enter it in the theme selection options." },
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

    // The new webhook response is a Cloudinary asset object
    const videoUri = result.secure_url || result.url;
    
    if (!videoUri) {
      console.error("❌ No video URI in webhook response:", result);
      return Response.json(
        { error: "Generation complete but no video URL found in response." },
        { status: 500 }
      );
    }

    console.log("✅ Webhook video generated, URI:", videoUri);

    // Return the URL provided by the n8n webhook directly (since it handles Cloudinary upload)
    return Response.json({
      videoUri,
      success: true,
    });
  } catch (error: any) {
    console.error("❌ CRITICAL Image-to-Video failure:", error);
    return Response.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
