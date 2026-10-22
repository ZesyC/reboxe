# Các mục pháp lý cần rà soát trước khi vận hành REBOXE

Ngày lập: 20/10/2026. Đây là danh sách câu hỏi và bằng chứng cần chuẩn bị cho người phụ trách pháp lý, không phải kết luận đủ điều kiện hoạt động. Quyền API Shopee/TikTok được giả định đã có theo yêu cầu triển khai; các gate còn lại chưa được coi đã thông qua. Không deploy tự động từ thay đổi này.

## Sàn thương mại điện tử và pháp nhân

Xác định pháp nhân vận hành, người đại diện, ngành nghề và nghĩa vụ đăng ký/công bố theo loại nền tảng. Rà soát Luật Thương mại điện tử 122/2025/QH15 cùng văn bản hướng dẫn/chuyển tiếp đang có hiệu lực tại ngày mở bán; không dùng nguyên bộ checklist năm 2024. Chuẩn bị quy chế sàn, cơ chế xác minh seller, trách nhiệm công bố và xử lý hàng vi phạm, đầu mối tiếp nhận khiếu nại và báo cáo.

Nguồn để kiểm tra: [Luật TMĐT trên Cổng văn bản Chính phủ](https://vanban.chinhphu.vn/?classid=1&docid=216503&orggroupid=1&pageid=27160), [thủ tục website cung cấp dịch vụ TMĐT](https://dichvucong.gov.vn/p/home/dvc-chi-tiet-thu-tuc-hanh-chinh.html?ma_thu_tuc=1.000311). Cần xác nhận thủ tục cập nhật với cơ quan tiếp nhận.

## Quyền dữ liệu sàn nguồn

Lưu văn bản/quyền ứng dụng cho đúng thị trường, scope và mục đích: lấy dữ liệu hàng hoàn để tạo bản nháp trên REBOXE. Xác nhận riêng quyền sử dụng lại ảnh, tên, nhãn hiệu, giá và lưu dữ liệu sau khi seller ngắt kết nối. Consent của seller không tự cấp quyền đối với ảnh bên thứ ba hoặc PII người mua gốc. Quy định xử lý thu hồi quyền, token bị lộ và yêu cầu xóa từ đối tác.

Nguồn: [TikTok Shop app review](https://partner.tiktokshop.com/docv2/page/app-review-process), [điều khoản Global Selling để tham khảo phạm vi sử dụng API](https://seller-jp.tiktok.com/university/essay?knowledge_id=2996758498117377). Không mặc định điều khoản Global Selling thay thế hợp đồng dành cho shop nội địa Việt Nam.

## Ký quỹ và thanh toán

Lựa chọn hiện tại là payOS + KienlongBank. Mã payOS mới chỉ thu phí/nạp ngân sách quảng bá của REBOXE; chưa chứng minh quyền giữ, phong tỏa, trích hoàn hoặc trả tiền hàng thay seller. Cần yêu cầu đối tác cung cấp hợp đồng và đặc tả kỹ thuật cho chính xác các nghiệp vụ đó, cùng cơ chế xử lý tiền thiếu/thừa, giao dịch lặp, tài khoản bị khóa và đối soát. Không coi payment link/chuyển khoản thành ký quỹ ngân hàng.

Nhờ luật sư và ngân hàng/PSP xác nhận sơ đồ luồng tiền bằng văn bản: ai giữ tiền hàng, ai giữ bảo đảm, ai có quyền phong tỏa/trích hoàn, giới hạn lệnh, tài khoản thụ hưởng, quyền khi có tranh chấp và trách nhiệm khi đối tác gián đoạn. Không kết luận tránh mọi nghĩa vụ trung gian thanh toán chỉ vì gọi số dư là ký quỹ hoặc để tiền tại ngân hàng. Nạp/rút, refund, payout và kết quả UNKNOWN phải khớp hợp đồng và báo cáo đối soát. Không dùng số dư quảng bá để thay thế ví thanh toán.

Nguồn: [Thông tư 40/2024/TT-NHNN trên Công báo](https://congbaocdn.chinhphu.vn/CongBaoCP/VanBan/2024/7/42371/51059-1-2024885-88640-2024-tt-nhnn.pdf). Kiểm tra văn bản sửa đổi/hợp nhất và quy định hiện hành về thanh toán không dùng tiền mặt trước khi ký hợp đồng.

## Dữ liệu cá nhân và eKYC

Lập danh mục dữ liệu và mục đích, vai trò bên kiểm soát/xử lý, căn cứ xử lý cho từng mục đích; consent phải có phiên bản, khả năng chứng minh và rút lại khi áp dụng. Rà soát hồ sơ đánh giá tác động, chuyển dữ liệu ra nước ngoài, DPA/subprocessor của Supabase/eKYC/storage/inference và nơi đặt dữ liệu. Quy định xử lý yêu cầu truy cập/sửa/xóa, sự cố và thời hạn phản hồi. Không gộp đồng ý xử lý tranh chấp với đồng ý huấn luyện AI hoặc đăng video marketing.

Nguồn: [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://congbao.chinhphu.vn/van-ban/luat-so-91-2025-qh15-45578/57730.htm), [Luật Dữ liệu](https://xaydungchinhsach.chinhphu.vn/toan-van-luat-du-lieu-119250226145839949.htm). Rà soát cả văn bản hướng dẫn có hiệu lực, không chỉ nghị định cũ.

## Video và lưu giữ bằng chứng

Đề xuất kỹ thuật: Amazon S3 private, versioning và Object Lock COMPLIANCE, có checksum. Region Singapore trong file mẫu chỉ là cấu hình đề xuất, chưa phải chấp thuận chuyển dữ liệu. Retention COMPLIANCE không thể rút ngắn tùy ý; chốt thời hạn/căn cứ trước khi upload dữ liệu thật. Mã hiện mới đặt retention ban đầu 90 ngày, chưa có lịch kéo dài theo ngày đóng hồ sơ cuối và quy trình legal hold đầy đủ.

Phê duyệt thông báo trước camera/file picker, giới hạn mục đích, quyền xem bản gốc/bản che PII, bằng chứng đã tải về, checksum/version và audit. Xác định thời hạn lưu theo loại dữ liệu và thời điểm đóng hồ sơ cuối cùng; giải quyết xung đột giữa quyền xóa, Object Lock và legal hold. Hợp đồng kho phải nêu region, khôi phục, xóa và quyền truy xuất. Video không phải điều kiện duy nhất để tiếp nhận khiếu nại. Không tự đưa evidence vào bộ train.

## AI và dữ liệu huấn luyện

Phân loại hệ thống và nghĩa vụ áp dụng theo pháp luật AI hiện hành; rà soát nghĩa vụ thông báo, đánh giá rủi ro, giám sát của con người và lưu vết. Xác minh license của đúng model/revision/dataset, attribution và quyền sử dụng từng nguồn. Hiện dịch vụ chỉ tạo nhận xét hình ảnh cho người duyệt; không chứng minh video nguyên bản, không tự từ chối và không thực hiện giao dịch tiền.

Nguồn: [nội dung Luật Trí tuệ nhân tạo từ Chính phủ](https://xaydungchinhsach.chinhphu.vn/nhung-noi-dung-dang-chu-y-cua-luat-tri-tue-nhan-tao-119260212091614393.htm), [model card Qwen](https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct), [VisA CC BY 4.0](https://github.com/amazon-science/spot-diff), [MVTec AD 2 có hạn chế phi thương mại](https://www.mvtec.com/research-teaching/datasets/mvtec-ad-2). Chưa xác định hệ thống REBOXE thuộc nhóm rủi ro pháp lý nào; cần phân loại riêng.

## Bảo vệ người mua và chất lượng hàng

Phân biệt nguyên kiện chưa mở, hàng đã mở, hàng tồn kho và sản phẩm đã kiểm tra. Không trình bày bản kê như chứng nhận chất lượng bên trong. Rà soát nhãn “xác thực”, giá gốc/giảm giá, tổng phí trước đặt hàng, điều kiện hoàn tiền/thu hồi, trách nhiệm hàng không an toàn và quyền kháng nghị. Hàng cấm/hạn chế và quyền sở hữu trí tuệ cần quy trình thông báo–gỡ bỏ. Không có video không đồng nghĩa mất quyền khiếu nại.

## Thuế và kế toán

Xác định nghĩa vụ kê khai/khấu trừ/nộp thay nếu áp dụng, hóa đơn phí hoa hồng/tài trợ, hóa đơn hàng hóa do ai lập, đối soát COD, doanh thu gộp/ròng và cách hạch toán bảo đảm/số dư quảng bá/hoàn tiền. Nhờ kế toán xác nhận chính sách theo pháp luật tại ngày vận hành; chưa chốt thuế suất trong tài liệu này.

## Hợp đồng vận chuyển và quảng cáo

Carrier đề xuất là GHN. Hiện chỉ có báo phí; cần hợp đồng pickup/COD/hoàn của đúng từng shop hoặc mô hình master account được GHN xác nhận. Chưa có bằng chứng cho quyền thu hộ hoặc tạo vận đơn thay mọi seller từ một tài khoản.

Chốt trách nhiệm mất/hỏng, trọng lượng quy đổi, COD, hoàn hai chiều, thời điểm hoàn thành và bằng chứng giao nhận. Với tài trợ, voucher/điểm/referral: quy định giá, hoàn phần chưa dùng, nhãn quảng cáo, thời hạn, điều kiện khuyến mại, chống lạm dụng và quyền dừng. Không hứa thứ hạng hoặc hiệu quả bán không được bảo đảm.

## Hồ sơ chốt trước khi mở bán

Lưu người phụ trách, ngày rà soát, phiên bản tài liệu và căn cứ cho từng mục. Cần kết quả rà soát pháp lý cùng nghiệm thu kỹ thuật/nhà cung cấp, kiểm thử bảo mật, backup/restore, đối soát tiền và xử lý sự cố. Tài liệu này không thay thế các kết quả đó.
