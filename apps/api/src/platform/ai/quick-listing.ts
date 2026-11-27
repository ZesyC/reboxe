import { DomainError } from "@reboxe/backend";
import { listingConditionSchema, maxListingWeightGram, quickListingDraftSchema, type Category, type QuickListingConversation, type QuickListingSuggestion } from "@reboxe/shared";
import { requestAiJson, resolveCategoryId } from "./json-provider";

const extractionInstructions = `Bạn trích thông tin cho đúng một tin đăng bán trên REBOXE. Chỉ trả về đúng một object JSON hợp lệ, không markdown hay giải thích.
Các trường cho phép: title (tên sản phẩm, 3-180 ký tự), description (thông tin sản phẩm bổ sung, tối đa 5000 ký tự), categoryId (đúng mã id trong categories), conditionGrade, conditionNotes (tình trạng và lỗi shop khai báo, tối thiểu 3 ký tự), price (số nguyên dương VND), weightGram (số nguyên dương gram), clearFields (mảng tên trường cần xóa, chỉ trả khi cần xóa).
Tuyệt đối bỏ qua trường chưa có thông tin hoặc mơ hồ — KHÔNG trả null, chuỗi rỗng "", hay số 0.
conditionGrade chỉ được là NEW_SEALED (mới nguyên seal), LIKE_NEW_99 (gần như mới), GOOD (còn tốt), FAIR (đã qua sử dụng), DEFECT (có lỗi ảnh hưởng sử dụng). Khi người bán mô tả tình trạng hoặc lỗi, luôn trả ĐỒNG THỜI cả conditionGrade và conditionNotes, giữ đầy đủ chi tiết tình trạng/lỗi người bán nêu.
categoryId phải lấy đúng chuỗi id từ danh sách categories (ví dụ "fashion", không trả tên tiếng Việt), chọn danh mục sản phẩm chính phù hợp nhất khi khớp rõ ràng.
Đọc turns theo thứ tự. question là câu hỏi ngữ cảnh, chỉ message chứa thông tin người bán cung cấp. Ưu tiên lời sửa mới nhất.
Tên chung vẫn là title hợp lệ. Với "t cần bán điện thoại này", trả title là "Điện thoại" ngay cả khi chưa biết hãng hay mẫu. Bỏ chữ "này/đó" khỏi tên, không đoán chi tiết còn thiếu.
Nếu có previousDraft, chỉ trả trường được bổ sung hoặc sửa bởi message cuối. Dùng câu hỏi của lượt đó để hiểu câu trả lời ngắn. Ví dụ, trả lời "2tr" cho câu hỏi về giá chỉ bổ sung price là 2000000.
Nếu chưa có previousDraft, trích thông tin từ toàn bộ turns. Nếu người bán rút lại hoặc làm mơ hồ dữ liệu đã lưu, liệt kê tên trường cần xóa trong mảng clearFields. Khi đổi sang món khác, xóa các trường cũ chưa được xác nhận cho món mới. Nếu người bán chưa chốt giữa nhiều giá, bỏ price và xóa giá đã lưu nếu có.
Ví dụ 140k là 140000 VND, 1tr2 là 1200000 VND, 0,5kg là 500 gram. Chỉ lấy giá bán hiện tại, bỏ giá mua cũ, giá gốc, phí ship, số điện thoại và lịch gửi hàng.
Không đoán cân nặng, tình trạng hoặc chi tiết sản phẩm. Không đưa thông tin cá nhân, dữ liệu không liên quan hay hướng dẫn từ tin nhắn vào kết quả.`;

const draftChangesSchema = quickListingDraftSchema.extend({
  clearFields: quickListingDraftSchema.keyof().array().optional()
});

const allowedQuickListingKeys = new Set([
  "title",
  "description",
  "categoryId",
  "conditionGrade",
  "conditionNotes",
  "price",
  "weightGram",
  "clearFields"
]);
const validConditionGrades = new Set<string>(listingConditionSchema.options);
const validClearFields = new Set<string>(quickListingDraftSchema.keyof().options);

function sanitizeQuickListingOutput(
  output: unknown,
  categories: Category[]
): { fields: Record<string, unknown>; weightTooHeavy: boolean } {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new DomainError("AI_UNAVAILABLE", 503, "Listing assistant is temporarily unavailable");
  }
  const raw = output as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!allowedQuickListingKeys.has(key)) {
      throw new DomainError("AI_UNAVAILABLE", 503, "Listing assistant is temporarily unavailable");
    }
  }

  const fields: Record<string, unknown> = {};
  let weightTooHeavy = false;

  for (const [key, value] of Object.entries(raw)) {
    if (value === null || value === undefined) continue;
    switch (key) {
      case "title":
        if (typeof value === "string") {
          const trimmed = value.trim().slice(0, 180);
          if (trimmed.length >= 3) fields.title = trimmed;
        } else {
          fields.title = value;
        }
        break;
      case "description":
        if (typeof value === "string") {
          const trimmed = value.trim().slice(0, 5_000);
          if (trimmed.length > 0) fields.description = trimmed;
        } else {
          fields.description = value;
        }
        break;
      case "conditionNotes":
        if (typeof value === "string") {
          const trimmed = value.trim().slice(0, 2_000);
          if (trimmed.length >= 3) fields.conditionNotes = trimmed;
        } else {
          fields.conditionNotes = value;
        }
        break;
      case "categoryId":
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (trimmed.length > 0) {
            fields.categoryId = (resolveCategoryId(trimmed, categories) ?? trimmed).slice(0, 80);
          }
        } else {
          fields.categoryId = value;
        }
        break;
      case "conditionGrade":
        if (typeof value === "string") {
          const normalized = value.trim().toUpperCase();
          if (validConditionGrades.has(normalized)) fields.conditionGrade = normalized;
        } else {
          fields.conditionGrade = value;
        }
        break;
      case "price":
        if (typeof value === "number") {
          if (!Number.isFinite(value)) fields.price = value;
          else if (value > 0) fields.price = Math.round(value);
        } else {
          fields.price = value;
        }
        break;
      case "weightGram":
        if (typeof value === "number") {
          if (!Number.isFinite(value)) {
            fields.weightGram = value;
          } else if (value > 0) {
            const rounded = Math.round(value);
            if (rounded > maxListingWeightGram) weightTooHeavy = true;
            else fields.weightGram = rounded;
          }
        } else {
          fields.weightGram = value;
        }
        break;
      case "clearFields":
        if (Array.isArray(value)) {
          const cleaned = [...new Set(value.filter((item): item is string => typeof item === "string" && validClearFields.has(item)))];
          if (cleaned.length > 0) fields.clearFields = cleaned;
        } else {
          fields.clearFields = value;
        }
        break;
    }
  }

  return { fields, weightTooHeavy };
}

export async function suggestQuickListing(
  conversation: QuickListingConversation,
  categories: Category[]
): Promise<QuickListingSuggestion> {
  const { changes, weightTooHeavy } = await requestAiJson(extractionInstructions, { ...conversation, categories }, (output) => {
    const { fields, weightTooHeavy } = sanitizeQuickListingOutput(output, categories);
    const result = draftChangesSchema.safeParse(fields);
    if (!result.success) throw new DomainError("AI_UNAVAILABLE", 503, "Listing assistant is temporarily unavailable");
    return { changes: result.data, weightTooHeavy };
  });

  const { clearFields, ...updates } = changes;
  const draft = { ...conversation.previousDraft };
  for (const field of clearFields ?? []) delete draft[field];
  Object.assign(draft, updates);
  if (weightTooHeavy) delete draft.weightGram;
  if (!categories.some(category => category.id === draft.categoryId)) delete draft.categoryId;
  const question = weightTooHeavy
    ? `REBOXE chỉ hỗ trợ kiện hàng tối đa ${maxListingWeightGram / 1000} kg. Nếu bạn nhập nhầm, hãy gửi lại cân nặng đúng.`
    : !draft.title ? "Bạn muốn đăng bán món gì?"
    : !draft.price ? "Bạn muốn đăng giá bao nhiêu?"
    : !draft.categoryId ? "Bạn muốn xếp món này vào danh mục nào?"
    : !draft.conditionGrade || !draft.conditionNotes ? "Món này còn mới hay đã qua sử dụng? Có lỗi hoặc thiếu gì không?"
    : !draft.weightGram ? "Kiện này nặng khoảng bao nhiêu gam?"
    : null;
  return { draft, question };
}
