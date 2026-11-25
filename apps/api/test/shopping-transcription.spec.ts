import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { INVENTORY } from "../src/backend.providers";
import { ListingsController } from "../src/http/controllers/listings.controller";
import { HttpExceptionFilter } from "../src/http/filters/http-exception.filter";

const realFetch = globalThis.fetch;
const webm = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]);
let app: INestApplication;
let url: string;
const groq = vi.fn<typeof fetch>();

beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [ListingsController],
    providers: [{ provide: INVENTORY, useValue: {} }]
  }).compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.listen(0, "127.0.0.1");
  url = `${await app.getUrl()}/v1/shopping-assistant/transcription`;
});

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", "groq-test-key");
  vi.stubGlobal("fetch", groq.mockReset());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => { await app?.close(); });

function upload(contents: Uint8Array<ArrayBuffer>, mimeType = "audio/webm") {
  const body = new FormData();
  body.set("file", new Blob([contents], { type: mimeType }), "recording");
  return realFetch(url, { method: "POST", body });
}

it("uploads a Vietnamese recording to Groq and returns the transcript", async () => {
  groq.mockResolvedValueOnce(Response.json({ text: "  Tìm quạt dưới 300 nghìn.  " }));
  const response = await upload(webm);
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ text: "Tìm quạt dưới 300 nghìn." });

  const [endpoint, request] = groq.mock.calls[0]!;
  expect(endpoint).toBe("https://api.groq.com/openai/v1/audio/transcriptions");
  expect(new Headers(request?.headers).get("authorization")).toBe("Bearer groq-test-key");
  const form = request?.body as FormData;
  expect(form.get("model")).toBe("whisper-large-v3-turbo");
  expect(form.get("language")).toBe("vi");
  const audio = form.get("file") as File;
  expect(audio.name).toBe("recording.webm");
  expect(new Uint8Array(await audio.arrayBuffer())).toEqual(webm);
});

it("rejects invalid and oversized recordings before forwarding them", async () => {
  expect((await upload(new Uint8Array([1]))).status).toBe(422);
  expect((await upload(new Uint8Array(2 * 1024 * 1024 + 1))).status).toBe(413);
  expect(groq).not.toHaveBeenCalled();
});

it("returns 503 when the Groq key is missing or the provider fails", async () => {
  vi.stubEnv("GROQ_API_KEY", "");
  expect((await upload(webm)).status).toBe(503);
  expect(groq).not.toHaveBeenCalled();

  vi.stubEnv("GROQ_API_KEY", "groq-test-key");
  groq.mockResolvedValueOnce(new Response(null, { status: 429 }));
  const response = await upload(webm);
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ error: { code: "AI_UNAVAILABLE" } });
});
