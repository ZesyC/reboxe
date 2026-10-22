import { expect, test } from "@playwright/test";

const financeSnapshot = {
  availableBalanceVnd: 300000,
  heldBalanceVnd: 850000,
  netRevenueVnd: 432000,
  monthlyRevenue: [320000, 365000, 410000, 398000, 455000, 432000].map((amountVnd, index) => ({ label: `T${index + 1}`, amountVnd })),
  productRevenue: [{ label: "Sony XM4", amountVnd: 950000 }, { label: "Jordan 4", amountVnd: 850000 }, { label: "Váy Satin", amountVnd: 225000 }, { label: "Phụ kiện", amountVnd: 180000 }],
  walletTransactions: [
    { code: "#RBX-DEMO-003", kind: "REVENUE", detail: "Váy Satin", amountVnd: 202500, occurredAt: "2026-09-05T03:00:00.000Z" },
    { code: "#RBX-DEMO-002", kind: "HOLD", detail: "Jordan 4", amountVnd: -850000, occurredAt: "2026-09-04T03:00:00.000Z" },
    { code: "#RBX-DEMO-001", kind: "REVENUE", detail: "Sony XM4", amountVnd: 855000, occurredAt: "2026-09-02T03:00:00.000Z" }
  ],
  updatedAt: "2026-09-06T03:00:00.000Z"
};

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/me", (route) => route.fulfill({ json: {
    id: "10000000-0000-4000-8000-000000000004",
    profileStatus: "ACTIVE",
    shops: [{ id: "RBX-DEMO-SHOP-2026", displayName: "REBOXE Shop Test", role: "OWNER", membershipStatus: "ACTIVE", kycId: null, kycStatus: "VERIFIED", status: "ACTIVE" }]
  } }));
  await page.route("**/v1/shops/RBX-DEMO-SHOP-2026/finance", (route) => route.fulfill({ json: financeSnapshot }));
});

test("renders the supplied finance snapshot", async ({ page }) => {
  await page.goto("/seller/finance");

  await expect(page.getByText("300.000 VNĐ", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("850.000 VNĐ", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xu hướng doanh thu theo tháng" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Doanh thu theo sản phẩm" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cơ cấu tài chính" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Cơ cấu: khả dụng 26%, tạm khóa 74%" })).toHaveCSS("background-image", /26%/);
  await expect(page.getByText("Dữ liệu mô phỏng — không phải số dư có thể rút.", { exact: true })).toHaveCount(0);
});

test("shows the finance snapshot on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/seller/finance");

  await expect(page.getByText("300.000 VNĐ", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Xu hướng doanh thu theo tháng" })).toBeVisible();
});

test("warns when completed orders are missing their commission snapshot", async ({ page }) => {
  await page.route("**/v1/shops/RBX-DEMO-SHOP-2026/finance", (route) => route.fulfill({ json: {
    ...financeSnapshot, unpricedOrderCount: 2
  } }));
  await page.goto("/seller/finance");
  await expect(page.getByText("GIÁ TRỊ ĐƠN HOÀN THÀNH", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Có 2 đơn cũ chưa lưu hoa hồng");
  await expect(page.getByRole("status")).toContainText("không phải xác nhận tiền đã về ngân hàng");
});

test("shows a neutral composition when both balances are zero", async ({ page }) => {
  await page.route("**/v1/shops/RBX-DEMO-SHOP-2026/finance", (route) => route.fulfill({ json: {
    ...financeSnapshot,
    availableBalanceVnd: 0,
    heldBalanceVnd: 0
  } }));
  await page.goto("/seller/finance");

  await expect(page.getByRole("img", { name: "Cơ cấu: khả dụng 0%, tạm khóa 0%" })).toBeVisible();
  await expect(page.getByText("0 VNĐ (0%)", { exact: true })).toHaveCount(2);
});

test("renders wallet transactions for the demo orders", async ({ page }) => {
  await page.goto("/seller/wallet");

  await expect(page.getByRole("heading", { name: "Lịch sử ví ký quỹ" })).toBeVisible();
  await expect(page.getByRole("row", { name: /RBX-DEMO-001.*855\.000đ/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /RBX-DEMO-002.*850\.000đ/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /RBX-DEMO-003.*202\.500đ/ })).toBeVisible();
});
