import { DomainError } from "@reboxe/backend";

export const maxShoppingAudioBytes = 2 * 1024 * 1024;
export type ShoppingAudioFile = { buffer: Buffer; mimetype: string };

export async function transcribeShoppingAudio(file?: ShoppingAudioFile): Promise<{ text: string }> {
  if (!file?.buffer.length) throw new DomainError("VALIDATION_FAILED", 422, "A voice recording is required");
  const mimeType = file.mimetype.split(";")[0]?.trim().toLowerCase() ?? "";
  const extension = recordingExtension(mimeType, file.buffer);
  if (!extension) throw new DomainError("VALIDATION_FAILED", 422, "Use a WebM, Ogg or MP4 audio recording");

  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new DomainError("AI_UNAVAILABLE", 503, "Voice transcription is not configured");

  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(file.buffer)], { type: mimeType }), `recording.${extension}`);
  body.set("model", "whisper-large-v3-turbo");
  body.set("language", "vi");
  body.set("response_format", "json");
  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error(`Transcription HTTP ${response.status}`);
    const result = await response.json() as { text?: unknown };
    if (typeof result?.text !== "string") throw new Error("Missing transcript");
    return { text: result.text.trim().slice(0, 500) };
  } catch {
    throw new DomainError("AI_UNAVAILABLE", 503, "Voice transcription is temporarily unavailable");
  }
}

function recordingExtension(mimeType: string, bytes: Buffer): string | undefined {
  if (mimeType === "audio/webm" && bytes.subarray(0, 4).toString("hex") === "1a45dfa3") return "webm";
  if (mimeType === "audio/ogg" && bytes.toString("latin1", 0, 4) === "OggS") return "ogg";
  if (mimeType === "audio/mp4" && bytes.toString("latin1", 4, 8) === "ftyp") return "mp4";
}
