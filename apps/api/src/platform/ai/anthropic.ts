import { DomainError } from "@reboxe/backend";

export async function requestAnthropicJson(system: string, input: object, maxTokens = 1024): Promise<unknown> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim();
  const model = process.env.ANTHROPIC_MODEL?.trim();
  if (!key || !baseUrl || !model) throw new DomainError("AI_UNAVAILABLE", 503, "AI assistant is not configured");

  try {
    const endpoint = new URL(`${baseUrl.replace(/\/+$/, "")}/v1/messages`);
    if (endpoint.protocol !== "https:") throw new Error("The AI endpoint must use HTTPS");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "anthropic-version": "2023-06-01", "x-api-key": key, "content-type": "application/json" },
      signal: AbortSignal.timeout(25_000),
      redirect: "error",
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: JSON.stringify(input) }]
      })
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const result = await response.json() as {
      stop_reason?: string;
      content?: { type: string; text?: string }[];
    };
    if (result.stop_reason === "max_tokens") throw new Error("AI response was truncated");
    const output = result.content?.filter(block => block.type === "text").map(block => block.text).join("").trim();
    if (!output) throw new Error("AI returned no text");
    return JSON.parse(output.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1"));
  } catch {
    throw new DomainError("AI_UNAVAILABLE", 503, "AI assistant is temporarily unavailable");
  }
}
