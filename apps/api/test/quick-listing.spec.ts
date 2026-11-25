import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quickListingConversationSchema } from "@reboxe/shared";
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
    vi.stubEnv("GROQ_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("asks a follow-up for missing facts and passes later replies with their question", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq-test-key");
    mockMessage(draft);
    const first = await suggestQuickListing({ turns }, categories);
    expect(first).toEqual({ draft, question: "Kiện này nặng khoảng bao nhiêu gam?" });

    const fetchMock = mockMessage({ ...draft, weightGram: 300 });
    const conversation = { turns: [...turns, { question: first.question!, message: "Tầm 300g" }] };
    await expect(suggestQuickListing(conversation, categories)).resolves.toEqual({
      draft: { ...draft, weightGram: 300 }, question: null
    });
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(url)).toBe("https://ai.example.test/v1/messages");
    expect(request?.redirect).toBe("error");
    const body = JSON.parse(String(request?.body));
    expect(body.model).toBe("test-model");
    expect(JSON.parse(body.messages[0].content)).toEqual({ ...conversation, categories });
  });

  it("keeps the product when Groq only returns the newly stated price", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "groq-test-key");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({
      choices: [{ finish_reason: "stop", message: { content: '{"price":2000000}' } }]
    }));
    vi.stubGlobal("fetch", fetchMock);
    const conversation = {
      previousDraft: { title: "Điện thoại", categoryId: "used-electronics" },
      turns: [
        { message: "t cần bán điện thoại này" },
        { question: "Bạn muốn đăng giá bao nhiêu?", message: "2tr" }
      ]
    };
    const electronics = [{ id: "used-electronics", name: "Đồ điện tử đã qua sử dụng" }];

    await expect(suggestQuickListing(quickListingConversationSchema.parse(conversation), electronics)).resolves.toEqual({
      draft: { ...conversation.previousDraft, price: 2_000_000 },
      question: "Món này còn mới hay đã qua sử dụng? Có lỗi hoặc thiếu gì không?"
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(JSON.parse(body.messages[1].content).previousDraft).toEqual(conversation.previousDraft);
  });

  it("lets the seller retract and replace information in an existing draft", async () => {
    const conversation = {
      previousDraft: draft,
      turns: [...turns, { message: "Mình ghi nhầm, đầm sọc nhé. Giá thì chưa chốt." }]
    };
    mockMessage({ title: "Đầm sọc", clearFields: ["price"] });

    await expect(suggestQuickListing(conversation, categories)).resolves.toEqual({
      draft: { title: "Đầm sọc", categoryId: "fashion", conditionGrade: "FAIR", conditionNotes: "Đã mặc vài lần" },
      question: "Bạn muốn đăng giá bao nhiêu?"
    });
  });

  it("keeps the draft and asks for a corrected weight after a 200 OK response with 200 kg", async () => {
    const conversation = { turns: [...turns, { question: "Kiện này nặng khoảng bao nhiêu gam?", message: "nặng 200kg" }] };
    mockMessage({ ...draft, weightGram: 200_000 });
    const overweight = await suggestQuickListing(conversation, categories);
    expect(overweight).toEqual({
      draft,
      question: "REBOXE chỉ hỗ trợ kiện hàng tối đa 100 kg. Nếu bạn nhập nhầm, hãy gửi lại cân nặng đúng."
    });

    mockMessage({ ...draft, weightGram: 100_000 });
    await expect(suggestQuickListing({ turns: [...conversation.turns, { question: overweight.question!, message: "Mình nhập nhầm, cân lại là 100kg" }] }, categories)).resolves.toEqual({
      draft: { ...draft, weightGram: 100_000 }, question: null
    });
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

  it.each([
    ["a rate limit", () => new Response(null, { status: 429 })],
    ["malformed JSON", () => Response.json({ content: [{ type: "text", text: "{" }] })],
    ["an invalid draft", () => Response.json({ content: [{ type: "text", text: '{"price":"140k"}' }] })]
  ])("uses Groq after Anthropic returns %s", async (_, primaryResponse) => {
    vi.stubEnv("GROQ_API_KEY", " groq-test-key ");
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(primaryResponse())
      .mockResolvedValueOnce(Response.json({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(draft) } }]
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(suggestQuickListing({ turns }, categories)).resolves.toMatchObject({ draft });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://ai.example.test/v1/messages", "https://api.groq.com/openai/v1/chat/completions"
    ]);
    const request = fetchMock.mock.calls[1]?.[1];
    expect(new Headers(request?.headers).get("authorization")).toBe("Bearer groq-test-key");
    expect(new Headers(request?.headers).has("x-api-key")).toBe(false);
    expect(request?.redirect).toBe("error");
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({ model: "openai/gpt-oss-120b", response_format: { type: "json_object" } });
    expect(body.messages.map(({ role }: { role: string }) => role)).toEqual(["system", "user"]);
    expect(JSON.parse(body.messages[1].content)).toEqual({ turns, categories });
  });

  it("returns 503 when both providers fail", async () => {
    vi.stubEnv("GROQ_API_KEY", "groq-test-key");
    const fetchMock = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(Response.json({
        choices: [{ finish_reason: "length", message: { content: JSON.stringify(draft) } }]
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(suggestQuickListing({ turns }, categories)).rejects.toMatchObject({ code: "AI_UNAVAILABLE", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
