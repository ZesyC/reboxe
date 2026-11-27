import { Logger } from "@nestjs/common";
import { DomainError } from "@reboxe/backend";

const logger = new Logger("AiJsonProvider");

export async function requestAiJson<T>(system: string, input: object, parse: (output: unknown) => T): Promise<T> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim();
  const model = process.env.ANTHROPIC_MODEL?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  try {
    if (key && baseUrl && model) {
      try {
        return parse(await requestAnthropicJson(baseUrl, key, model, system, input));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.warn(`Anthropic request failed (${message})${groqKey ? "; falling back to Groq" : ""}`);
        if (!groqKey) throw error;
      }
    }
    if (groqKey) return parse(await requestGroqJson(groqKey, system, input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error(`AI request failed: ${message}`);
    if (error instanceof DomainError) throw error;
    throw new DomainError("AI_UNAVAILABLE", 503, "AI assistant is temporarily unavailable");
  }
  throw new DomainError("AI_UNAVAILABLE", 503, "AI assistant is not configured");
}

export function resolveCategoryId<T extends { id: string; name: string }>(raw: string, categories: readonly T[]): string | null {
  const exact = categories.find((category) => category.id === raw);
  if (exact) return exact.id;
  const lower = raw.toLowerCase();
  const byId = categories.find((category) => category.id.toLowerCase() === lower);
  if (byId) return byId.id;
  const normalized = normalizeCategoryText(raw);
  const byName = categories.find((category) => normalizeCategoryText(category.name) === normalized);
  return byName?.id ?? null;
}

function normalizeCategoryText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/gi, "d").trim().toLowerCase();
}

function isGroqReasoningModel(model: string): boolean {
  return /gpt-oss|qwen3|deepseek-r1/i.test(model);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const parsed = tryParsePlainObject(trimmed);
  if (parsed) return parsed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const fromFence = tryParsePlainObject(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        const candidate = tryParsePlainObject(trimmed.slice(start, i + 1));
        if (candidate) return candidate;
        start = -1;
      }
    }
  }

  throw new Error("AI returned invalid JSON object");
}

function tryParsePlainObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

async function requestAnthropicJson(baseUrl: string, key: string, model: string, system: string, input: object) {
  const normalizedBase = baseUrl.replace(/\/+$/, "").replace(/\/v1$/i, "");
  const endpoint = new URL(`${normalizedBase}/v1/messages`);
  if (endpoint.protocol !== "https:") throw new Error("The AI endpoint must use HTTPS");
  const result = await postJson(endpoint, { "anthropic-version": "2023-06-01", "x-api-key": key }, {
    model,
    max_tokens: 2048,
    temperature: 0,
    system,
    messages: [{ role: "user", content: JSON.stringify(input) }]
  }, 25_000) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  if (result.stop_reason === "max_tokens") throw new Error("AI response was truncated");
  const output = result.content?.filter(block => block.type === "text").map(block => block.text).join("").trim();
  if (!output) throw new Error("AI returned no text");
  return parseJsonObject(output);
}

async function requestGroqJson(key: string, system: string, input: object) {
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  const result = await postJson("https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${key}` }, {
    model,
    temperature: 0,
    ...(isGroqReasoningModel(model) ? { reasoning_effort: "low" } : {}),
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) }
    ]
  }, 20_000) as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
  const choice = result.choices?.[0];
  const output = choice?.message?.content;
  if (choice?.finish_reason !== "stop" || !output) throw new Error("AI response did not complete");
  return parseJsonObject(output);
}

async function postJson(endpoint: string | URL, headers: Record<string, string>, body: object, timeoutMs: number): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const preview = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200);
    throw new Error(preview ? `AI HTTP ${response.status}: ${preview}` : `AI HTTP ${response.status}`);
  }
  return response.json();
}
