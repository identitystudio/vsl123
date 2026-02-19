import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { imageUrl, prompt } = await req.json();

    if (!imageUrl || !prompt) {
      return Response.json(
        { error: "Missing imageUrl or prompt" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "Google API key not configured" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Fetch the image from URL (with basic validation)
    console.log("Fetching image from:", imageUrl);
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return Response.json(
        { error: `Failed to fetch image: ${imageResponse.statusText}` },
        { status: 400 }
      );
    }
    const mimeType = imageResponse.headers.get("content-type") || "image/png";
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer).toString("base64");

    console.log("Starting Veo video generation...");

    // Generate video with Veo 3.1 using the image
    let operation = await ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: prompt,
      image: {
        imageBytes: imageBytes,
        mimeType: mimeType,
      },
    });

    console.log("Operation started, polling for completion...");

    // Poll the operation status until the video is ready (max 5 minutes)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (!operation.done && attempts < maxAttempts) {
      console.log(`Polling attempt ${attempts + 1}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, 10000));
      
      operation = await ai.operations.getVideosOperation({
        operation: operation,
      });
      attempts++;
    }

    if (!operation.done) {
      throw new Error("Video generation timeout after 5 minutes");
    }

    if (!operation.response?.generatedVideos?.[0]?.video?.uri) {
      throw new Error("No video generated");
    }

    const videoUri = operation.response.generatedVideos[0].video.uri;
    console.log("Video generated successfully:", videoUri);
    console.log("Downloading video file from Google...");

    // Download the video file from Google with API key header
    const videoResponse = await fetch(videoUri, {
      headers: {
        "X-Goog-Api-Key": apiKey,
      },
    });

    if (!videoResponse.ok) {
      console.error("Failed to download video file:", videoResponse.statusText);
      // Return just the URI as fallback
      return Response.json({
        videoUri: videoUri,
        success: true,
        note: "Video generated but download may require authentication",
      });
    }

    // Get the video as a buffer and convert to base64
    const videoBuffer = await videoResponse.arrayBuffer();
    const videoBase64 = Buffer.from(videoBuffer).toString("base64");

    return Response.json({
      videoUri: videoUri,
      videoData: videoBase64,
      success: true,
      message: "Video generated and downloaded successfully",
    });
  } catch (error) {
    console.error("Image to video error:", error);
    const errorMsg =
      error instanceof Error ? error.message : "Failed to generate video";
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
