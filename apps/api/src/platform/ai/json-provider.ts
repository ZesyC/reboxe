import { DomainError } from "@reboxe/backend";

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
        if (!groqKey) throw error;
      }
    }
    if (groqKey) return parse(await requestGroqJson(groqKey, system, input));
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError("AI_UNAVAILABLE", 503, "AI assistant is temporarily unavailable");
  }
  throw new DomainError("AI_UNAVAILABLE", 503, "AI assistant is not configured");
}

async function requestAnthropicJson(baseUrl: string, key: string, model: string, system: string, input: object) {
  const endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/messages`);
  if (endpoint.protocol !== "https:") throw new Error("The AI endpoint must use HTTPS");
  const result = await postJson(endpoint, { "anthropic-version": "2023-06-01", "x-api-key": key }, {
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: JSON.stringify(input) }]
  }, 25_000) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  if (result.stop_reason === "max_tokens") throw new Error("AI response was truncated");
  const output = result.content?.filter(block => block.type === "text").map(block => block.text).join("").trim();
  if (!output) throw new Error("AI returned no text");
  return JSON.parse(output.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1")) as unknown;
}

async function requestGroqJson(key: string, system: string, input: object) {
  const result = await postJson("https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${key}` }, {
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    max_completion_tokens: 4096,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(input) }
    ]
  }, 10_000) as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
  const choice = result.choices?.[0];
  const output = choice?.message?.content;
  if (choice?.finish_reason !== "stop" || !output) throw new Error("AI response did not complete");
  return JSON.parse(output) as unknown;
}

async function postJson(endpoint: string | URL, headers: Record<string, string>, body: object, timeoutMs: number): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error",
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
  return response.json();
}
