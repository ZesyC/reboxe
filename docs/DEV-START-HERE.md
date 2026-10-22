# Đọc cái này trước — dành cho đội phát triển

Bộ tài liệu lịch sử MVP được đánh số từ `00` đến `08`, cộng `CODEBASE.md`. Đợt mở rộng doanh nghiệp được cập nhật tại [10-ENTERPRISE-DELIVERY.md](10-ENTERPRISE-DELIVERY.md) và [11-PREDEPLOY-LEGAL-REVIEW.md](11-PREDEPLOY-LEGAL-REVIEW.md); đọc trạng thái mới trước khi dùng phạm vi cũ để đánh giá sản phẩm.

Thời gian đọc ngày đầu: **khoảng 40 phút.** Phần còn lại đọc theo sprint.

---

## 1. Ngày đầu tiên — bắt buộc, 40 phút

Đọc đúng bốn thứ này, theo thứ tự:

| # | Đọc gì | Vì sao |
|---|---|---|
| 1 | `README.md` | Biết dự án là gì trong 3 phút |
| 2 | **`07-ARCHITECTURE-DECISIONS`** | Nguồn chuẩn cho stack, Supabase, phạm vi MVP và các quyết định đã hòa giải |
| 3 | **`CODEBASE.md`** | Cấu trúc monorepo thực tế đang có trong workspace |
| 4 | **`04-IMPLEMENTATION-PLAN` §1, §2, §3** | Đội hình, phạm vi đã cắt, lộ trình. Biết mình không phải làm gì cũng quan trọng như biết phải làm gì |

`00-TONG-QUAN` là lịch sử audit và lý do đằng sau quyết định; đọc sau `07` khi cần truy nguyên. Chưa cần đụng tới 01, 02, 03, 05, 06 trong ngày đầu.

---

## 2. Các quyết định đã chốt

Không cần tra lại trong tài liệu, dùng bảng này:

| Mã | Nội dung | Chốt |
|---|---|---|
| Q1 | Công thức hold | `hàng + ship buyer + hoa hồng + 45.000đ dự phòng ship`. Mức 22.000đ bị loại vì không đủ cho hoàn hai chặng |
| Q2 | Ký quỹ | Shop kích hoạt khi số dư đã settle đạt **100.000đ**; không tier, không công thức AOV động. Năng lực bán suy ra từ số dư |
| Q3 | Dòng tiền hàng | Không escrow tiền hàng. Mỗi checkout chỉ một seller; production chỉ dùng phương án dòng tiền được Legal/PSP phê duyệt |
| Q4 | Nguồn bản kê | `SPREADSHEET` và `PLATFORM_API` là hai kênh nhập ngang hàng, cùng trả `ReturnManifestDraft`; bản đầu chỉ bật CSV/XLSX |
| Q5 | Hàng cấm | Xem `06-DANH-MUC-HANG-CAM.md` |
| Q6 | Thanh toán | Chủ dự án chọn **payOS + KienlongBank**. Adapter hiện chỉ nạp ngân sách quảng bá; tiền hàng/ký quỹ/refund/payout còn thiếu hợp đồng và triển khai. Xem tài liệu 10–11 |
| Q7 | Ngưỡng hư hỏng | **30%** |
| Q8 | Video | Tối đa **90 giây**; policy target hiện tại tính từ `case.final_closed_at` là **90 ngày** cho original và **3 năm** cho derivative/biên bản; phải snapshot version Legal duyệt, Object Lock/legal hold có thể kéo dài |
| Q9 | Supabase | PostgreSQL + Auth; NestJS sở hữu mutation nghiệp vụ; Realtime chỉ báo refetch; evidence không dùng Supabase Storage |
| Q10 | Async | PostgreSQL transactional outbox; chưa dùng Redis/BullMQ ở MVP |

---

## 3. Đọc theo sprint

Đọc đúng phần cần dùng, ngay trước khi code phần đó:

| Sprint | Đọc | Bỏ qua phần còn lại |
|---|---|---|
| **1** — Nền tảng + vertical slice | `07` §4–§8 · `01` §2, §4, §9 · `CODEBASE.md` | Không dựng mobile/AI/Redis |
| **2** — Catalog & kho hoàn | `CONTEXT.md` · `00` §L4, §L7 · `01` §4.2.1, §6.2 · `02` §2 · `03` §2, §3 · `06` §7 | Bán nguyên kiện, không tạo ReturnUnit; API ở `01` §7.1 chỉ là target adapter |
| **3** — Ví & sổ cái ⭐ | `01` §5 (**đọc kỹ**) · `02` §1, §4 · `00` §L1, §L2, §L3 | |
| **4** — Thanh toán | `01` §7.3 · `02` §3 | |
| **5** — Vận chuyển | `01` §7.2 · `02` §3.4, §3.5 | |
| **6** — Tranh chấp manual + Admin | `01` §4.2, §6.3, §9.2 · `02` §5 (bỏ §5.3 AI) · `03` §1.6, §2.7, §4 · `05` §3.4 | `01` §8 và AI UI là GĐ3 |
| **7** — Notice, retention, thông báo, trang pháp lý | `02` §5.2 · `03` §1.6 · `04` Sprint 7 · `05` §3.4.5–§3.4.6 | Không thêm loyalty/AI |
| **8** — Làm cứng/pilot | `01` §9 · `04` §11 · `05` §10 | Public API ERP hoãn tới khi có nhu cầu thật |

**Sprint 3 là sprint quan trọng nhất.** Sổ cái sai thì không sửa được bằng bản vá. Đọc `01` §5 đến khi hiểu rõ bút toán kép trước khi viết dòng đầu tiên.

---

## 4. Yêu cầu pháp lý ảnh hưởng trực tiếp đến code

**Không bắt dev đọc hết `05-PHAP-LY`** — 600 dòng, phần lớn là thủ tục giấy tờ. Nhưng bảy điều dưới đây **là yêu cầu kỹ thuật**, vi phạm là lỗi nghiêm trọng:

| # | Yêu cầu | Ảnh hưởng | Chi tiết |
|---|---|---|---|
| 1 | **GĐ1 mọi quyết định tranh chấp do người xử lý** | Nếu AI GĐ3 được bật, chỉ có `AUTO_APPROVE` hoặc `ESCALATE`, tuyệt đối không `AUTO_REJECT` | `00` §L6 |
| 2 | **Video không phải điều kiện tiên quyết** để khiếu nại | Thiếu video vẫn nhận hồ sơ và chuyển `ADMIN_REVIEW`; AI GĐ3 không được auto-approve hồ sơ này | `00` §L5 |
| 3 | **Mã vận đơn không bao giờ ra API công khai** | ID công khai là ULID. `source_tracking_enc` mã hoá tầng ứng dụng | `00` §L4 |
| 4 | **Seller không bao giờ xem video gốc** | Chỉ xem `evidence_derivatives` đã che mặt + che nhãn vận đơn. Khử nhận dạng lỗi thì **không hiển thị gì**, không fallback về bản gốc | `05` §3.4.3 |
| 5 | **Ghi processing record trước camera/file picker** | Client chỉ gửi notice artifact + decision; server resolve basis/type, tạo record cho interaction và append event theo stable purpose chain; evidence tham chiếu header | `05` §3.4.5 |
| 6 | **Retention theo data class/case** | Policy versioned + workflow delete/anonymize phải test; evidence target đúng object version và không xóa trước Object Lock/legal hold | `05` §3.4.6 |
| 7 | **Phí tính theo cấu hình tại thời điểm đặt hàng** | Snapshot config vào `sub_orders.fee_snapshot` lúc checkout, không đọc config hiện hành lúc settle | `02` §4.1 |

Bảy điều này nên đưa thẳng vào checklist review code, không phải đọc một lần rồi quên.

---

## 5. Những thứ chưa có đáp án — đừng chờ

| Việc | Ai lo | Trong lúc chờ thì làm gì |
|---|---|---|
| Đăng ký partner Shopee / TikTok | Trưởng dự án | Dùng CSV qua cùng contract trong lúc chờ; chỉ mở live adapter khi đủ gate |
| PSP nào đáp ứng custody/top-up/payout/refund/withdrawal/webhook/AML/KYC và giấy phép phù hợp? | Trưởng dự án + Pháp lý | Giữ `PaymentProvider` và fake adapter cho test. **Không chạy tiền thật, không ghi cứng PayOS** |
| Provider evidence có versioning + Object Lock compliance + region phù hợp | Tech + Pháp lý | Chỉ làm metadata/local adapter; không dùng Supabase Storage cho evidence production |
| Supabase Singapore có được dùng dữ liệu thật/production không? | Tech + Pháp lý | Trước A14, dev/staging chỉ dùng synthetic/anonymized fixture; mọi dữ liệu thật cần DPA/subprocessor/data-transfer review và Legal go/no-go |
| Khảo sát nhãn kiện hàng thật (việc 1.0) | Dev 2 + Pháp lý | Chặn thiết kế luồng quét. Làm sớm, một buổi chiều là xong |
| Đăng ký sàn TMĐT | Pháp lý | Không chặn code, nhưng chặn ngày mở bán |

---

## 6. Ai đọc file nào

| File | Dev | Pháp lý |
|---|---|---|
| `00-TONG-QUAN` | ✅ toàn bộ | ✅ §2 |
| `01-TECHNICAL-SPEC` | ✅ theo sprint | — |
| `02-BACKEND-FLOWS` | ✅ theo sprint | — |
| `03-FRONTEND-FLOWS` | ✅ theo sprint | §1.6 (notice/lựa chọn evidence) |
| `04-IMPLEMENTATION-PLAN` | ✅ §1–3 | ✅ §4 (Giai đoạn 0 — đường găng dài nhất nằm ở đây) |
| `05-PHAP-LY` | §3.4 khi làm evidence · §4 khi làm hạ tầng · §10 trước pilot | ✅ **sở hữu toàn bộ** |
| `06-DANH-MUC-HANG-CAM` | §7 (cơ chế thực thi) | ✅ **sở hữu**, phải trả lời 5 câu ở §8 |
| `07-ARCHITECTURE-DECISIONS` | ✅ **đọc trước khi code** | ✅ các mục gắn legal gate |
| `08-DOCUMENTATION-CHANGELOG` | Khi cần truy vết thay đổi | Khi cần truy vết thay đổi |

---

## 7. Ba điều dễ làm sai nhất

**Đừng tự sửa con số chính sách trong code.** Mọi ngưỡng nằm ở `system_configs` với `effective_from`. Hardcode một con số phí là tạo ra một chỗ không giải trình được khi bị hỏi.

**Đừng gọi HTTP bên ngoài trong database transaction.** Ghi ledger + ghi `outbox` trong cùng transaction, worker đọc outbox gọi ra ngoài sau.

**Đừng tin client về tiền.** Mọi số tiền tính lại ở backend. Frontend được hiển thị ước tính nhưng phải gắn nhãn "dự kiến".

---

## 8. Ba quy tắc monorepo — quyết định mobile sau này mất 3 tuần hay 3 tháng

Web làm trước, mobile làm ở GĐ3. **Tầng giao diện luôn phải viết lại** (React Native không chạy HTML/CSS), nhưng 50–60% còn lại thì dùng lại được — nếu giữ đúng ba quy tắc:

| # | Quy tắc | Vi phạm thì sao |
|---|---|---|
| 1 | Không gọi `fetch` trong component — đi qua `packages/api-client` | Mobile phải viết lại toàn bộ tầng gọi API |
| 2 | **Không tính toán nghiệp vụ trong component** — nằm ở `packages/core`, hàm thuần, có test | **Tốn kém nhất.** Logic tính phí rải trong JSX ⇒ mobile viết lại ⇒ hai bản tính tiền lệch nhau |
| 3 | `packages/` không được import từ `apps/web` | Package biết mình chạy trên web ⇒ không mang sang native được |

Ba quy tắc này là **lint rule trong CI**, không phải thỏa thuận miệng. Chi tiết: `01-SPEC` §2.5.

Dùng Tailwind cho web và có thể dùng NativeWind khi làm mobile, nhưng **không cam kết component hay class name web chạy nguyên xi trên React Native**. Chỉ `ui-tokens`, schema, API client và logic thuần là tài sản dùng chung được bảo đảm.

---

## 9. Bốn guardrail Supabase

1. Frontend chỉ gọi Supabase trực tiếp cho Auth và các projection đọc được phê duyệt; mutation nghiệp vụ đi qua NestJS.
2. Secret key/`service_role` và database credential chỉ nằm ở API/worker.
3. RLS + grant là defense-in-depth; authorization ownership/membership vẫn phải có trong NestJS và truy vấn.
4. Supabase Realtime chỉ báo client refetch API; không dùng event Realtime để xác nhận payment, order, wallet, hold hoặc dispute.
