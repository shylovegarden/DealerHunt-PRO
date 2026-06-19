import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Create a configured Google provider
export const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// We can export configured models here for reuse
export const defaultModel = google('models/gemini-1.5-flash');
export const structuredModel = google('models/gemini-1.5-pro'); // Better for complex JSON schema extraction
