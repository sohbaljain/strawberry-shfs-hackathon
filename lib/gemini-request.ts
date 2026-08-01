type GeminiRequestBody = Record<string, unknown>;

export type GeminiPart = {
  text?: string;
};

export type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
    finishReason?: string;
    safetyRatings?: unknown[];
  }>;
  modelVersion?: string;
  promptFeedback?: unknown;
  usageMetadata?: unknown;
};

export type GeminiRequestResult = {
  model: string;
  response: GeminiResponse;
};

export class GeminiUnavailableError extends Error {
  constructor() {
    super("Gemini is temporarily unavailable.");
    this.name = "GeminiUnavailableError";
  }
}

const geminiModels = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
const maxAttempts = 3;
const requestTimeoutMs = 20_000;
const retryableStatuses = new Set([408, 429, 500, 502, 503, 504]);
const backoffDelays = [1000, 2000, 4000];

export async function requestGeminiWithFallback(
  body: GeminiRequestBody,
): Promise<GeminiRequestResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new GeminiUnavailableError();
  }

  for (let modelIndex = 0; modelIndex < geminiModels.length; modelIndex += 1) {
    const model = geminiModels[modelIndex];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      console.log(`[Gemini] model=${model} attempt=${attempt}/${maxAttempts}`);

      try {
        const response = await fetchGemini(model, apiKey, body);

        if (response.ok) {
          return {
            model,
            response: (await response.json()) as GeminiResponse,
          };
        }

        console.log(`[Gemini] model=${model} failed status=${response.status}`);

        if (!retryableStatuses.has(response.status)) {
          break;
        }

        if (attempt < maxAttempts) {
          await delay(backoffDelays[attempt - 1]);
        }
      } catch (error) {
        console.log(`[Gemini] model=${model} failed status=${failureStatus(error)}`);

        if (!isRetryableNetworkError(error)) {
          break;
        }

        if (attempt < maxAttempts) {
          await delay(backoffDelays[attempt - 1]);
        }
      }
    }

    const nextModel = geminiModels[modelIndex + 1];
    if (nextModel) {
      console.log(`[Gemini] switching to model=${nextModel}`);
    }
  }

  throw new GeminiUnavailableError();
}

async function fetchGemini(model: string, apiKey: string, body: GeminiRequestBody) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    return await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableNetworkError(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      error.message.toLowerCase().includes("fetch"))
  );
}

function failureStatus(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }

  return "network";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
