import { trackPlatformUsage as trackUsage } from "@/lib/usageTracking";

/**
 * Centralized AI provider abstraction.
 *
 * Provider priority:
 *   1. DeepSeek (deepseek-chat) — primary, cheap
 *   2. OpenAI (gpt-4o-mini)     — runtime fallback if DeepSeek fails or is unconfigured
 *
 * Logs to console whenever the fallback activates so Vercel logs surface it.
 */

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

const PROVIDERS = {
  deepseek: {
    url:   "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    key:   DEEPSEEK_KEY,
  },
  openai: {
    url:   "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o-mini",
    key:   OPENAI_KEY,
  },
};

export function aiAvailable() {
  return !!(DEEPSEEK_KEY || OPENAI_KEY);
}

export function activeProvider() {
  return DEEPSEEK_KEY ? "deepseek" : OPENAI_KEY ? "openai" : null;
}

/**
 * Call the AI with automatic fallback.
 *
 * @param {Object[]} messages   - Array of {role, content} message objects
 * @param {Object}   options    - max_tokens, temperature, system (optional system prompt string)
 * @param {string}   callerTag  - Short label for logging (e.g. "ai-chat", "social-captions")
 * @returns {Promise<string>}   - The assistant's reply text
 * @throws                       - If all providers fail or none are configured
 */
export async function callAI(messages, options = {}, callerTag = "ai") {
  const { max_tokens = 512, temperature = 0.7, system } = options;

  if (!aiAvailable()) {
    throw new Error("No AI provider configured — set DEEPSEEK_API_KEY or OPENAI_API_KEY");
  }

  const builtMessages = system
    ? [{ role: "system", content: system }, ...messages]
    : messages;

  // Ordered list of providers to try
  const order = DEEPSEEK_KEY
    ? [PROVIDERS.deepseek, PROVIDERS.openai].filter((p) => p.key)
    : [PROVIDERS.openai].filter((p) => p.key);

  let lastError;

  for (let i = 0; i < order.length; i++) {
    const provider = order[i];
    const isFallback = i > 0;

    if (isFallback) {
      console.warn(
        `[ai/${callerTag}] DeepSeek failed — falling back to OpenAI (${provider.model}). Previous error: ${lastError?.message}`
      );
    }

    try {
      const res = await fetch(provider.url, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${provider.key}`,
        },
        body: JSON.stringify({
          model:       provider.model,
          max_tokens,
          temperature,
          messages:    builtMessages,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${provider.model} HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error(`${provider.model} returned empty content`);

      if (isFallback) {
        console.warn(`[ai/${callerTag}] OpenAI fallback succeeded`);
        trackUsage("aiFallbackCalls");
      }

      // Track usage (approximate token estimate: 4 chars ≈ 1 token)
      const promptChars   = builtMessages.reduce((s, m) => s + (m.content?.length || 0), 0);
      const responseChars = content.length;
      const estimatedTokens = Math.round((promptChars + responseChars) / 4);
      trackUsage("aiCalls");
      trackUsage("aiTokensEst", estimatedTokens);

      return content.trim();
    } catch (err) {
      lastError = err;
      console.error(`[ai/${callerTag}] Provider ${provider.model} failed:`, err.message);
    }
  }

  throw lastError || new Error("All AI providers failed");
}
