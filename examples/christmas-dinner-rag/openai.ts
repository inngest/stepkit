/* eslint-disable */
import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (openaiInstance) {
    return openaiInstance;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required. Get your API key at https://platform.openai.com/api-keys"
    );
  }

  openaiInstance = new OpenAI({
    apiKey,
  });

  return openaiInstance;
}
