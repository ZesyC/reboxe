# REBOXE

Nền tảng TMĐT B2B2C cho phép seller bán lại **nguyên kiện hàng hoàn chưa mở kiểm tra**. CSV/XLSX hỗ trợ preview → commit → quét mã → đăng bán. Luồng cấp quyền Shopee/TikTok đã được bổ sung; đồng bộ bản kê qua API sàn còn phải triển khai.

Repo có web/API/worker và dịch vụ AI riêng. Đợt mở rộng thêm OAuth sàn, quét camera, báo tổng checkout từ server, nạp ngân sách quảng bá qua payOS, báo phí GHN, upload S3 Object Lock và AI hỗ trợ người duyệt. Các kết nối ngoài chưa nghiệm thu với tài khoản thật. Mua hàng, giữ tiền, giao hàng và hoàn tiền vẫn chạy trong phạm vi sandbox; chưa phải sản phẩm doanh nghiệp hoàn chỉnh. Xem [trạng thái triển khai](docs/10-ENTERPRISE-DELIVERY.md) và [pháp lý trước deploy](docs/11-PREDEPLOY-LEGAL-REVIEW.md).

## Bắt đầu từ đâu

👉 **[docs/DEV-START-HERE.md](docs/DEV-START-HERE.md)** — lộ trình đọc và phạm vi hiện hành. Sau đó đọc [quyết định kiến trúc](docs/07-ARCHITECTURE-DECISIONS.md) trước các đặc tả chi tiết.

## Tài liệu

| #   | File                                                       | Nội dung                                                                                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 00  | [Tổng quan & mâu thuẫn](docs/00-TONG-QUAN-VA-MAU-THUAN.md) | Lịch sử audit tài liệu gốc, các mâu thuẫn và trạng thái hòa giải                                                      |
| 01  | [Technical Spec](docs/01-TECHNICAL-SPEC.md)                | Kiến trúc, stack, phân rã module, data model, sổ cái tiền, state machine, tích hợp, NFR                       |
| 02  | [Luồng Backend](docs/02-BACKEND-FLOWS.md)                  | Sequence, ranh giới transaction, idempotency, error path                                                      |
| 03  | [Luồng Frontend](docs/03-FRONTEND-FLOWS.md)                | Màn hình Buyer / Seller / Admin, state, API, edge case                                                        |
| 04  | [Kế hoạch triển khai](docs/04-IMPLEMENTATION-PLAN.md)      | Lộ trình theo sprint, tiêu chí nghiệm thu, hạ tầng & chi phí, phân công                                       |
| 05  | [Pháp lý Việt Nam](docs/05-PHAP-LY-VIET-NAM.md)            | Giấy phép, thuế, dữ liệu cá nhân, bảo vệ người tiêu dùng, hàng hóa cấm                                        |
| 06  | [Danh mục hàng cấm](docs/06-DANH-MUC-HANG-CAM.md)          | Ba mức kiểm soát BANNED / MANUAL_REVIEW / DISCLOSURE, quy trình xử lý xâm phạm SHTT                           |
| 07  | [Quyết định kiến trúc](docs/07-ARCHITECTURE-DECISIONS.md)  | Nguồn canonical cho stack, module, Supabase, auth, kho nguyên kiện, outbox, tiền, evidence và phạm vi giai đoạn |
| 08  | [Nhật ký hòa giải docs](docs/08-DOCUMENTATION-CHANGELOG.md) | Các file đã đổi, quyết định trước/sau và blocker còn mở                                                        |

## Ba vấn đề cần xử lý sớm nhất

1. **PSP/mô hình ký quỹ, refund và payout chưa được Legal + Business chốt**; payment production đang `BLOCKED` theo A10.
2. **S3 Object Lock đã được chọn và có adapter/template hạ tầng**; còn thiếu nghiệm thu kho thật, che PII, quyền xem và quy trình lưu/xóa sau khi đóng hồ sơ.
3. **Supabase Singapore trước A14 chỉ dùng dev/staging với dữ liệu synthetic/đã ẩn danh**; dữ liệu thật và production cần DPA/data-transfer/legal go/no-go.

Công thức hold, activation deposit, checkout một seller, TTL và phạm vi MVP đã được chốt trong tài liệu 07; không còn là câu hỏi mở.

## Ghi chú

`REBOXE.docx` là tài liệu nguồn cục bộ và được loại trừ qua `.gitignore`. Bản prototype làm việc hiện nằm tại `docs/REBOXE-UI/`, chỉ là tham chiếu UX và không phải nguồn quyết định canonical. Trước khi publish repo, chủ dự án phải rà soát quyền chia sẻ và dữ liệu nhạy cảm của các asset này.

## Chạy MVP sandbox trên máy local

Yêu cầu: Node `24.11.1`, Docker Desktop đang chạy và Corepack đi kèm Node.

```powershell
corepack pnpm install
corepack pnpm db:start
corepack pnpm db:migrate
corepack pnpm db:seed
```

Lấy `PUBLISHABLE_KEY` và `SECRET_KEY` từ `corepack pnpm supabase status -o env`, đặt chúng vào
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` và `SUPABASE_SECRET_KEY` theo `.env.example`, rồi tạo
`.env` ở root và `apps/web/.env.local`. API/worker tự đọc
`.env`; Next.js tự đọc `apps/web/.env.local`. Khi chuyển sang Supabase Cloud,
thay `DATABASE_URL`, issuer/JWKS và các biến public theo khối mẫu Cloud trong
`.env.example`. Không đưa `SECRET_KEY`,
`SERVICE_ROLE_KEY` hoặc database credential vào biến `NEXT_PUBLIC_*`.

Ba tài khoản local synthetic để kiểm tra seller và admin gate:

```text
verified-seller@reboxe.test / Synthetic-Test-Password-123!
pending-seller@reboxe.test  / Synthetic-Test-Password-123!
moderator@reboxe.test       / Synthetic-Test-Password-123!
```

Chạy ba runtime ở ba terminal:

```powershell
corepack pnpm --filter @reboxe/api dev
corepack pnpm --filter @reboxe/worker dev
corepack pnpm --filter @reboxe/web dev
```

Kiểm tra toàn bộ:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:e2e
```

Local seed chỉ chứa fixture synthetic. Trước khi A14 đóng, không nhập dữ liệu
người dùng, nhãn vận đơn, eKYC, thanh toán hoặc production dump thật.
