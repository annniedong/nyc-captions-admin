import { ApiError, GoogleGenAI } from "@google/genai";

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

// The fast model leads: its captions were comparable to the larger model's in
// testing and it answers in about a second. If it is busy, slow, or retired, we
// fall through to the others. Worst case is 10s + 15s + 10s, inside the 60s limit.
const ATTEMPTS = [
  { model: PRIMARY_MODEL, timeoutMs: 10_000 },
  { model: "gemini-3.5-flash", timeoutMs: 15_000 },
  { model: "gemini-3.1-flash-lite", timeoutMs: 10_000 },
].filter(
  (attempt, index, all) =>
    all.findIndex((other) => other.model === attempt.model) === index,
);

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    safe: { type: "boolean" },
    captions: { type: "array", items: { type: "string" } },
  },
  required: ["safe", "captions"],
};

export type CaptionResult = {
  safe: boolean;
  captions: string[];
  model: string;
};

export class CaptionError extends Error {
  constructor(
    public kind: "rate_limit" | "not_configured" | "failed",
    message: string,
  ) {
    super(message);
  }
}

// Problems another model might not have: overload, rate limits, timeouts, a
// retired model. A bad request or bad key would fail the same way everywhere.
function canTryNextModel(error: unknown): boolean {
  if (error instanceof ApiError) {
    return [404, 408, 429, 500, 502, 503, 504].includes(error.status);
  }
  return true;
}

function isBusy(error: unknown): boolean {
  return error instanceof ApiError && [429, 503].includes(error.status);
}

export async function generateCaptions(args: {
  bytes: Buffer;
  mimeType: string;
  prompt: string;
}): Promise<CaptionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new CaptionError("not_configured", "GEMINI_API_KEY is not set");
  }

  const ai = new GoogleGenAI({ apiKey });
  const contents = [
    {
      inlineData: {
        mimeType: args.mimeType,
        data: args.bytes.toString("base64"),
      },
    },
    { text: args.prompt },
  ];

  let text: string | undefined;
  let usedModel = PRIMARY_MODEL;
  let sawBusy = false;

  for (const { model, timeoutMs } of ATTEMPTS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: RESPONSE_SCHEMA,
          httpOptions: { timeout: timeoutMs },
        },
      });
      text = response.text;
      usedModel = model;
      break;
    } catch (error) {
      if (isBusy(error)) sawBusy = true;
      console.error(`Gemini request failed on ${model}`, error);
      if (!canTryNextModel(error)) break;
    }
  }

  if (text === undefined) {
    if (sawBusy) {
      throw new CaptionError("rate_limit", "Gemini is busy or rate limited");
    }
    throw new CaptionError("failed", "Gemini request failed");
  }

  let parsed: { safe?: unknown; captions?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CaptionError("failed", "Gemini returned malformed JSON");
  }

  const captions = Array.isArray(parsed.captions)
    ? parsed.captions
        .filter((c): c is string => typeof c === "string")
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c.length <= 300)
        .slice(0, 3)
    : [];

  return { safe: parsed.safe === true, captions, model: usedModel };
}
