import type { InventoryModule } from "@reboxe/backend";
import type { PublicListing, PublicListingPage } from "@reboxe/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestShoppingListings } from "../src/platform/ai/shopping-assistant";

const turn = { messages: ["Tôi muốn mua quạt để bàn", "Dưới 300k và số của tôi là 0901234567"] };

function listing(id: string, price: number, availableQuantity: 0 | 1): PublicListing {
  return {
    id, price, availableQuantity, title: "Quạt để bàn", shopId: "shop", shopDisplayName: "Shop thử nghiệm",
    categoryId: "household", conditionGrade: "GOOD", conditionNotes: "Kiện còn nguyên",
    images: [], createdAt: "2026-11-20T00:00:00Z", publishedAt: null,
    package: { disclosure: "UNOPENED_UNINSPECTED", sealStatus: "INTACT", manifestSummary: { lineCount: 1, unitCount: 1 }, lines: [] }
  };
}

function catalog(items: PublicListing[] = []) {
  const page: PublicListingPage = { items, sponsored: [listing("sponsored", 200_000, 1)], nextCursor: null };
  return {
    listCategories: vi.fn().mockResolvedValue([{ id: "household", name: "Đồ gia dụng" }]),
    listPublicListings: vi.fn<InventoryModule["listPublicListings"]>().mockResolvedValue(page)
  };
}

function provider(...outputs: unknown[]) {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const output of outputs) {
    fetch.mockResolvedValueOnce(Response.json({ content: [{ type: "text", text: JSON.stringify(output) }] }));
  }
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("shopping assistant", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://ai.example.test");
    vi.stubEnv("ANTHROPIC_MODEL", "test-model");
    vi.stubEnv("GROQ_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("ranks real candidates, enforces the budget and excludes unavailable or unknown listings", async () => {
    const first = listing("fan-1", 190_000, 1);
    const second = listing("fan-2", 295_000, 1);
    const inventory = catalog([first, second, listing("reserved", 90_000, 0), listing("expensive", 500_000, 1)]);
    const fetch = provider(
      { queries: ["quạt để bàn", "quạt để bàn"], categoryId: "household", maxPriceVnd: 300_000 },
      { listingIds: [second.id, "invented", first.id] }
    );

    await expect(suggestShoppingListings(turn, inventory)).resolves.toEqual({ listings: [second, first], needsProductDetails: false });
    expect(inventory.listPublicListings.mock.calls).toEqual([
      [{ q: "quạt để bàn", sort: "newest" }, { maxPriceVnd: 300_000 }],
      [{ category: "household", sort: "newest" }, { maxPriceVnd: 300_000 }]
    ]);
    const sent = fetch.mock.calls.map(([, request]) => JSON.parse(JSON.parse(String(request?.body)).messages[0].content));
    expect(sent[0].messages).toEqual(["Tôi muốn mua quạt để bàn", "Dưới 300k và số của tôi là [số điện thoại]"]);
    expect(sent[1].candidates.map(({ id }: { id: string }) => id)).toEqual([first.id, second.id]);
  });

  it("asks for product details when the request is unclear", async () => {
    const inventory = catalog();
    const fetch = provider({ queries: [], categoryId: null, maxPriceVnd: null });
    await expect(suggestShoppingListings({ messages: ["Tôi muốn mua đồ"] }, inventory))
      .resolves.toEqual({ listings: [], needsProductDetails: true });
    expect(inventory.listPublicListings).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports no match when the catalog returns an empty page", async () => {
    const fetch = provider({ queries: ["quạt"], categoryId: null, maxPriceVnd: null });
    await expect(suggestShoppingListings(turn, catalog())).resolves.toEqual({ listings: [], needsProductDetails: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("plans and ranks with Groq when Anthropic is unconfigured", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "groq-test-key");
    const match = listing("fan-1", 190_000, 1);
    const fetchMock = vi.fn<typeof fetch>();
    for (const output of [{ queries: ["quạt"], categoryId: null, maxPriceVnd: 300_000 }, { listingIds: [match.id] }]) {
      fetchMock.mockResolvedValueOnce(Response.json({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(output) } }]
      }));
    }
    vi.stubGlobal("fetch", fetchMock);

    await expect(suggestShoppingListings(turn, catalog([match])))
      .resolves.toEqual({ listings: [match], needsProductDetails: false });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(Array(2).fill("https://api.groq.com/openai/v1/chat/completions"));
    for (const [, request] of fetchMock.mock.calls) {
      const body = JSON.parse(String(request?.body));
      expect(JSON.parse(body.messages[1].content).messages[1]).toBe("Dưới 300k và số của tôi là [số điện thoại]");
    }
  });
});
