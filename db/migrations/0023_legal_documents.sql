WITH docs(slug, version, title, body) AS (
  VALUES
    (
      'marketplace-rules',
      '2026-11-18',
      'Quy chế hoạt động Sàn giao dịch TMĐT REBOXE',
      $rules$MIỄN TRỪ VÀ LƯU Ý PHÁP LÝ TRƯỚC VẬN HÀNH THƯƠNG MẠI: Tài liệu này được soạn thảo theo khung pháp luật Việt Nam hiện hành áp dụng cho mô hình Sàn giao dịch thương mại điện tử (TMĐT) chuyên về hàng hoàn và hàng thanh lý REBOXE. Trước khi mở giao dịch tiền thật cho công chúng, đơn vị vận hành cần điền đầy đủ thông tin pháp nhân đã đăng ký, hoàn tất thủ tục thông báo/đăng ký sàn TMĐT, hợp đồng với ngân hàng/tổ chức cung ứng dịch vụ trung gian thanh toán được Ngân hàng Nhà nước (NHNN) cấp phép và để Luật sư rà soát ký duyệt chính thức.

CĂN CỨ PHÁP LÝ ÁP DỤNG
- Luật Thương mại điện tử số 122/2025/QH15 (có hiệu lực từ ngày 01/07/2026) và các văn bản hướng dẫn thi hành.
- Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15 và Nghị định số 55/2024/NĐ-CP.
- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15, Nghị định số 356/2025/NĐ-CP và Nghị định số 330/2026/NĐ-CP.
- Luật Giao dịch điện tử số 20/2023/QH15; Bộ luật Dân sự số 91/2015/QH13; Luật Thương mại số 36/2005/QH11.
- Luật Sở hữu trí tuệ hiện hành; Nghị định số 98/2020/NĐ-CP (sửa đổi, bổ sung bởi Nghị định số 17/2022/NĐ-CP); Nghị định số 69/2018/NĐ-CP; Nghị định số 43/2017/NĐ-CP (sửa đổi bởi Nghị định số 111/2021/NĐ-CP); Luật Quảng cáo (đã sửa đổi, bổ sung có hiệu lực từ 01/01/2026) và các văn bản pháp luật thuế áp dụng cho TMĐT.

Điều 1. Phạm vi điều chỉnh và Thông tin đơn vị vận hành
- REBOXE là sàn giao dịch thương mại điện tử trung gian (nền tảng số trung gian theo Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 và Luật Thương mại điện tử 122/2025/QH15) kết nối Người bán đã xác minh danh tính với Người mua để giao dịch hàng hoàn, hàng thanh lý tồn kho và kiện hàng nguyên kiện.
- Thông tin đơn vị chủ quản nền tảng (hoàn thiện trước khi công bố chính thức): Tên pháp nhân [Tên doanh nghiệp vận hành REBOXE]; Mã số doanh nghiệp [Số ĐKKD/MST]; Người đại diện theo pháp luật [Họ và tên]; Trụ sở chính [Địa chỉ đăng ký]; Kênh tiếp nhận hỗ trợ & khiếu nại chính thức tại trang Hỗ trợ (/support) và [Email/Hotline CSKH]; Hồ sơ sàn TMĐT [Mã hồ sơ/Số xác nhận cơ quan có thẩm quyền].
- Quy chế này điều chỉnh quyền, nghĩa vụ của REBOXE, Người bán và Người mua khi tạo tài khoản, đăng tải sản phẩm, giao kết hợp đồng mua bán trực tuyến, giao nhận và giải quyết tranh chấp trên REBOXE.

Điều 2. Phân loại sản phẩm đặc thù và Nghĩa vụ công bố thông tin trung thực
- Kiện hàng chưa mở kiểm tra (UNOPENED_UNINSPECTED): Là kiện hàng hoàn bị từ chối nhận hoặc chưa từng mở kể từ khi hoàn về kho Người bán. REBOXE và Người bán chưa mở hộp, chưa kiểm đếm, chưa kiểm định chi tiết nội dung và chất lượng vận hành bên trong. Toàn bộ thông tin nhập từ bản kê CSV/Excel hoặc kết nối nguồn hàng là dữ liệu khai báo từ đơn hàng gốc, không phải giấy chứng nhận kiểm định chất lượng của REBOXE. Trạng thái niêm phong (Nguyên vẹn / Có dấu hiệu hư hỏng / Chưa xác định) chỉ phản ánh quan sát bao bì bên ngoài.
- Sản phẩm đã mở kiểm tra / đăng bán trực tiếp (SELLER_DECLARED): Người bán bắt buộc khai báo trung thực theo thang tình trạng thống nhất trên hệ thống gồm: Mới nguyên seal (NEW_SEALED), Gần như mới (LIKE_NEW_99), Còn tốt (GOOD), Đã qua sử dụng (FAIR) và Có lỗi (DEFECT - bắt buộc mô tả chi tiết lỗi và ảnh thực tế tại vị trí lỗi). Mọi sản phẩm đã mở không được sử dụng nhãn "Mới nguyên seal" hay dùng ảnh quảng cáo hàng mới để thay thế ảnh thực trạng.
- Minh bạch giá bán và giá tham chiếu: Đối với sản phẩm người bán tự khai báo thủ công (SELLER_DECLARED), REBOXE không hiển thị giá gốc gạch ngang hay phần trăm giảm giá nếu không có dữ liệu đối chiếu từ bản kê nguồn hàng. Mọi cam kết về trần giá so với giá gốc chỉ áp dụng đối với nhóm kiện hàng có dữ liệu bản kê nguồn hợp lệ và không cấu thành cam kết so sánh giá tuyệt đối trên toàn thị trường.

Điều 3. Tài khoản, Xác thực danh tính Người bán (eKYC) và Minh bạch thông tin
- Người bán muốn mở gian hàng và đăng bán công khai bắt buộc hoàn tất quy trình xác thực danh tính điện tử (eKYC) đạt trạng thái Đã xác minh (VERIFIED), bao gồm đối chiếu giấy tờ định danh hợp pháp, kiểm tra người thật (liveness) và xét duyệt hồ sơ theo quy định.
- Trang gian hàng và trang chi tiết sản phẩm hiển thị công khai tên gian hàng, trạng thái xác thực eKYC và địa chỉ kho lấy hàng (nếu có) để Người mua kiểm tra trước khi giao kết hợp đồng theo Điều 20 Luật Bảo vệ quyền lợi người tiêu dùng và quy định của Luật Thương mại điện tử 122/2025/QH15.
- Người bán chịu trách nhiệm về tính hợp pháp, nguồn gốc trong nước và nhãn hàng hóa lưu thông của sản phẩm theo Nghị định 43/2017/NĐ-CP và Nghị định 111/2021/NĐ-CP; nghiêm cấm bán hàng tiêu dùng đã qua sử dụng có nguồn gốc nhập khẩu thuộc Danh mục cấm nhập khẩu theo Nghị định 69/2018/NĐ-CP.

Điều 4. Quy trình giao dịch, Vận chuyển và Quản lý dòng tiền / Bảo đảm nghĩa vụ
- Trước khi Người mua nhấn đặt hàng, hệ thống công khai đầy đủ đơn giá, phí vận chuyển dự kiến, tổng số tiền phải thanh toán, thông tin Người bán, cảnh báo tình trạng kiện hàng và đường dẫn tới Quy trình giải quyết tranh chấp. Mỗi đơn đặt hàng tuân thủ giao kết hợp đồng điện tử theo Luật Giao dịch điện tử 20/2023/QH15.
- Trong giai đoạn thử nghiệm kỹ thuật (sandbox), thanh toán và vận đơn sử dụng dữ liệu mô phỏng (COD mô phỏng / GHN staging) và không phát sinh thu chi tiền thật. Khi vận hành thương mại, mọi luồng thanh toán hộ, giữ hộ, trích hoàn hoặc tất toán bảo đảm nghĩa vụ của Người bán chỉ được thực hiện thông qua ngân hàng và/hoặc tổ chức cung ứng dịch vụ trung gian thanh toán được NHNN cấp phép theo đúng hợp đồng dịch vụ thanh toán, đảm bảo tuân thủ Luật Các tổ chức tín dụng 2024, Nghị định 52/2024/NĐ-CP và Thông tư 40/2024/TT-NHNN.
- Đối với cơ chế ký quỹ bảo đảm nghĩa vụ của Người bán (áp dụng theo Điều kiện giao dịch chung riêng với Người bán và Điều 328 Bộ luật Dân sự 2015): REBOXE chỉ khóa hoặc khấu trừ đúng phần nghĩa vụ tài chính phát sinh hợp lệ (phí dịch vụ nền tảng, phí vận chuyển phát sinh, nghĩa vụ hoàn tiền theo quyết định tranh chấp có hiệu lực). Mọi khoản khấu trừ hoặc tạm khóa gian hàng đều có thông báo trước kèm căn cứ đối soát và quyền giải trình của Người bán; phần dư ký quỹ được hoàn trả theo lịch đối soát khi chấm dứt hợp tác sau khi hoàn tất các nghĩa vụ mở.

Điều 5. Hàng hóa cấm kinh doanh, Kiểm duyệt trước khi hiển thị và Sở hữu trí tuệ
- Nhóm BANNED (Cấm tuyệt đối): Cấm đăng bán ma túy, tiền chất, vũ khí, pháo nổ, vật liệu nổ, mẫu vật động thực vật hoang dã nguy cấp, văn hóa phẩm trái pháp luật, thiết bị gián điệp/phá sóng; toàn bộ thuốc chữa bệnh (kể cả không kê đơn); thuốc lá điện tử, thuốc lá nung nóng, thuốc lá điếu; hàng giả, hàng nhập lậu, hàng không rõ nguồn gốc xuất xứ; ngoại tệ, vàng miếng, tài khoản ngân hàng, SIM kích hoạt, giấy tờ tùy thân; thực phẩm tươi sống cần chuỗi lạnh, hàng quá hạn sử dụng; chất dễ cháy nổ và pin lithium rời thuộc danh mục hạn chế vận chuyển nguy hiểm.
- Nhóm MANUAL_REVIEW (Bắt buộc quản trị viên duyệt thủ công, SLA dự kiến 24 giờ): Mỹ phẩm (yêu cầu rõ Phiếu công bố và hạn sử dụng), thực phẩm bao gói sẵn/thực phẩm bảo vệ sức khỏe, trang thiết bị y tế nhóm được phép, đồ chơi trẻ em, thiết bị điện gia dụng và mũ bảo hiểm (bắt buộc dấu hợp quy CR), hàng hiệu giá trị cao hoặc sản phẩm có đơn giá từ 2.000.000đ trở lên, vàng trang sức/đá quý, sách và ấn phẩm. Hệ thống không tự động duyệt khi quá hạn SLA.
- Quy trình thông báo và gỡ bỏ (Notice & Takedown) đối với xâm phạm Quyền sở hữu trí tuệ: Chủ thể quyền gửi yêu cầu kèm giấy chứng nhận đăng ký/tài liệu chứng minh quyền và danh sách đường dẫn vi phạm qua kênh tiếp nhận công khai (/support hoặc đầu mối SHTT của sàn). REBOXE tạm ẩn tin đăng nghi vấn trong vòng 24 giờ kể từ khi nhận đủ hồ sơ hợp lệ, thông báo để Người bán giải trình trong 05 ngày làm việc và gỡ vĩnh viễn hoặc khôi phục theo căn cứ xác minh; tái phạm từ 03 lần có căn cứ dẫn tới khóa gian hàng.

Điều 6. Tiêu chí sắp xếp hiển thị và Nội dung quảng cáo / Tài trợ
- Thứ tự hiển thị tìm kiếm và gợi ý mặc định dựa trên độ khớp từ khóa, trạng thái sản phẩm đang hoạt động, thời gian cập nhật mới nhất và bộ lọc giá do Người mua tự lựa chọn.
- Trường hợp REBOXE cung cấp gói quảng bá sản phẩm trả phí, mọi tin đăng hưởng ưu tiên hiển thị từ ngân sách quảng bá bắt buộc gắn nhãn phân biệt "Tài trợ" rõ ràng trước khi Người mua xem hoặc tương tác, tuân thủ Điều 39 Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15 và Luật Quảng cáo hiện hành.

Điều 7. Bảo vệ người tiêu dùng, Chế tài vi phạm và Nghĩa vụ thuế
- Không có bất kỳ điều khoản nào trong Quy chế này nhằm mục đích loại trừ hoặc hạn chế trách nhiệm luật định của Người bán hay hạn chế quyền khiếu nại, bảo hành, yêu cầu hòa giải, trọng tài hoặc khởi kiện của Người tiêu dùng theo Điều 25 Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15.
- Tùy mức độ vi phạm của Người bán (cung cấp thông tin sai sự thật, giao hàng cấm/hàng giả, cố tình né bộ lọc từ khóa, không phối hợp đối soát tranh chấp), REBOXE áp dụng chế tài theo nấc thang: (1) Gỡ tin đăng và cảnh báo bằng thông báo hệ thống; (2) Tạm hạn chế quyền đăng bán 07 ngày; (3) Tạm ngưng hoặc chấm dứt hoạt động gian hàng. Mọi biện pháp đều ghi nhận nhật ký kiểm toán và mở quyền giải trình/khiếu nại cho Người bán.
- Nghĩa vụ thuế: Người bán tự chịu trách nhiệm về tính chính xác của thông tin thuế/định danh và nghĩa vụ thuế đối với doanh thu bán hàng; REBOXE thực hiện lưu trữ dữ liệu giao dịch, cung cấp thông tin cho cơ quan thuế theo quy định, xuất hóa đơn điện tử cho các khoản phí dịch vụ thu từ Người bán và thực hiện nghĩa vụ khấu trừ, nộp thuế thay (nếu thuộc diện áp dụng theo hướng dẫn hiện hành của cơ quan quản lý thuế).

Điều 8. Hiệu lực và Sửa đổi Quy chế
- Quy chế này có hiệu lực kể từ ngày công bố và được lưu trữ bất biến theo từng phiên bản (slug, version, body_hash).
- Khi sửa đổi Quy chế làm thay đổi quyền hoặc nghĩa vụ trọng yếu, REBOXE công bố phiên bản mới kèm ngày hiệu lực và ghi nhận sự đồng ý của Người dùng đối với phiên bản cập nhật trên hệ thống.$rules$
    ),
    (
      'privacy-policy',
      '2026-11-18',
      'Chính sách bảo vệ dữ liệu cá nhân & Bảo mật thông tin REBOXE',
      $privacy$MIỄN TRỪ VÀ PHẠM VI ÁP DỤNG: Chính sách này mô tả cách thức REBOXE thu thập, xử lý, lưu trữ và bảo vệ dữ liệu cá nhân trên nền tảng TMĐT REBOXE theo pháp luật Việt Nam hiện hành. Trong giai đoạn thử nghiệm kỹ thuật (sandbox), người dùng không tải lên CCCD, giấy tờ định danh thật, thông tin tài khoản thật hay dữ liệu cá nhân của bên thứ ba.

CĂN CỨ PHÁP LÝ ÁP DỤNG
- Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 (có hiệu lực từ ngày 01/01/2026).
- Nghị định số 356/2025/NĐ-CP quy định chi tiết một số điều và biện pháp thi hành Luật Bảo vệ dữ liệu cá nhân (thay thế Nghị định số 13/2023/NĐ-CP).
- Nghị định số 330/2026/NĐ-CP về xử phạt vi phạm hành chính trong lĩnh vực an ninh mạng và bảo vệ dữ liệu cá nhân (bao gồm quy định về sự đồng ý tách bạch theo từng mục đích và nhật ký chứng minh sự đồng ý).
- Luật An ninh mạng số 116/2025/QH15; Luật Dữ liệu; Luật Thương mại điện tử số 122/2025/QH15; Điều 32 Bộ luật Dân sự 2015 về quyền của cá nhân đối với hình ảnh.

Điều 1. Bên Kiểm soát dữ liệu và Đầu mối liên hệ
- REBOXE đóng vai trò Bên Kiểm soát dữ liệu cá nhân (và Bên Kiểm soát kiêm xử lý dữ liệu khi trực tiếp vận hành nền tảng) đối với dữ liệu do Người mua, Người bán và Người truy cập cung cấp trên REBOXE.
- Đầu mối phụ trách Bảo vệ dữ liệu cá nhân và tiếp nhận yêu cầu của Chủ thể dữ liệu: Bộ phận Pháp chế / Hỗ trợ REBOXE qua trang Hỗ trợ (/support), mục Quyền riêng tư trong Tài khoản (/account/privacy) và [Email/Hotline BVDLCN công bố khi vận hành chính thức].

Điều 2. Phân loại dữ liệu cá nhân được thu thập và xử lý
- Dữ liệu cá nhân cơ bản: Họ và tên, địa chỉ email, số điện thoại, địa chỉ giao nhận/lấy hàng, tên hiển thị gian hàng, lịch sử đơn hàng, nội dung trao đổi khiếu nại/hỗ trợ, đánh giá shop và nhật ký thao tác kỹ thuật (địa chỉ IP, thời điểm truy cập, mã yêu cầu).
- Dữ liệu cá nhân nhạy cảm (chỉ thu thập khi phát sinh nghiệp vụ tương ứng và có thông báo rõ trước khi thu thập):
  (a) Dữ liệu định danh điện tử Người bán (eKYC): Ảnh mặt trước/sau CCCD/CMND, ảnh chân dung (selfie), dữ liệu đối chiếu sinh trắc học khuôn mặt và kiểm tra thực thể sống (liveness);
  (b) Thông tin tài khoản ngân hàng/thanh toán phục vụ xác minh đối soát, hoàn tiền hoặc ký quỹ;
  (c) Hình ảnh và video khui hộp do Người mua/Người bán tải lên trong quy trình tranh chấp (có thể chứa hình ảnh khuôn mặt, giọng nói, không gian nhà riêng hoặc vô tình ghi hình người thứ ba).

Điều 3. Nguyên tắc giảm thiểu dữ liệu và Bảo vệ dữ liệu bên thứ ba
- Bảo vệ mã vận đơn và dữ liệu người mua trên sàn nguồn: REBOXE tuyệt đối không sử dụng mã vận đơn đơn hàng gốc làm mã định danh sản phẩm công khai. Mã vận đơn chỉ được mã hóa ở tầng ứng dụng để chống nhập trùng lặp trong cùng gian hàng. Khi Người bán nhập bản kê (CSV/Excel) hoặc sử dụng tính năng kết nối nguồn hàng, hệ thống áp dụng bộ lọc chỉ giữ thông tin mô tả sản phẩm và kiện hàng, loại bỏ tên, số điện thoại và địa chỉ của người mua gốc từ sàn khác.
- Tự giới hạn tích hợp nguồn hàng: REBOXE không chạy đồng bộ nền sao chép toàn bộ cơ sở dữ liệu đơn hàng của gian hàng trên sàn khác; hệ thống chỉ đọc danh sách tối thiểu trong phạm vi do Người bán chủ động lựa chọn để xem trước và lập bản nháp. Khi Người bán ngắt kết nối, mã truy cập được thu hồi và dữ liệu khám phá tạm thời bị xóa trong vòng 24 giờ.

Điều 4. Mục đích, Căn cứ xử lý tách bạch và Quy định về Video khui hộp
- Mỗi mục đích xử lý dữ liệu có căn cứ rõ ràng và được ghi nhận tách bạch; sự im lặng hoặc không phản hồi không được coi là đồng ý, và REBOXE không gộp chung đồng ý giao dịch/khiếu nại với đồng ý quảng cáo hay huấn luyện mô hình AI:
  (1) Thiết lập tài khoản, thực hiện giao kết hợp đồng mua bán, giao nhận vận chuyển và hỗ trợ khách hàng;
  (2) Xác thực danh tính Người bán (eKYC), phòng chống gian lận, rửa tiền và bảo vệ an toàn hệ thống;
  (3) Thụ lý, xác minh và giải quyết tranh chấp/khiếu nại phát sinh;
  (4) Thực hiện nghĩa vụ pháp luật về lưu trữ chứng từ giao dịch TMĐT, kế toán, thuế và cung cấp thông tin theo yêu cầu hợp pháp của cơ quan nhà nước có thẩm quyền.
- Thông báo và đồng ý riêng cho dữ liệu bằng chứng tranh chấp: Trước khi mở giao diện chọn tệp hoặc quay video/ảnh bằng chứng (tối đa 90 giây, dung lượng tối đa 20 MiB), REBOXE hiển thị Thông báo xử lý dữ liệu (/legal/processing-notice) và ghi nhận bản ghi đồng ý theo từng hồ sơ (processing_records) kèm dấu vết thời gian và phiên bản. Người dùng có quyền từ chối cung cấp video mà không bị mất quyền gửi khiếu nại.
- Tách bản gốc và bản dẫn xuất đã khử nhận dạng: Video/ảnh gốc được lưu trữ trong phân vùng bảo mật riêng biệt, chỉ quản trị viên có thẩm quyền xác thực đa yếu tố (MFA/AAL2) mới được truy cập và mọi lượt xem đều ghi nhật ký kiểm toán. REBOXE không chuyển giao video gốc cho Người bán xem; Người bán chỉ nhận được tóm tắt vụ việc và khung hình dẫn xuất đã làm mờ/che thông tin nhận dạng khuôn mặt.
- Minh bạch về công cụ phân tích tự động (AI): Mọi tính năng phân tích hình ảnh hỗ trợ kiểm duyệt (nếu được kích hoạt) chỉ tạo tóm tắt tham khảo phục vụ nhân sự quản trị xem xét; REBOXE không sử dụng AI để tự động từ chối khiếu nại hoặc tự động trích hoàn tiền, và không dùng video khiếu nại của Người dùng để huấn luyện mô hình AI khi chưa có sự đồng ý riêng rẽ, tự nguyện mặc định tắt. Người dùng có quyền yêu cầu con người xem xét lại và quyền phản đối xử lý tự động.

Điều 5. Chia sẻ dữ liệu và Chuyển dữ liệu cá nhân qua hạ tầng đám mây
- REBOXE không bán, cho thuê dữ liệu cá nhân của Người dùng cho bên thứ ba. Dữ liệu chỉ được chia sẻ trong phạm vi tối thiểu cần thiết cho: (a) Bên mua/bên bán đối ứng để thực hiện giao hàng hoặc giải quyết khiếu nại theo bản dẫn xuất; (b) Đơn vị vận chuyển để giao nhận bưu kiện; (c) Nhà cung cấp dịch vụ eKYC, lưu trữ bằng chứng bảo mật, ngân hàng/đối tác thanh toán được cấp phép theo thỏa thuận xử lý dữ liệu ràng buộc; (d) Cơ quan nhà nước có thẩm quyền theo trình tự pháp luật.
- Trường hợp hệ thống sử dụng hạ tầng máy chủ hoặc nhà cung cấp dịch vụ đặt tại nước ngoài (ví dụ cụm máy chủ đám mây tại Singapore), REBOXE thực hiện lập Hồ sơ đánh giá tác động xử lý dữ liệu cá nhân và Hồ sơ đánh giá tác động chuyển dữ liệu cá nhân ra nước ngoài theo Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP trước khi đưa dữ liệu cá nhân thật vào vận hành.

Điều 6. Thời hạn lưu trữ phân tầng và Biện pháp bảo mật
- Hồ sơ đơn hàng, đối soát tài chính, chứng từ hóa đơn và nhật ký kiểm toán (audit_logs): lưu trữ tối thiểu theo thời hạn của pháp luật kế toán, thuế, TMĐT và thời hiệu khởi kiện dân sự (03 năm theo Bộ luật Dân sự 2015).
- Bằng chứng tranh chấp: Bản gốc video/ảnh có mục tiêu lưu trữ là 90 ngày kể từ ngày đóng vụ việc cuối cùng (final_closed_at); khung hình đã khử nhận dạng, tóm tắt kỹ thuật và biên bản phân xử có mục tiêu lưu trữ 03 năm kể từ mốc đóng vụ việc. Thời điểm xóa vật lý thực tế không sớm hơn thời hạn khóa bảo toàn bắt buộc (Object Lock / Legal Hold) nếu vụ việc đang kháng nghị, tranh chấp pháp lý hoặc có yêu cầu của cơ quan nhà nước.
- Biện pháp kỹ thuật: Mã hóa dữ liệu nhạy cảm khi lưu trữ và truyền tải (HTTPS/TLS), kiểm soát truy cập tối thiểu theo vai trò, bắt buộc xác thực hai yếu tố (MFA/AAL2) đối với tài khoản vận hành nội bộ, và lưu nhật ký truy cập bất biến.

Điều 7. Quyền của Chủ thể dữ liệu và Cách thức thực thi
- Người dùng có đầy đủ các quyền theo Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15: quyền được biết; quyền đồng ý hoặc rút lại sự đồng ý; quyền truy cập/xem/xuất bản sao dữ liệu cá nhân; quyền yêu cầu chỉnh sửa, cập nhật; quyền yêu cầu xóa dữ liệu; quyền hạn chế xử lý; quyền phản đối xử lý (bao gồm phản đối quyết định tự động); quyền khiếu nại, tố cáo hoặc khởi kiện theo quy định pháp luật.
- Thực thi trực tuyến: Truy cập Tài khoản → Quyền riêng tư (/account/privacy) để yêu cầu xuất dữ liệu cá nhân, yêu cầu ẩn danh/xóa dữ liệu hoặc quản lý tùy chọn thông báo tiếp thị (Email/SMS/Zalo trong /account/notifications). Yêu cầu nhạy cảm được bảo vệ bằng bước xác thực tăng cường và cấp biên nhận xử lý theo từng hạng mục (nêu rõ dữ liệu đã xóa/ẩn danh, phần buộc phải giữ lại theo nghĩa vụ pháp luật hoặc legal hold, và độ trễ làm sạch bản sao lưu).

Điều 8. Thông báo vi phạm dữ liệu và Cập nhật Chính sách
- Khi xảy ra sự cố an toàn thông tin làm ảnh hưởng dữ liệu cá nhân, REBOXE kích hoạt quy trình ứng cứu sự cố, giảm thiểu thiệt hại và thông báo tới cơ quan chuyên trách bảo vệ dữ liệu cá nhân cùng Chủ thể dữ liệu bị ảnh hưởng đúng thời hạn theo quy định của Luật 91/2025/QH15 và Nghị định 356/2025/NĐ-CP.
- Mọi thay đổi của Chính sách này được công khai phiên bản mới và ngày hiệu lực trên nền tảng.$privacy$
    ),
    (
      'dispute-process',
      '2026-11-18',
      'Quy trình tiếp nhận & Giải quyết tranh chấp REBOXE',
      $dispute$MIỄN TRỪ VÀ NGUYÊN TẮC BẢO VỆ QUYỀN LỢI NGƯỜI TIÊU DÙNG: Quy trình này công khai cơ chế tiếp nhận, thẩm định và giải quyết khiếu nại phát sinh từ giao dịch trên REBOXE theo Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15, Nghị định 55/2024/NĐ-CP, Luật Thương mại điện tử 122/2025/QH15 và Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15. Trong giai đoạn thử nghiệm kỹ thuật (sandbox), mọi khoản hoàn trả và xử lý đều là dữ liệu mô phỏng.

Điều 1. Nguyên tắc chung — Không làm mất quyền khiếu nại và khởi kiện
- Video khui hộp là chứng cứ ưu tiên ("ĐIỀU KIỆN ĐỂ XỬ LÝ NHANH"), KHÔNG PHẢI điều kiện bắt buộc để tiếp nhận khiếu nại: REBOXE tiếp nhận và thụ lý khiếu nại cho mọi đơn hàng đủ điều kiện (trạng thái Đã giao hoặc Hoàn thành) kể cả khi Người mua không có video khui hộp hoặc gửi yêu cầu qua kênh CSKH sau mốc xử lý nhanh. Khi không có video, hồ sơ sẽ được kiểm duyệt viên xem xét thủ công dựa trên dữ liệu vận chuyển, hình ảnh trạng thái bao bì và giải trình của các bên nên thời gian xử lý có thể kéo dài hơn.
- Bảo toàn quyền theo pháp luật (Điều 25 Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15): Quyết định giải quyết tranh chấp của REBOXE là quyết định cuối cùng trong phạm vi quy trình nội bộ trên nền tảng, không loại trừ hay hạn chế quyền của Người mua và Người bán được bảo hành theo quy định, tự thương lượng, hòa giải, yêu cầu Trọng tài, khiếu nại tới cơ quan quản lý nhà nước hoặc khởi kiện ra Tòa án nhân dân có thẩm quyền.

Điều 2. Phạm vi và Các trường hợp tiếp nhận khiếu nại
- REBOXE tiếp nhận khiếu nại của Người mua đối với các trường hợp:
  (1) Giao sai kiện hàng hoặc sai sản phẩm so với đơn hàng đã đặt;
  (2) Trạng thái niêm phong/bao bì bên ngoài (SealStatus) bị rách, mở trước hoặc hư hỏng nghiêm trọng không khớp với thông tin đã công bố trên tin đăng;
  (3) Sản phẩm đã mở (SELLER_DECLARED) không đúng tình trạng công bố (sai phân loại NEW_SEALED / LIKE_NEW_99 / GOOD / FAIR / DEFECT), thiếu phụ kiện hoặc phát sinh lỗi chức năng không được khai báo trước;
  (4) Kiện hàng nguyên kiện chưa mở (UNOPENED_UNINSPECTED) có dấu hiệu hàng giả, hàng thuộc danh mục cấm kinh doanh hoặc thiếu hụt/hư hỏng nghiêm trọng bất thường có căn cứ xác minh hợp lý;
  (5) Lỗi từ phía Người bán hoặc đơn vị vận chuyển trong quá trình lấy/giao hàng làm đơn thất lạc hoặc giao không thành công sau khi đã xác nhận thanh toán.
- Lưu ý đối với kiện hàng chưa mở kiểm tra (UNOPENED_UNINSPECTED): Trên trang sản phẩm và trước khi thanh toán, REBOXE đã công bố rõ đây là kiện hoàn nguyên kiện chưa mở kiểm đếm chi tiết; thông tin bản kê chỉ là dữ liệu tham khảo từ đơn gốc. Tuy nhiên, việc công bố này không miễn trừ trách nhiệm của Người bán và sàn đối với hàng giả, hàng cấm, giao nhầm kiện, sai trạng thái seal niêm phong bên ngoài hoặc sản phẩm không bảo đảm an toàn cho người tiêu dùng.

Điều 3. Thời hạn tiếp nhận khiếu nại và Hướng dẫn bằng chứng
- Thời hạn xử lý nhanh nội bộ: Người mua nên gửi khiếu nại trong vòng 03 ngày kể từ khi nhận hàng (và trước mốc tự động tất toán phiên giao dịch trên hệ thống). Hệ thống vẫn cho phép mở khiếu nại trực tuyến trên đơn hàng ở trạng thái Đã giao / Hoàn thành; trường hợp mở sau 07 ngày kể từ lúc hoàn tất giao hàng sẽ được gắn cờ kiểm tra bổ sung (LATE_CLAIM) để đối chiếu kỹ hơn chứ không từ chối tiếp nhận. Người mua cũng luôn có thể gửi yêu cầu qua kênh Hỗ trợ (/support).
- Chuẩn bằng chứng ưu tiên (không bắt buộc): Video quay liên tục tối đa 90 giây (dung lượng mỗi tệp không vượt quá 20 MiB; hỗ trợ JPEG, PNG, WebP, MP4, WebM, QuickTime), quay rõ 06 mặt kiện hàng, tem mã vận đơn và trạng thái niêm phong trong những giây đầu tiên trước khi rạch mở hộp.
- Bảo vệ dữ liệu riêng tư trong bằng chứng: Người quay cần tránh để lộ khuôn mặt người thân, trẻ em, giấy tờ tùy thân hoặc thông tin cá nhân không liên quan. Trước khi tải tệp lên, hệ thống hiển thị Thông báo xử lý dữ liệu (/legal/processing-notice) và chỉ ghi nhận tải tệp sau khi Người dùng chủ động xác nhận đồng ý theo đúng vụ việc đó. Người mua không muốn tải video vẫn gửi được khiếu nại bằng lý do và mô tả văn bản.

Điều 4. Quy trình tiếp nhận và giải quyết tranh chấp 06 bước
- Bước 1 — Gửi khiếu nại và Khóa tạm đối soát: Người mua chọn đơn hàng tại Tài khoản → Đơn mua (/account/orders), nhập lý do tối thiểu 10 ký tự (và đính kèm bằng chứng nếu có) hoặc gửi yêu cầu tại trang Hỗ trợ (/support). Hệ thống tạo mã hồ sơ duy nhất (RBX-CASE-...), tự động khóa tạm phần tiền/bảo đảm liên quan để ngăn tất toán sớm và gửi thông báo tới Người bán.
- Bước 2 — Phản hồi của Người bán (thời hạn 24 giờ): Người bán nhận thông báo qua trang Khiếu nại / Hoàn trả (/seller/returns) để xem lý do và giải trình. Để bảo vệ dữ liệu cá nhân theo Luật 91/2025/QH15, Người bán không được xem video gốc của Người mua mà chỉ xem tóm tắt vụ việc cùng bản dẫn xuất khung hình đã khử/che thông tin nhận dạng khuôn mặt (DERIVATIVE). Người bán có thể gửi phản hồi văn bản và tải lên bằng chứng đóng gói/bàn giao trước đó.
- Bước 3 — Thẩm định của Quản trị viên có xác thực MFA: Nhân sự kiểm duyệt đã xác thực hai yếu tố (MFA/AAL2) rà soát hồ sơ đơn hàng, trạng thái niêm phong đã công bố, đối chiếu lịch sử vận chuyển và bằng chứng của hai bên. Mọi lượt truy cập bản gốc (nếu cần xác minh trực tiếp) đều được ghi nhật ký kiểm toán. Trường hợp có sử dụng công cụ hỗ trợ phân tích khung hình, kết quả chỉ mang tính tham khảo kỹ thuật — quyết định giải quyết luôn do con người trực tiếp ban hành.
- Bước 4 — Ban hành Quyết định và Lý do rõ ràng: Kiểm duyệt viên quyết định chấp nhận hoàn tiền cho Người mua (toàn phần hoặc theo mức thỏa thuận) hoặc công nhận Người bán, kèm lý do giải trình rõ ràng tối thiểu 30 ký tự gửi đồng thời cho cả hai bên.
- Bước 5 — Quyền Kháng nghị trong 07 ngày: Nếu không đồng ý với quyết định vòng đầu ở trạng thái chờ kháng nghị (RESOLVED_APPEAL_WINDOW), Người mua có quyền gửi Kháng nghị trực tiếp trong vòng 07 ngày kể từ thời điểm ban hành quyết định kèm lý do giải trình và bằng chứng bổ sung. Trong suốt cửa sổ kháng nghị 07 ngày và quá trình xử lý kháng nghị, khoản tiền/đối soát liên quan tiếp tục được giữ nguyên trạng thái tạm khóa.
- Bước 6 — Thực thi hoàn tiền / Tất toán và Lưu trữ bảo toàn: Khi hết hạn kháng nghị hoặc sau quyết định vòng cuối, hệ thống/đối tác thanh toán thực hiện hoàn tiền cho Người mua hoặc giải tỏa tất toán cho Người bán theo đúng hợp đồng cung ứng dịch vụ thanh toán, rồi đóng hồ sơ chính thức (final_closed_at). Hồ sơ được áp dụng chính sách lưu trữ phân tầng (90 ngày với video gốc và 03 năm với bản dẫn xuất/biên bản phân xử, tuân thủ Legal Hold nếu có khiếu kiện).

Điều 5. Hỗ trợ khách hàng và Cơ chế giải quyết ngoài nền tảng
- Mọi vướng mắc về đơn hàng, chậm phản hồi hoặc yêu cầu xem xét lại hồ sơ có thể gửi trực tuyến tại mục Hỗ trợ (/support) kèm mã đơn hàng hoặc mã khiếu nại.
- Trong trường hợp các bên không đạt được đồng thuận thông qua quy trình giải quyết của REBOXE, tranh chấp được giải quyết thông qua thương lượng, hòa giải, Tổ chức xã hội tham gia bảo vệ quyền lợi người tiêu dùng, Trọng tài thương mại hoặc Tòa án nhân dân có thẩm quyền theo quy định của pháp luật Việt Nam.$dispute$
    )
)
INSERT INTO legal_artifacts(slug, version, title, body, body_hash, effective_at)
SELECT slug, version, title, body, encode(digest(body, 'sha256'), 'hex'), now()
FROM docs
ON CONFLICT (slug, version) DO NOTHING;
