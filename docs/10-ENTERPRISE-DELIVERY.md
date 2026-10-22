# Triển khai sản phẩm REBOXE

Yêu cầu ngày 20/10/2026 mở rộng phạm vi từ MVP synthetic sang sản phẩm doanh nghiệp. Giả định quyền tích hợp Shopee/TikTok đã được chấp thuận không thay thế credential, kiểm thử với shop được ủy quyền hoặc nghiệm thu nhà cung cấp. Không tự deploy hoặc dùng tiền/dữ liệu thật trong quá trình phát triển.

## Tiêu chí hoàn thành

Mỗi mục chỉ được coi hoàn thành khi có giao diện, API, phân quyền, dữ liệu bền vững, xử lý lỗi, kiểm thử và bằng chứng nghiệm thu. Adapter giả hoặc màn hình mẫu không được tính là tích hợp production.

| Phạm vi hồ sơ | Công việc cần nghiệm thu |
|---|---|
| Kết nối nguồn hàng | Consent, chuyển hướng cấp quyền, callback an toàn, chọn shop, mã hóa token, gia hạn, ngắt kết nối, đồng bộ có phân trang, lịch sử lỗi |
| Nhập bản kê | CSV/XLSX, ánh xạ cột file thực tế, preview, chống trùng, không lưu PII người mua nguồn |
| Quét và đăng bán | Camera + nhập tay, mã giao/hoàn, ghép đúng kiện, tự điền, xác nhận trước công khai, giá và nguồn gốc |
| Chính sách hàng | Nguyên kiện và hàng mở/tồn kho phải có công bố riêng, chính sách hàng cấm, ảnh, kiểm duyệt |
| Mua hàng | Giá/ship/tổng do server báo, địa chỉ, giữ hàng, thử lại sau mất mạng, thanh toán, lịch sử trạng thái |
| Tiền | Snapshot chính sách, hoa hồng, ký quỹ đủ nghĩa vụ, ledger, webhook, đối soát, refund/payout, kết quả UNKNOWN, chống trùng |
| Giao hàng | Báo giá, tạo vận đơn ngoài transaction, webhook xác thực, lấy/giao/hoàn, đối soát cước |
| Khiếu nại | Có/không video, upload private/version/checksum, che PII, xem đúng quyền, quyết định thủ công, kháng nghị, lựa chọn thu hồi |
| AI | Dữ liệu được phép dùng, tập đánh giá độc lập, ngưỡng/giới hạn tiền, chỉ tự chấp thuận, chuyển người khi không chắc |
| Finance | Số liệu từ giao dịch thật, doanh thu ròng, hoa hồng/refund, lịch sử ví, báo cáo và xuất dữ liệu |
| Tăng trưởng | Tài trợ có nhãn, số dư quảng bá riêng; referral/điểm/voucher/badge cần chống lạm dụng và sổ giao dịch |
| Mobile | Web responsive hiện có; app riêng phải được scaffold, kiểm thử và phân phối riêng nếu triển khai phạm vi dài hạn |
| Vận hành | Production fail-closed, retry/dead-letter, giới hạn truy cập, audit/metrics/alert, backup + diễn tập restore, tải/concurrency, runbook |

## Mâu thuẫn cần xử lý trong thiết kế

- Hồ sơ vừa trì hoãn AI ở giai đoạn 1 vừa mô tả AI hoàn tiền trong cùng giai đoạn. Giữ quyết định thủ công tới khi AI được nghiệm thu.
- Hồ sơ có hàng đã mở/tồn kho; kiến trúc hiện tại bán nguyên kiện chưa mở. Không gán nhãn chưa mở cho hàng đã kiểm tra.
- Giá gốc là dữ liệu khai báo nếu chưa có nguồn xác minh. Không dùng nhãn xác thực để chứng nhận vật bên trong.
- Thay đổi công thức tiền phải có policy version và không hồi tố đơn đã snapshot.

## Điều kiện phụ thuộc bên ngoài

Credential ứng dụng và shop thử cho từng sàn; hợp đồng kỹ thuật PSP/ngân hàng hỗ trợ đúng dòng tiền; carrier; kho evidence có versioning/Object Lock; môi trường thử; dữ liệu đánh giá AI. Những mục chưa có bằng chứng này phải ghi chưa nghiệm thu, dù code đã có.

## Trạng thái mã nguồn ngày 21/10/2026

Nhà cung cấp: payOS và KienlongBank theo lựa chọn của chủ dự án; GHN cho vận chuyển, Amazon S3 Object Lock cho bằng chứng. Không có tài khoản/credential thật được sử dụng trong kiểm thử. Chưa push hoặc deploy.

| Hạng mục | Đã có trong đợt này | Còn thiếu |
|---|---|---|
| OAuth Shopee/TikTok | Consent có phiên bản; chuyển sang trang sàn; state dùng một lần gắn actor/shop; chọn shop; token mã hóa; refresh/retry/ngắt; kiểm thử đồng thời | Đồng bộ hàng hoàn có phân trang/checkpoint, preview/commit từ API, nghiệm thu với app được duyệt |
| Quét kiện | Camera đọc barcode/QR, dừng camera khi rời màn hình, nhập tay và xác nhận kiện | Kiểm thử camera trên thiết bị thật |
| Checkout | Server báo giá/tổng; lưu idempotency key qua reload/mất phản hồi; xử lý lượt giữ hết hạn | Thanh toán hàng hóa thật; COD thật; chính sách hoa hồng/ký quỹ có phiên bản; refund/payout ngân hàng |
| payOS | Nạp ngân sách quảng bá của REBOXE; webhook kiểm chữ ký SDK; kiểm số tiền/tài khoản; đối soát; chống credit trùng; chặn sai kênh | Nghiệm thu merchant thật; đối soát kế toán; hàng đợi xử lý chuyển thiếu/thừa/lặp khác reference; không phải ký quỹ tiền hàng |
| GHN | Danh mục địa chỉ, báo phí theo khối lượng/kích thước kiện và pickup shop của từng seller; trang `/seller/shipping` | Tạo/hủy vận đơn thật; theo dõi/hoàn; xác thực bằng truy vấn lại nguồn; đối soát COD/cước |
| Evidence | Consent trước file picker; signed PUT private với SHA-256/COMPLIANCE retention; kiểm media; ghi đúng version; idempotent complete; mẫu CloudFormation | Che PII thật; viewer theo quyền; vòng đời retention sau đóng hồ sơ cuối; legal hold workflow; nghiệm thu AWS |
| AI | FastAPI; model Qwen3-VL-4B-Instruct revision cố định; lấy khung video tối đa 90 giây; checksum/timestamp; báo cáo bất biến; MFA và quyền duyệt; phân tích bản đã lưu | Dữ liệu unboxing có nhãn; tập đánh giá; hiệu chỉnh; GPU/load test; không tự hoàn tiền hoặc từ chối |
| Finance | Đọc ledger POSTED/đơn hoàn thành/refund PAID trong snapshot nhất quán; cảnh báo đơn thiếu commission; không dùng số demo mặc định | Chính sách tiền thật và báo cáo kế toán/thuế, xuất dữ liệu, đối soát các nhà cung cấp |
| Vận hành | Savepoint theo outbox event; retry/backoff/dead-letter; chặn thêm posting vào ledger đã chốt; kiểm thử giao dịch đồng thời | Quan sát/alert production; backup/restore diễn tập; kiểm thử bảo mật/tải và hành trình trình duyệt với Supabase thật |

Các mục còn nguyên phạm vi chưa làm: hàng đã mở/tồn kho với công bố riêng, app mobile, referral/điểm/voucher/badge, ERP public API và báo cáo hiệu suất đầy đủ. Không suy ra tỷ lệ hoàn thành doanh nghiệp từ số màn hình hoặc số test đã qua.

## Chạy và nghiệm thu tích hợp

1. Cài dependencies theo README, sao chép `.env.example` vào môi trường local rồi chạy migration đến `0022`. Không đưa secret vào browser hoặc Git.
2. OAuth: cấu hình app keys phía server và callback chính xác `/seller/connections`; production dùng HTTPS. Seller chỉ bấm cấp quyền trên trang sàn. Không yêu cầu seller nhập API key hoặc đưa OTP/mật khẩu.
3. payOS: mặc định tắt. Chỉ cấu hình merchant thu phí dịch vụ của REBOXE, tài khoản nhận tiền/bank BIN và webhook `/v1/webhooks/payos/promotions`; bật `PAYOS_PROMOTION_PAYMENTS_ENABLED` sau kiểm tra. `BLOCKED` cần điều tra cấu hình; không mở lại bằng cách sửa trạng thái thủ công. Không bật tiền hàng bằng cờ này.
4. GHN: dùng token staging trước và `GHN_SHOP_MAPPING` ánh xạ từng shop REBOXE đến pickup shop GHN hợp lệ. Báo giá không tạo vận đơn; checkout sandbox chưa sử dụng báo giá GHN.
5. Evidence: rà soát `infra/evidence-bucket.yaml`, region và retention trước khi provision; template chưa được triển khai. Chỉ bật `EVIDENCE_MODE=S3_WORM` khi có bucket private/versioned/Object Lock và danh tính AWS tối thiểu. Giao diện không thay file thật bằng metadata giả khi thiếu cấu hình. Retention ban đầu 90 ngày chưa thay thế lịch lưu sau đóng hồ sơ.
6. AI: làm theo `apps/ai-triage/README.md`, có FFmpeg/FFprobe và model local. Dùng service token ngẫu nhiên >=32 ký tự; giữ private. Model cache/venv không đưa vào Git hoặc Docker context. API không cấu hình thì tiếp tục duyệt thủ công.

Trong phiên phát triển này, PostgreSQL 17 riêng trên `127.0.0.1:54329` chỉ phục vụ kiểm thử. Bootstrap trong `packages/backend/test/fixtures/platform-bootstrap.sql` không phải Supabase Auth/Storage; không dùng nó để kết luận đăng nhập trình duyệt hoặc RLS của Supabase đã được nghiệm thu. Dịch vụ ngoài được giả lập ở ranh giới; kiểm thử này xác nhận nghiệp vụ nội bộ, không chứng minh sàn/PSP/carrier/cloud chấp nhận giao dịch thực.

## Kết quả kiểm tra mã nguồn

- Typecheck, ESLint và build toàn monorepo: thành công.
- Vitest: 22 file, 113 test thành công; gồm concurrency checkout/webhook, OAuth, Object Lock boundary, upload/AI theo checksum và quyền, ledger bất biến và phục hồi outbox.
- Python: 8 test thành công; không phải đo độ chính xác model.
- Migration `0018`–`0022`: đã áp dụng trên PostgreSQL kiểm thử riêng; chưa áp dụng production.
- Chưa kiểm thử trình duyệt end-to-end với Supabase Auth/Storage, camera thiết bị thật hoặc API nhà cung cấp thật. Docker/Supabase local không sẵn sàng trong phiên; cluster kiểm thử riêng không thay thế các kiểm tra đó.
- Không commit, push, provision cloud hoặc deploy trong đợt này. Các thay đổi để tại workspace để tiếp tục phát triển.
