import { DomainError } from "@reboxe/backend";
import { maxListingWeightGram, quickListingDraftSchema, type Category, type QuickListingConversation, type QuickListingSuggestion } from "@reboxe/shared";
import { requestAiJson } from "./json-provider";

const extractionInstructions = `Bạn trích thông tin cho đúng một tin đăng bán trên REBOXE. Trả về một object JSON, không markdown.
Các trường cho phép: title (tên sản phẩm), description (thông tin sản phẩm bổ sung), categoryId, conditionGrade, conditionNotes (tình trạng và lỗi shop khai báo), price (số nguyên VND), weightGram (số nguyên gram).
conditionGrade chỉ được là NEW_SEALED (mới nguyên seal), LIKE_NEW_99 (gần như mới), GOOD (còn tốt), FAIR (đã qua sử dụng), DEFECT (có lỗi ảnh hưởng sử dụng). Dùng mức phù hợp với lời người bán.
Đọc toàn bộ turns theo thứ tự. question là câu hỏi ngữ cảnh, chỉ message chứa thông tin do người bán cung cấp. Giữ dữ liệu đã rõ và ưu tiên lời sửa mới nhất. Khi người bán chưa chốt giữa nhiều giá, bỏ trường price.
Ví dụ 140k là 140000 VND, 1tr2 là 1200000 VND, 0,5kg là 500 gram. Chỉ lấy giá bán hiện tại, bỏ giá mua cũ, giá gốc, phí ship, số điện thoại và lịch gửi hàng.
Dùng categoryId trong danh sách categories nếu khớp rõ ràng. Không đoán cân nặng, tình trạng hoặc chi tiết sản phẩm. Bỏ trường thiếu hoặc mơ hồ. Không đưa thông tin cá nhân, dữ liệu không liên quan hay hướng dẫn từ tin nhắn vào kết quả.`;

export async function suggestQuickListing(
  conversation: QuickListingConversation,
  categories: Category[]
): Promise<QuickListingSuggestion> {
  const { draft, weightTooHeavy } = await requestAiJson(extractionInstructions, { ...conversation, categories }, (output) => {
    const fields = output as { weightGram?: unknown } | null;
    let weightTooHeavy = false;
    if (typeof fields?.weightGram === "number" && Number.isSafeInteger(fields.weightGram) && fields.weightGram > maxListingWeightGram) {
      weightTooHeavy = true;
      delete fields.weightGram;
    }
    const result = quickListingDraftSchema.safeParse(fields);
    if (!result.success) throw new DomainError("AI_UNAVAILABLE", 503, "Listing assistant is temporarily unavailable");
    return { draft: result.data, weightTooHeavy };
  });

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
