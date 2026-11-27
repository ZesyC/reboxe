import type { InventoryModule } from "@reboxe/backend";
import type { PublicListing, PublicListingPage } from "@reboxe/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { suggestShoppingListings } from "../src/platform/ai/shopping-assistant";

const turn = { messages: ["Tôi muốn mua quạt để bàn", "Dưới 300k và số của tôi là 0901234567"] };

function listing(id: string, price: number, availableQuantity?: 0 | 1): PublicListing {
  return {
    id, price, title: "Quạt để bàn", shopId: "shop", shopDisplayName: "Shop thử nghiệm",
    categoryId: "household", conditionGrade: "GOOD", conditionNotes: "Kiện còn nguyên",
    images: [], createdAt: "2026-11-20T00:00:00Z", publishedAt: null,
    ...(availableQuantity !== undefined && {
      availableQuantity,
      package: { disclosure: "UNOPENED_UNINSPECTED", sealStatus: "INTACT", manifestSummary: { lineCount: 1, unitCount: 1 }, lines: [] }
    })
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

  it("ranks public listings with or without a package and enforces the budget", async () => {
    const first = listing("fan-1", 190_000, 1);
    const second = listing("fan-2", 295_000, 1);
    const reserved = listing("reserved", 90_000, 0);
    const publicListing = listing("public-listing", 139_000);
    const inventory = catalog([first, second, reserved, publicListing, listing("expensive", 500_000)]);
    const fetch = provider(
      { queries: ["quạt để bàn", "quạt để bàn"], categoryId: "household", maxPriceVnd: 300_000 },
      { listingIds: [second.id, "invented", publicListing.id] }
    );

    await expect(suggestShoppingListings(turn, inventory)).resolves.toEqual({ listings: [second, publicListing], needsProductDetails: false });
    expect(inventory.listPublicListings.mock.calls).toEqual([
      [{ q: "quạt để bàn", sort: "newest" }, { maxPriceVnd: 300_000 }],
      [{ category: "household", sort: "newest" }, { maxPriceVnd: 300_000 }]
    ]);
    const sent = fetch.mock.calls.map(([, request]) => JSON.parse(JSON.parse(String(request?.body)).messages[0].content));
    expect(sent[0].messages).toEqual(["Tôi muốn mua quạt để bàn", "Dưới 300k và số của tôi là [số điện thoại]"]);
    expect(sent[1].candidates.map(({ id }: { id: string }) => id)).toEqual([first.id, second.id, reserved.id, publicListing.id]);
    expect(sent[1].candidates[0]).toMatchObject({ categoryId: "household", conditionGrade: "GOOD" });
  });

  it("normalizes omitted/zero plan fields, caps extra queries/ids, and fills candidate pool to 48", async () => {
    const emptyPage: PublicListingPage = { items: [], sponsored: [], nextCursor: null };
    const manyItems = Array.from({ length: 50 }, (_, index) => listing(`fan-${index + 1}`, 150_000, 1));
    const inventory = {
      listCategories: vi.fn().mockResolvedValue([{ id: "household", name: "Đồ gia dụng" }]),
      listPublicListings: vi.fn<InventoryModule["listPublicListings"]>()
        .mockResolvedValueOnce(emptyPage)
        .mockResolvedValueOnce(emptyPage)
        .mockResolvedValueOnce(emptyPage)
        .mockResolvedValueOnce({ items: manyItems, sponsored: [], nextCursor: null })
    };
    const fetch = provider(
      { queries: ["quạt A", "quạt B", "quạt C", "quạt D"], categoryId: "Đồ gia dụng", maxPriceVnd: 0 },
      { listingIds: ["fan-1", "fan-2", "fan-2", "fan-3", "fan-4"] }
    );

    await expect(suggestShoppingListings({ messages: ["Tìm quạt"] }, inventory)).resolves.toEqual({
      listings: [manyItems[0], manyItems[1], manyItems[2]],
      needsProductDetails: false
    });
    expect(inventory.listPublicListings).toHaveBeenCalledTimes(4);
    expect(inventory.listPublicListings.mock.calls[3]).toEqual([{ category: "household", sort: "newest" }, { maxPriceVnd: undefined }]);
    const sent = fetch.mock.calls.map(([, request]) => JSON.parse(JSON.parse(String(request?.body)).messages[0].content));
    expect(sent[1].candidates).toHaveLength(48);
  });

  it("treats null queries as needing product details", async () => {
    const inventory = catalog();
    provider({ queries: null });
    await expect(suggestShoppingListings({ messages: ["Có gì hay không"] }, inventory))
      .resolves.toEqual({ listings: [], needsProductDetails: true });
    expect(inventory.listPublicListings).not.toHaveBeenCalled();
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
