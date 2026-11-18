import type { CommerceOrder, PublicListing } from "@reboxe/shared";

export function formatPrice(price: number): string {
  return `${price.toLocaleString("vi-VN")}đ`;
}

export const conditionLabels: Record<PublicListing["conditionGrade"], string> = {
  NEW_SEALED: "Mới nguyên seal",
  LIKE_NEW_99: "Gần như mới",
  GOOD: "Còn tốt",
  FAIR: "Đã qua sử dụng",
  DEFECT: "Có lỗi"
};

export const sealStatusLabels: Record<"INTACT" | "DAMAGED" | "UNKNOWN", string> = {
  INTACT: "Nguyên vẹn",
  DAMAGED: "Có dấu hiệu hư hỏng",
  UNKNOWN: "Chưa xác định"
};

export const orderStatusLabels: Record<CommerceOrder["status"], string> = {
  RESERVED: "Đã giữ hàng",
  CONFIRMED: "Đã xác nhận",
  READY_TO_SHIP: "Sẵn sàng giao",
  PICKED_UP: "Đã lấy hàng",
  IN_TRANSIT: "Đang vận chuyển",
  DELIVERED: "Đã giao hàng",
  COMPLETED: "Hoàn thành",
  EXPIRED: "Hết hạn",
  CANCELLED_BY_SELLER: "Người bán đã hủy",
  CANCELLED_BY_PICKUP_FAILURE: "Hủy do lấy hàng thất bại",
  DELIVERY_FAILED: "Giao hàng thất bại"
};

export const disputeStatusLabels: Record<string, string> = {
  OPEN: "Đang xử lý",
  APPEALED: "Đã kháng nghị",
  RESOLVED_APPEAL_WINDOW: "Đã có quyết định",
  CLOSED: "Đã đóng"
};

export function nameInitials(value: string, fallback = "RB"): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return (parts.length > 1
    ? `${parts[0]![0]}${parts.at(-1)![0]}`
    : parts[0]!.slice(0, 2)).toUpperCase();
}

export const categoryLabels: Record<string, string> = {
  fashion: "Thời trang",
  electronics: "Điện tử đã qua sử dụng",
  home: "Nhà cửa và đời sống",
  accessories: "Phụ kiện",
  lifestyle: "Tiện ích đời sống",
  beauty: "Mỹ phẩm và chăm sóc cá nhân",
  cosmetics: "Mỹ phẩm",
  supplements: "Thực phẩm chức năng",
  "packaged-food": "Thực phẩm bao gói sẵn",
  "infant-nutrition": "Dinh dưỡng cho trẻ dưới 24 tháng",
  "medical-devices": "Trang thiết bị y tế",
  "childrens-toys": "Đồ chơi trẻ em",
  "regulated-electronics": "Thiết bị điện cần chứng nhận hợp quy",
  "motorcycle-helmets": "Mũ bảo hiểm mô tô, xe máy",
  "luxury-goods": "Hàng hiệu và thương hiệu cao cấp",
  alcohol: "Rượu và đồ uống có cồn",
  "jewelry-gemstones": "Vàng trang sức và đá quý",
  publications: "Sách và ấn phẩm",
  "used-electronics": "Đồ điện tử đã qua sử dụng",
  "tried-fashion": "Quần áo, giày dép đã thử",
  "missing-accessories": "Hàng thiếu phụ kiện hoặc hộp",
  "cosmetic-defect": "Hàng lỗi ngoại hình",
  "near-expiry": "Hàng cận hạn sử dụng"
};

export const walletDetailLabels: Record<string, string> = {
  HOLD_CREATE: "Tạm giữ ký quỹ đơn hàng",
  HOLD_RELEASE: "Hoàn giải phóng ký quỹ",
  SANDBOX_BALANCE_SEED: "Cấp số dư ví ban đầu"
};
