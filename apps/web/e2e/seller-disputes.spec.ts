import { expect, test } from "@playwright/test";

test("shows two disputed products for the demo shop", async ({ page }) => {
  const processingRequests: unknown[] = [];
  await page.setViewportSize({ width: 700, height: 900 });
  await page.route("**/v1/me", (route) => route.fulfill({ json: {
    id: "seller-id",
    profileStatus: "ACTIVE",
    shops: [{ id: "RBX-DEMO-SHOP-2026", displayName: "Kho Hoàn Giá Tốt", role: "OWNER", membershipStatus: "ACTIVE", kycId: null, kycStatus: "VERIFIED", status: "ACTIVE" }]
  } }));
  await page.route("**/v1/shops/RBX-DEMO-SHOP-2026/disputes", (route) => route.fulfill({ json: [
    { id: "RBX-DEMO-CASE-001", orderId: "RBX-DEMO-ORDER-001", productTitle: "Tai nghe Sony WH-1000XM4", status: "OPEN", reason: "Âm thanh bị rè", createdAt: "2026-09-07T03:00:00.000Z" },
    { id: "RBX-DEMO-CASE-003", orderId: "RBX-DEMO-ORDER-003", productTitle: "Váy satin dáng dài", status: "OPEN", reason: "Màu sắc khác mô tả", createdAt: "2026-09-08T03:00:00.000Z" }
  ] }));
  await page.route("**/v1/legal/processing-notice", (route) => route.fulfill({ json: {
    title: "Thông báo xử lý bằng chứng", body: "Chỉ dùng file để giải quyết khiếu nại.", version: "e2e-notice-v1", effectiveAt: "2026-09-07T00:00:00.000Z"
  } }));
  await page.route("**/v1/processing-records", (route) => {
    processingRequests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { id: "e2e-processing-record" } });
  });

  await page.goto("/seller/returns");

  await expect(page.getByRole("heading", { name: "Khiếu nại / Hoàn trả" })).toBeVisible();
  await expect(page.getByText("Tai nghe Sony WH-1000XM4", { exact: true })).toBeVisible();
  await expect(page.getByText("Váy satin dáng dài", { exact: true })).toBeVisible();
  const sidebar = page.getByRole("navigation", { name: "Điều hướng Kênh người bán" });
  await expect(sidebar).toBeVisible();
  const toggle = page.getByRole("button", { name: "Ẩn thanh bên" });
  const [toggleBox, logoBox] = await Promise.all([toggle.boundingBox(), page.getByRole("link", { name: "REBOXE" }).boundingBox()]);
  expect(toggleBox!.x).toBeLessThan(logoBox!.x);
  await toggle.click();
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "Hiện thanh bên" }).click();
  await expect(sidebar).toBeVisible();
  await expect(page.getByText("Đang xử lý", { exact: true })).toHaveCount(2);
  await expect(page.getByText("OPEN", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Bổ sung bằng chứng", { exact: true })).toHaveCount(2);
  await expect(page.locator("article")).toHaveCount(2);
  const firstCase = page.locator("article").first();
  const chooseFile = firstCase.getByRole("button", { name: "Xác nhận lựa chọn để chọn file" });
  await expect(chooseFile).toBeDisabled();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(processingRequests).toHaveLength(0);
  await firstCase.getByRole("checkbox").check();
  await chooseFile.click();
  await expect(firstCase.locator('input[type="file"]')).toBeVisible();
  expect(processingRequests).toEqual([{
    purpose: "SELLER_EVIDENCE", targetType: "DISPUTE", targetId: "RBX-DEMO-CASE-001", noticeVersion: "e2e-notice-v1"
  }]);
});

test("shows Vietnamese labels for seller orders", async ({ page }) => {
  await page.route("**/v1/me", (route) => route.fulfill({ json: {
    id: "seller-id",
    profileStatus: "ACTIVE",
    shops: [{ id: "RBX-DEMO-SHOP-2026", displayName: "Kho Hoàn Giá Tốt", role: "OWNER", membershipStatus: "ACTIVE", kycId: null, kycStatus: "VERIFIED", status: "ACTIVE" }]
  } }));
  await page.route("**/v1/shops/RBX-DEMO-SHOP-2026/orders", (route) => route.fulfill({ json: [{
    id: "RBX-DEMO-ORDER-002", buyerId: "buyer-id", shopId: "RBX-DEMO-SHOP-2026", shopDisplayName: "Kho Hoàn Giá Tốt",
    status: "IN_TRANSIT", mode: "SANDBOX", paymentMethod: "SANDBOX_COD", subtotalVnd: 850000, feeVnd: 30000, totalVnd: 880000,
    expiresAt: "2026-09-08T03:30:00.000Z", confirmedAt: "2026-09-08T03:05:00.000Z", completedAt: null, createdAt: "2026-09-08T03:00:00.000Z",
    item: { listingId: "RBX-DEMO-PRODUCT-002", title: "Giày Jordan 4 Retro", imageUrl: null, disclosure: "UNOPENED_UNINSPECTED", sealStatus: "DAMAGED", priceVnd: 850000 },
    timeline: []
  }] }));

  await page.goto("/seller/orders");

  await expect(page.getByRole("heading", { name: "Quản lý đơn hàng" })).toBeVisible();
  await expect(page.getByText("Đang vận chuyển", { exact: true })).toBeVisible();
  await expect(page.getByText("IN_TRANSIT", { exact: true })).toHaveCount(0);
});
