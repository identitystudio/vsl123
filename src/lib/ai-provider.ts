import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// Initialize clients
// We initialize lazily or just handle missing keys gracefully in the function
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "dummy", // Prevent crash on init if missing, check later
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API_KEY || "dummy",
});

export type AIModel = 
  | "claude-3-5-sonnet-20241022"
  | "claude-3-5-haiku-20241022"
  | "claude-haiku-4-5-20251001" // Keeping user's custom model string
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
    model = "claude-3-5-haiku-20241022", 
    max_tokens = 4096, 
    temperature 
  } = options;

  // Try Anthropic first
  try {
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
      return textContent.text;
    }
    throw new Error("No text content in Anthropic response");

  } catch (anthropicError: any) {
    console.warn("⚠️ Anthropic failed, attempting OpenAI fallback...", anthropicError?.message || anthropicError);

    // Fallback to OpenAI
    try {
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

      return response.choices[0]?.message?.content || "";

    } catch (openaiError: any) {
      console.error("❌ OpenAI fallback also failed:", openaiError?.message || openaiError);
      // Throw the original Anthropic error to avoid confusing the caller, 
      // or throw a combined error. Usually original is more useful if configured primarily for Anthropic.
      throw anthropicError; 
    }
  }
}
