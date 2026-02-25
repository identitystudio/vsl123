import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import https from "https";

// Helper to make https request (bypasses fetch interceptors)
function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: "POST",
      headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`${res.statusCode} ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// Debug info to be returned to client
export let lastDebugInfo: {
  modelRequested: string;
  modelSent: string;
  provider: string;
  error?: string;
  jsonBodyPreview?: string;
} = { modelRequested: '', modelSent: '', provider: '' };

// Initialize clients
// We initialize lazily or just handle missing keys gracefully in the function
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy", // Prevent crash on init if missing, check later
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || "dummy",
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy");

export type AIModel = 
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-haiku-20241022"
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307"
  | string;

interface GenerateOptions {
  messages: { role: "user" | "assistant"; content: string }[];
  system?: string;
  model?: AIModel;
  max_tokens?: number;
  temperature?: number;
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const { 
    messages, 
    system, 
    model = "claude-3-5-sonnet-20241022", // Using specific dated model
    max_tokens = 4096, 
    temperature 
  } = options;

  // Try Anthropic first (Primary)
  try {
    console.log("🤖 Attempting to use Anthropic (Primary)...");
    console.log("📋 Model being used:", model);
    console.log("📋 Model type:", typeof model);
    console.log("📋 Model length:", model.length);
    console.log("📋 Model chars:", [...model].map((c, i) => `${i}:${c}`).join(','));
    
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    // Call Anthropic - Use "latest" alias which always points to current version
    const anthropicModel = "claude-3-5-sonnet-latest";
    
    // Update debug info for client
    lastDebugInfo = {
      modelRequested: model,
      modelSent: anthropicModel,
      provider: 'Anthropic',
      jsonBodyPreview: '',
    };
    
    console.log("📋 Using anthropicModel:", anthropicModel);
    
    // Build request body and log it
    const requestBody = {
      model: anthropicModel,
      max_tokens: max_tokens,
      system: system,
      messages: messages,
      ...(temperature !== undefined && { temperature }),
    };
    const jsonBody = JSON.stringify(requestBody);
    lastDebugInfo.jsonBodyPreview = jsonBody.substring(0, 300);
    console.log("📋 REQUEST BODY model field:", requestBody.model);
    console.log("📋 JSON body (first 200 chars):", jsonBody.substring(0, 200));
    
    // Direct https request to Anthropic API (bypassing fetch entirely)
    const responseText = await httpsPost(
      "https://api.anthropic.com/v1/messages",
      {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      jsonBody
    );

    const responseData = JSON.parse(responseText);
    const textContent = responseData.content?.find((c: any) => c.type === "text");
    if (textContent && textContent.type === "text") {
      console.log("✅ Successfully generated text using Anthropic (native https)");
      return textContent.text;
    }
    throw new Error("No text content in Anthropic response");

  } catch (anthropicError: any) {
    lastDebugInfo.error = anthropicError?.message || String(anthropicError);
    console.warn("⚠️ Anthropic failed, attempting OpenAI fallback...", anthropicError?.message || anthropicError);

    // Fallback to OpenAI (Secondary)
    try {
      lastDebugInfo.provider = 'OpenAI';
      console.log("🤖 Attempting to use OpenAI (Secondary)...");
      if (!process.env.OPENAI_API_KEY && !process.env.OPEN_AI_API_KEY) {
        throw new Error("OPENAI_API_KEY (or OPEN_AI_API_KEY) is not set");
      }

      // Map Anthropic models to OpenAI equivalents
      let openaiModel = "gpt-4o"; // Default fallback
      if (model.includes("haiku")) {
        openaiModel = "gpt-4o-mini";
      } else if (model.includes("sonnet") || model.includes("opus")) {
        openaiModel = "gpt-4o";
      }

      // Convert messages
      const openaiMessages: any[] = [];
      if (system) {
        openaiMessages.push({ role: "system", content: system });
      }
      openaiMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));

      const response = await openai.chat.completions.create({
        model: openaiModel,
        messages: openaiMessages,
        max_tokens,
        temperature,
      });

      console.log("✅ Successfully generated text using OpenAI");
      return response.choices[0]?.message?.content || "";

    } catch (openaiError: any) {
      console.warn("⚠️ OpenAI fallback also failed, attempting Gemini fallback...", openaiError?.message || openaiError);

      // Fallback to Gemini (Tertiary)
      try {
        console.log("🤖 Attempting to use Gemini (Tertiary)...");
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not set");
        }

        // Map Anthropic models to Gemini equivalents
        // Using gemini-2.0-flash which is current (Feb 2026)
        let geminiModel = "gemini-2.0-flash"; // Default fallback

        const geminiGen = genAI.getGenerativeModel({ model: geminiModel });

        // Convert messages to Gemini format
        let prompt = "";
        if (system) {
          prompt += `${system}\n\n`;
        }
        
        for (const msg of messages) {
          if (msg.role === "user") {
            prompt += `User: ${msg.content}\n`;
          } else if (msg.role === "assistant") {
            prompt += `Assistant: ${msg.content}\n`;
          }
        }

        const result = await geminiGen.generateContent({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: max_tokens,
            temperature: temperature,
          },
        });

        const response = result.response;
        console.log("✅ Successfully generated text using Gemini");
        return response.text();

      } catch (geminiError: any) {
        console.error("❌ All AI providers failed (Anthropic → OpenAI → Gemini)");
        console.error("Anthropic error:", anthropicError?.message || anthropicError);
        console.error("OpenAI error:", openaiError?.message || openaiError);
        console.error("Gemini error:", geminiError?.message || geminiError);
        
        // Throw a combined error message
        throw new Error(
          `All AI providers failed. Anthropic: ${anthropicError?.message || "unknown error"}; ` +
          `OpenAI: ${openaiError?.message || "unknown error"}; ` +
          `Gemini: ${geminiError?.message || "unknown error"}`
        );
      }
    }
  }
}
