import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestQuickListing } from "../src/platform/ai/quick-listing";

const turns = [{ message: "Bán đầm hoa 140k, trước mua 250k. Đã mặc vài lần." }];
const categories = [{ id: "fashion", name: "Thời trang" }];
const draft = {
  title: "Đầm hoa", price: 140000, categoryId: "fashion",
  conditionGrade: "FAIR", conditionNotes: "Đã mặc vài lần"
};

function mockMessage(output: unknown) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
    content: [{ type: "text", text: JSON.stringify(output) }], stop_reason: "end_turn"
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("quick listing assistant", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://ai.example.test/");
    vi.stubEnv("ANTHROPIC_MODEL", "test-model");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks a follow-up for missing facts and passes later replies with their question", async () => {
    mockMessage(draft);
    const first = await suggestQuickListing({ turns }, categories);
    expect(first).toEqual({ draft, question: "Kiện này nặng khoảng bao nhiêu gam?" });

    const fetchMock = mockMessage({ ...draft, weightGram: 300 });
    const conversation = { turns: [...turns, { question: first.question!, message: "Tầm 300g" }] };
    await expect(suggestQuickListing(conversation, categories)).resolves.toEqual({
      draft: { ...draft, weightGram: 300 }, question: null
    });
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://ai.example.test/v1/messages");
    expect(request?.redirect).toBe("error");
    const body = JSON.parse(String(request?.body));
    expect(body.model).toBe("test-model");
    expect(JSON.parse(body.messages[0].content)).toEqual({ ...conversation, categories });
  });

  it("asks for a category when the provider suggests one outside the catalog", async () => {
    mockMessage({ ...draft, categoryId: "invented" });
    const result = await suggestQuickListing({ turns }, categories);
    expect(result.draft.categoryId).toBeUndefined();
    expect(result.question).toContain("danh mục");
  });

  it("rejects model output outside the draft schema and handles provider failure", async () => {
    mockMessage({ ...draft, shopId: "another-shop", status: "ACTIVE" });
    await expect(suggestQuickListing({ turns }, categories)).rejects.toMatchObject({ code: "AI_UNAVAILABLE", status: 503 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 429 })));
    await expect(suggestQuickListing({ turns }, categories)).rejects.toMatchObject({ code: "AI_UNAVAILABLE", status: 503 });
  });
});
