import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
  | "claude-3-5-sonnet-20240620"
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
    model = "claude-3-5-sonnet-20240620", // Using stable, verified model
    max_tokens = 4096, 
    temperature 
  } = options;

  // Try Anthropic first (Primary)
  try {
    console.log("🤖 Attempting to use Anthropic (Primary)...");
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }

    // Call Anthropic
    const response = await anthropic.messages.create({
      model,
      max_tokens,
      system,
      messages,
      temperature,
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (textContent && textContent.type === "text") {
      console.log("✅ Successfully generated text using Anthropic");
      return textContent.text;
    }
    throw new Error("No text content in Anthropic response");

  } catch (anthropicError: any) {
    console.warn("⚠️ Anthropic failed, attempting OpenAI fallback...", anthropicError?.message || anthropicError);

    // Fallback to OpenAI (Secondary)
    try {
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
        let geminiModel = "gemini-2.5-flash"; // Default fallback - best price-performance
        if (model.includes("haiku")) {
          geminiModel = "gemini-2.5-flash"; // Fast model for haiku - best for high volume tasks
        } else if (model.includes("sonnet") || model.includes("opus")) {
          geminiModel = "gemini-2.5-pro"; // Advanced thinking model for sonnet/opus
        }

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
