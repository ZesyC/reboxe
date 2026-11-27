-- Synthetic fixtures only. Password login is intentionally not seeded here;
-- E2E tests create disposable users through Supabase Auth.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'verified-seller@reboxe.test',
    crypt('Synthetic-Test-Password-123!', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'pending-seller@reboxe.test',
    crypt('Synthetic-Test-Password-123!', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'moderator@reboxe.test',
    crypt('Synthetic-Test-Password-123!', gen_salt('bf')), now(),
    '', '', '', '',
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  )
ON CONFLICT (id) DO UPDATE
SET encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = EXCLUDED.email_confirmed_at,
    confirmation_token = '', recovery_token = '',
    email_change_token_new = '', email_change = '',
    updated_at = now();

INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '{"sub":"10000000-0000-4000-8000-000000000001","email":"verified-seller@reboxe.test","email_verified":true}',
    'email', now(), now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '{"sub":"10000000-0000-4000-8000-000000000002","email":"pending-seller@reboxe.test","email_verified":true}',
    'email', now(), now(), now()
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '{"sub":"10000000-0000-4000-8000-000000000003","email":"moderator@reboxe.test","email_verified":true}',
    'email', now(), now(), now()
  )
ON CONFLICT (provider_id, provider) DO NOTHING;

INSERT INTO profiles (id, status)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000002', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000003', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Local/test only. Staff still must enroll and verify TOTP to obtain AAL2.
INSERT INTO platform_staff_roles (user_id, role, status)
VALUES
  ('10000000-0000-4000-8000-000000000003', 'MODERATOR', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000003', 'DISPUTE_ARBITRATOR', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000003', 'SUPPORT', 'ACTIVE')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO categories (id, name, active, sort_order)
VALUES
  ('fashion', 'Thời trang', true, 10),
  ('electronics', 'Điện tử đã qua sử dụng', true, 20),
  ('home', 'Nhà cửa và đời sống', true, 30),
  ('accessories', 'Phụ kiện', true, 40),
  ('lifestyle', 'Tiện ích đời sống', true, 50),
  ('beauty', 'Mỹ phẩm và chăm sóc cá nhân', true, 60),
  ('cosmetics', 'Mỹ phẩm', true, 70),
  ('supplements', 'Thực phẩm chức năng', true, 80),
  ('packaged-food', 'Thực phẩm bao gói sẵn', true, 90),
  ('infant-nutrition', 'Dinh dưỡng cho trẻ dưới 24 tháng', true, 100),
  ('medical-devices', 'Trang thiết bị y tế', true, 110),
  ('childrens-toys', 'Đồ chơi trẻ em', true, 120),
  ('regulated-electronics', 'Thiết bị điện cần chứng nhận hợp quy', true, 130),
  ('motorcycle-helmets', 'Mũ bảo hiểm mô tô, xe máy', true, 140),
  ('luxury-goods', 'Hàng hiệu và thương hiệu cao cấp', true, 150),
  ('alcohol', 'Rượu và đồ uống có cồn', true, 160),
  ('jewelry-gemstones', 'Vàng trang sức và đá quý', true, 170),
  ('publications', 'Sách và ấn phẩm', true, 180),
  ('used-electronics', 'Đồ điện tử đã qua sử dụng', true, 190),
  ('tried-fashion', 'Quần áo, giày dép đã thử', true, 200),
  ('missing-accessories', 'Hàng thiếu phụ kiện hoặc hộp', true, 210),
  ('cosmetic-defect', 'Hàng lỗi ngoại hình', true, 220),
  ('near-expiry', 'Hàng cận hạn sử dụng', true, 230),
  ('banned-drugs', 'Ma túy và tiền chất', true, 1000),
  ('banned-wildlife', 'Mẫu vật động thực vật hoang dã nguy cấp', true, 1010),
  ('banned-human-body', 'Mô và bộ phận cơ thể người', true, 1020),
  ('banned-weapons-explosives', 'Vũ khí, pháo và vật liệu nổ', true, 1030),
  ('banned-illegal-content', 'Văn hóa phẩm bất hợp pháp', true, 1040),
  ('banned-medicines', 'Thuốc chữa bệnh', true, 1050),
  ('banned-tobacco-vape', 'Thuốc lá và thuốc lá điện tử', true, 1060),
  ('banned-counterfeit-illicit', 'Hàng giả, nhập lậu hoặc không rõ nguồn gốc', true, 1070),
  ('banned-financial-identity', 'Tiền tệ, tài khoản và giấy tờ định danh', true, 1080),
  ('banned-spyware-jammers', 'Thiết bị gián điệp hoặc phá sóng', true, 1090),
  ('banned-live-animals-hazardous', 'Động vật sống và chất nguy hại', true, 1100),
  ('banned-cold-chain-hazardous', 'Hàng cần chuỗi lạnh hoặc dễ cháy nổ', true, 1110),
  ('banned-expired-products', 'Sản phẩm đã quá hạn sử dụng', true, 1120)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO restricted_categories (
  id, category_id, policy_level, rule_snapshot, policy_version,
  effective_from, effective_to, approved_by
)
SELECT
  'RP-' || category_id || '-20260825', category_id, policy_level, rule_snapshot,
  '2026-08-25-dev', '2026-08-25T00:00:00+07'::timestamptz, NULL,
  '10000000-0000-4000-8000-000000000001'::uuid
FROM (VALUES
  ('fashion', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('electronics', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('used-electronics', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('tried-fashion', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('missing-accessories', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('cosmetic-defect', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('near-expiry', 'DISCLOSURE', '{"requiredFields":["conditionGrade","conditionNotes"],"minimumConditionNotesLength":20,"source":"docs/06-DANH-MUC-HANG-CAM.md#4"}'::jsonb),
  ('beauty', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh nhãn, số công bố và hạn sử dụng"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('cosmetics', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh nhãn, số công bố và hạn sử dụng"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('supplements', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh bản công bố và hạn sử dụng"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('packaged-food', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh nhãn và hạn sử dụng"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('infant-nutrition', 'MANUAL_REVIEW', '{"legalDecisionPending":true,"source":"docs/06-DANH-MUC-HANG-CAM.md#8"}'::jsonb),
  ('medical-devices', 'MANUAL_REVIEW', '{"legalDecisionPending":true,"requiredEvidence":["Phân loại thiết bị và giấy tờ phù hợp"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('childrens-toys', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh dấu hợp quy CR"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('regulated-electronics', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh dấu hợp quy CR"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('motorcycle-helmets', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh dấu hợp quy CR"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('luxury-goods', 'MANUAL_REVIEW', '{"requiredEvidence":["Ảnh tem, mã, hộp hoặc phiếu bảo hành"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('alcohol', 'MANUAL_REVIEW', '{"legalDecisionPending":true,"source":"docs/06-DANH-MUC-HANG-CAM.md#8"}'::jsonb),
  ('jewelry-gemstones', 'MANUAL_REVIEW', '{"requiredEvidence":["Giấy tờ nguồn gốc và điều kiện kinh doanh"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('publications', 'MANUAL_REVIEW', '{"requiredEvidence":["Thông tin nhà xuất bản và nguồn gốc"],"source":"docs/06-DANH-MUC-HANG-CAM.md#3"}'::jsonb),
  ('banned-drugs', 'BANNED', '{"reason":"Ma túy và tiền chất","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-wildlife', 'BANNED', '{"reason":"Mẫu vật động thực vật hoang dã nguy cấp","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-human-body', 'BANNED', '{"reason":"Mô và bộ phận cơ thể người","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-weapons-explosives', 'BANNED', '{"reason":"Vũ khí, pháo và vật liệu nổ","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-illegal-content', 'BANNED', '{"reason":"Văn hóa phẩm bất hợp pháp","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-medicines', 'BANNED', '{"reason":"Thuốc chữa bệnh không phù hợp mô hình REBOXE","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-tobacco-vape', 'BANNED', '{"reason":"Thuốc lá và thuốc lá điện tử","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-counterfeit-illicit', 'BANNED', '{"reason":"Hàng giả, nhập lậu hoặc không rõ nguồn gốc","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-financial-identity', 'BANNED', '{"reason":"Tiền tệ, tài khoản và giấy tờ định danh","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-spyware-jammers', 'BANNED', '{"reason":"Thiết bị gián điệp hoặc phá sóng","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-live-animals-hazardous', 'BANNED', '{"reason":"Động vật sống hoặc chất nguy hại","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-cold-chain-hazardous', 'BANNED', '{"reason":"Không đáp ứng chuỗi lạnh hoặc vận chuyển an toàn","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb),
  ('banned-expired-products', 'BANNED', '{"reason":"Sản phẩm đã quá hạn sử dụng","source":"docs/06-DANH-MUC-HANG-CAM.md#2"}'::jsonb)
) AS policy(category_id, policy_level, rule_snapshot)
ON CONFLICT (category_id, policy_version) DO UPDATE SET
  policy_level = EXCLUDED.policy_level,
  rule_snapshot = EXCLUDED.rule_snapshot,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  approved_by = EXCLUDED.approved_by;

INSERT INTO shops (id, display_name, legal_type, kyc_status, kyc_verified_at, status)
VALUES
  ('RBX-01JTESTVERIFIED0000000000', 'REBOXE Shop', 'INDIVIDUAL', 'VERIFIED', now(), 'ACTIVE'),
  ('RBX-01JTESTPENDING00000000000', 'REBOXE Pending Fixture', 'INDIVIDUAL', 'PENDING', NULL, 'ONBOARDING')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  legal_type = EXCLUDED.legal_type,
  kyc_status = EXCLUDED.kyc_status,
  kyc_verified_at = EXCLUDED.kyc_verified_at,
  status = EXCLUDED.status;

-- Catalog data is persisted in PostgreSQL and consumed by the storefront API.
INSERT INTO listings (
  id, shop_id, title, description, category_id, condition_grade,
  condition_notes, price, weight_gram, images, price_source, status, published_at
)
VALUES
  ('RBX-01JTESTCATALOG-TECH-001', 'RBX-01JTESTVERIFIED0000000000',
   'Tai nghe Bluetooth chống ồn',
   E'[CHI TIẾT]\nKết nối: Bluetooth không dây\nTính năng: Chống ồn chủ động (ANC)\nChất liệu: Nhựa ABS + Đệm tai da PU êm ái\nXuất xứ: Trung Quốc\nMàu sắc: Đen / Trắng (theo kiện)\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Tai nghe Bluetooth chống ồn\n\n1. THIẾT KẾ & TÍNH NĂNG:\n- Chụp tai êm ái ôm sát vành tai, hỗ trợ giảm tạp âm môi trường khi làm việc hoặc di chuyển\n- Micro đàm thoại tích hợp tiện lợi cho học online và họp trực tuyến\n\n2. KẾT NỐI & SỬ DỤNG:\n- Kết nối Bluetooth ổn định với điện thoại, tablet và laptop\n- Có thể gập gọn mang theo trong túi xách hoặc balo\n\n3. BẢO QUẢN:\n- Bảo quản nơi khô ráo, tránh làm rơi va đập mạnh và sạc bằng nguồn 5V ổn định\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Kiện hoàn nguyên trạng, hộp có vết móp nhẹ ở góc; chưa mở kiểm tra nội dung bên trong.',
   'electronics', 'LIKE_NEW_99', 'Hộp có vết móp nhẹ ở góc, chưa mở kiểm tra nội dung', 299000, 320, '[{"key":"demo-products/headphones.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '1 hour'),
  ('RBX-01JTESTCATALOG-TECH-002', 'RBX-01JTESTVERIFIED0000000000',
   'Đồng hồ thông minh pin 7 ngày',
   E'[CHI TIẾT]\nMàn hình: Cảm ứng màu hiển thị rõ nét\nThời lượng pin: Lên đến 7 ngày sử dụng\nChất liệu dây: Silicone mềm thoáng khí\nKhả năng kết nối: Bluetooth (iOS & Android)\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Đồng hồ thông minh pin 7 ngày\n\n1. TÍNH NĂNG CHÍNH:\n- Theo dõi bước chân, nhịp tim, giấc ngủ và nhận thông báo cuộc gọi/tin nhắn từ điện thoại\n- Pin tối ưu cho thời gian sử dụng lên tới 7 ngày tùy cường độ bật màn hình\n\n2. CHẤT LIỆU & THIẾT KẾ:\n- Dây đeo silicone nhẹ tay, không gây bí khi tập thể thao hoặc đeo cả ngày\n- Khung viền gọn nhẹ phù hợp cả nam và nữ\n\n3. HƯỚNG DẪN SỬ DỤNG:\n- Sạc bằng cáp từ tính đi kèm trong hộp theo nguồn USB 5V-1A\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Kiện hoàn nguyên trạng, vỏ hộp có vết xước nhỏ ở cạnh; chưa mở kiểm tra nội dung.',
   'electronics', 'GOOD', 'Vỏ hộp có vết xước nhỏ ở cạnh, chưa mở kiểm tra nội dung', 479000, 180, '[{"key":"demo-products/smartwatch.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '2 hours'),
  ('RBX-01JTESTCATALOG-HOME-001', 'RBX-01JTESTVERIFIED0000000000',
   'Máy hút bụi cầm tay',
   E'[CHI TIẾT]\nLoại máy: Máy hút bụi cầm tay không dây\nChất liệu: Nhựa ABS chịu lực\nPhạm vi dùng: Sofa, bàn làm việc, khe cửa, nội thất ô tô\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Máy hút bụi cầm tay\n\n1. THIẾT KẾ & CÔNG NĂNG:\n- Thiết kế cầm tay nhỏ gọn, dễ len lỏi vào các góc hẹp như bàn phím, kẽ ghế sofa và khoang xe\n- Hộp chứa bụi tháo lắp nhanh để đổ bụi và vệ sinh lưới lọc\n\n2. CHẤT LIỆU & HOÀN THIỆN:\n- Thân máy nhựa ABS cứng cáp, tay cầm chắc chắn hạn chế mỏi cổ tay\n\n3. HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:\n- Vệ sinh màng lọc khô ráo sau vài lần hút để duy trì lực hút ổn định\n- Không dùng máy để hút chất lỏng hoặc tàn lửa nóng\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Kiện hoàn nguyên trạng thiếu lớp nilon bọc ngoài nhưng hộp sản phẩm còn nguyên, chưa mở kiểm định bên trong.',
   'home', 'LIKE_NEW_99', 'Thiếu lớp nilon bọc ngoài, hộp sản phẩm còn nguyên', 549000, 2100, '[{"key":"demo-products/vacuum.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '3 hours'),
  ('RBX-01JTESTCATALOG-HOME-002', 'RBX-01JTESTVERIFIED0000000000',
   'Đèn bàn LED ba chế độ sáng',
   E'[CHI TIẾT]\nNguồn sáng: LED bảo vệ mắt 3 chế độ màu\nĐiều khiển: Nút cảm ứng điều chỉnh độ sáng\nChất liệu: Nhựa ABS + Hợp kim nhẹ\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Đèn bàn LED ba chế độ sáng\n\n1. TÍNH NĂNG NỔI BẬT:\n- Trang bị 3 chế độ ánh sáng (Trắng, Trung tính, Vàng ấm) phù hợp học tập, đọc sách và làm việc ban đêm\n- Ánh sáng LED ổn định, hạn chế nhấp nháy gây mỏi mắt\n\n2. THIẾT KẾ:\n- Cần đèn gập xoay linh hoạt điều chỉnh góc chiếu theo bàn học hoặc bàn làm việc\n- Chân đế vững chắc, gọn gàng không chiếm nhiều diện tích\n\n3. HƯỚNG DẪN SỬ DỤNG:\n- Đặt đèn trên bề mặt phẳng, tránh ẩm ướt gần khu vực nguồn điện\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Thùng ngoài có vết cấn nhỏ, sản phẩm nguyên kiện chưa mở kiểm tra nội dung.',
   'home', 'GOOD', 'Thùng ngoài có vết cấn nhỏ, chưa mở kiểm tra nội dung', 259000, 950, '[{"key":"demo-products/lamp.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '4 hours'),
  ('RBX-01JTESTCATALOG-FASHION-001', 'RBX-01JTESTVERIFIED0000000000',
   'Áo khoác nỉ form rộng',
   E'[CHI TIẾT]\nChất liệu: Vải nỉ cotton pha ấm áp\nPhong cách: Trẻ trung / Unisex / Streetwear\nKiểu dáng: Form rộng có mũ / khóa kéo\nMùa: Thu / Đông / Chống nắng\nXuất xứ: Việt Nam\n\n[MÔ TẢ]\nHƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo khoác nỉ form rộng\n\n- Form rộng unisex dễ mặc, phù hợp người từ 50kg - 72kg tùy chiều cao\n\nTHÔNG TIN SẢN PHẨM: Áo khoác nỉ form rộng\n\n1. KIỂU DÁNG:\n- Thiết kế form rộng thoải mái, dễ layer cùng áo thun hoặc sơ mi bên trong\n\n2. CHẤT LIỆU:\n- Vải nỉ dày vừa phải, giữ ấm tốt nhưng vẫn thoáng khí khi mặc cả ngày\n\n3. BẢO QUẢN:\n- Giặt máy ở chế độ nhẹ, lộn trái áo khi giặt và phơi nơi thoáng gió\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Kiện hoàn do khách đổi kích cỡ, bao bì ngoài còn nguyên chưa mở kiểm tra bên trong.',
   'fashion', 'LIKE_NEW_99', 'Bao bì ngoài còn nguyên, tem vận chuyển đã được che thông tin', 219000, 650, '[{"key":"demo-products/jacket.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '5 hours'),
  ('RBX-01JTESTCATALOG-FASHION-002', 'RBX-01JTESTVERIFIED0000000000',
   'Túi tote canvas nhiều ngăn',
   E'[CHI TIẾT]\nChất liệu: Vải Canvas dày bền bỉ\nKiểu dáng: Túi tote dáng đứng nhiều ngăn tiện dụng\nPhong cách: Tối giản / Đi học / Đi làm\nSức chứa: Đựng vừa laptop 14 inch, tài liệu A4\nXuất xứ: Việt Nam\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Túi tote canvas nhiều ngăn\n\n1. THIẾT KẾ & TIỆN ÍCH:\n- Chia nhiều ngăn phụ giúp sắp xếp gọn sổ tay, bình nước, ví tiền và phụ kiện cá nhân\n- Quai đeo vai bản vừa khâu gia cố chắc chắn, chịu lực tốt khi mang sách vở hoặc laptop\n\n2. CHẤT LIỆU:\n- Vải bố canvas dệt dày đứng form, ít bám bẩn và dễ giặt sạch\n\n3. BẢO QUẢN:\n- Giặt tay với nước lạnh và xà phòng dịu nhẹ, phơi tự nhiên tránh sấy nhiệt cao\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Kiện hoàn nguyên trạng, bao bì ngoài có vết bụi nhẹ ở đáy, chưa mở kiểm tra.',
   'fashion', 'GOOD', 'Bao bì ngoài có vết bụi nhẹ ở đáy, chưa mở kiểm tra', 119000, 380, '[{"key":"demo-products/tote.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '6 hours'),
  ('RBX-01JTESTCATALOG-BEAUTY-001', 'RBX-01JTESTVERIFIED0000000000',
   'Máy sấy tóc hai chiều',
   E'[CHI TIẾT]\nChế độ gió: Sấy nóng & sấy mát hai chiều\nChất liệu vỏ: Nhựa cách nhiệt cao cấp\nTính năng: Đầu tập trung gió giúp tạo kiểu gọn nhanh\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Máy sấy tóc hai chiều\n\n1. CÔNG NĂNG NỔI BẬT:\n- Hỗ trợ chuyển đổi linh hoạt giữa chế độ sấy nóng làm khô nhanh và gió mát bảo vệ sợi tóc\n- Luồng gió ổn định giúp giảm xơ rối và tiết kiệm thời gian sấy sau khi gội\n\n2. THIẾT KẾ:\n- Tay cầm vừa vặn dễ thao tác, có móc treo tiện lợi trong phòng tắm hoặc bàn trang điểm\n\n3. HƯỚNG DẪN AN TOÀN:\n- Giữ khoảng cách 15-20cm khi sấy tóc; không đặt máy đang hoạt động gần nước\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Vỏ hộp rách nhẹ ở mép nhưng seal chính vẫn còn nguyên, chưa mở kiểm tra máy bên trong.',
   'beauty', 'GOOD', 'Vỏ hộp rách nhẹ ở mép, seal chính vẫn còn nguyên', 329000, 780, '[{"key":"demo-products/hairdryer.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '7 hours'),
  ('RBX-01JTESTCATALOG-BEAUTY-002', 'RBX-01JTESTVERIFIED0000000000',
   'Bộ chăm sóc da dịu nhẹ',
   E'[CHI TIẾT]\nPhân loại: Bộ chăm sóc da cơ bản\nLoại da phù hợp: Mọi loại da, ưu tiên da nhạy cảm\nTình trạng seal: Nguyên seal nhà sản xuất\nXuất xứ: Hàn Quốc / Việt Nam (theo bao bì)\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Bộ chăm sóc da dịu nhẹ\n\n1. CÔNG DỤNG CHÍNH:\n- Hỗ trợ làm sạch nhẹ nhàng, cấp ẩm và làm dịu hàng rào bảo vệ da hàng ngày\n- Kết cấu mỏng nhẹ, không gây nhờn rít\n\n2. ĐÓNG GÓI & TÌNH TRẠNG:\n- Bộ sản phẩm nguyên seal từ đơn khách đặt nhầm, chưa mở nắp hay thử nghiệm\n\n3. LƯU Ý SỬ DỤNG:\n- Đọc kỹ bảng thành phần và hạn sử dụng in trên bao bì trước khi dùng; thử trước trên vùng da nhỏ nếu da quá nhạy cảm\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Seal kiện còn nguyên vẹn, hộp ngoài hơi móp ở một góc do vận chuyển hoàn.',
   'beauty', 'NEW_SEALED', 'Seal kiện còn nguyên, hộp ngoài hơi móp ở một góc', 189000, 620, '[{"key":"demo-products/skincare.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '8 hours'),
  ('RBX-01JTESTCATALOG-ACCESSORY-001', 'RBX-01JTESTVERIFIED0000000000',
   'Sạc nhanh GaN 65W',
   E'[CHI TIẾT]\nCông nghệ: Sạc nhanh GaN (Gallium Nitride)\nCông suất tối đa: 65W\nTương thích: Laptop USB-C, máy tính bảng, điện thoại hỗ trợ PD/QC\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Sạc nhanh GaN 65W\n\n1. HIỆU NĂNG & CÔNG NGHỆ:\n- Ứng dụng vật liệu bán dẫn GaN giúp thu nhỏ kích thước củ sạc nhưng vẫn đạt công suất tới 65W\n- Tối ưu nhiệt lượng và tốc độ sạc cho điện thoại, tablet và ultrabook hỗ trợ chuẩn PD\n\n2. THIẾT KẾ:\n- Kích thước gọn nhẹ dễ bỏ túi mang đi công tác hoặc đi học\n\n3. HƯỚNG DẪN SỬ DỤNG:\n- Nên kết hợp cùng cáp sạc chuẩn 65W/100W có chip E-Marker để đạt công suất tối đa\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Hộp ngoài không còn lớp seal nilon ngoài nhưng sản phẩm bên trong chưa mở kiểm tra.',
   'accessories', 'LIKE_NEW_99', 'Hộp ngoài không còn seal, chưa mở kiểm tra sản phẩm', 429000, 210, '[{"key":"demo-products/charger.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '9 hours'),
  ('RBX-01JTESTCATALOG-ACCESSORY-002', 'RBX-01JTESTVERIFIED0000000000',
   'Cáp sạc bọc dù 100W',
   E'[CHI TIẾT]\nChuẩn công suất: Hỗ trợ sạc nhanh tối đa 100W\nChất liệu vỏ: Sợi dù bện chống rối, chống gãy gập\nChức năng: Sạc nhanh & truyền dữ liệu ổn định\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Cáp sạc bọc dù 100W\n\n1. ĐẶC ĐIỂM NỔI BẬT:\n- Hỗ trợ truyền tải công suất cao lên đến 100W, đáp ứng nhu cầu sạc nhanh cho laptop, tablet và smartphone\n- Lớp vỏ bện dù mật độ cao chống xoắn rối và bảo vệ lõi đồng bên trong\n\n2. ĐỘ BỀN:\n- Cổ cáp gia cố chống đứt gãy khi uốn cong nhiều lần\n\n3. BẢO QUẢN:\n- Cuộn tròn nhẹ nhàng khi cất giữ, tránh kéo giật mạnh vào phần đầu cắm\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Bao bì ngoài có nếp gấp nhẹ, chưa mở kiểm tra nội dung bên trong.',
   'accessories', 'GOOD', 'Bao bì ngoài có nếp gấp nhẹ, chưa mở kiểm tra nội dung', 89000, 90, '[{"key":"demo-products/cable.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '10 hours'),
  ('RBX-01JTESTCATALOG-LIFESTYLE-001', 'RBX-01JTESTVERIFIED0000000000',
   'Quạt mini cầm tay',
   E'[CHI TIẾT]\nLoại sản phẩm: Quạt mini cầm tay sạc pin tiện lợi\nChất liệu: Nhựa ABS nhẹ bền\nCông dụng: Làm mát cá nhân khi đi học, đi làm, du lịch\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Quạt mini cầm tay\n\n1. THIẾT KẾ & TIỆN ÍCH:\n- Kích thước nhỏ gọn dễ cầm tay hoặc đặt bàn học, bàn làm việc\n- Nhiều mức gió tùy chỉnh linh hoạt theo nhu cầu sử dụng\n\n2. PIN & SẠC:\n- Sạc lại tiện lợi qua cổng USB (sạc dự phòng, laptop hoặc củ sạc 5V)\n\n3. BẢO QUẢN:\n- Tránh để vật lạ rơi vào lồng quạt khi cánh đang quay; vệ sinh bụi bám định kỳ\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Kiện hoàn nguyên trạng, vỏ hộp có vết xước nhẹ gần cạnh dưới, chưa mở kiểm tra thiết bị bên trong.',
   'lifestyle', 'GOOD', 'Vỏ hộp có vết xước nhẹ gần cạnh dưới', 139000, 260, '[{"key":"demo-products/fan.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '11 hours')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  condition_grade = EXCLUDED.condition_grade,
  condition_notes = EXCLUDED.condition_notes,
  price = EXCLUDED.price,
  weight_gram = EXCLUDED.weight_gram,
  images = EXCLUDED.images,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at;

INSERT INTO shop_memberships (user_id, shop_id, role, status)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'RBX-01JTESTVERIFIED0000000000', 'OWNER', 'ACTIVE'),
  ('10000000-0000-4000-8000-000000000002', 'RBX-01JTESTPENDING00000000000', 'OWNER', 'ACTIVE')
ON CONFLICT (user_id, shop_id) DO NOTHING;

INSERT INTO listings (
  id, shop_id, title, description, category_id, condition_grade,
  condition_notes, price, weight_gram, images, price_source, status, published_at
)
VALUES
  (
    'RBX-01JTESTPUBLICLISTING00000', 'RBX-01JTESTVERIFIED0000000000',
    'Áo khoác gió unisex chống nước',
    E'[CHI TIẾT]\nChất liệu: Vải dù Polyester trượt nước, chắn gió\nPhong cách: Năng động / Unisex / Ngoài trời\nKiểu dáng: Có mũ, khóa kéo toàn thân\nMùa: Quanh năm\nXuất xứ: Việt Nam\n\n[MÔ TẢ]\nHƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo khoác gió unisex chống nước\n\n- Form rộng dễ khoác ngoài nhiều lớp áo, phù hợp từ 48kg - 72kg\n\nTHÔNG TIN SẢN PHẨM: Áo khoác gió unisex chống nước\n\n1. KIỂU DÁNG & CÔNG NĂNG:\n- Áo khoác gió nhẹ, chắn gió bụi và chống thấm nước mưa phùn nhẹ\n- Mũ trùm có dây rút tiện lợi khi di chuyển ngoài trời\n\n2. CHẤT LIỆU:\n- Vải gió 2 lớp thoáng nhẹ, nhanh khô và dễ gấp gọn bỏ cốp xe hoặc balo\n\n3. BẢO QUẢN:\n- Giặt nước lạnh ở chế độ nhẹ, không ủi trực tiếp ở nhiệt độ cao\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Bao bì ngoài có vết cấn nhẹ, chưa mở kiểm tra nội dung bên trong.',
    'fashion', 'GOOD', 'Bao bì ngoài có vết cấn nhẹ, chưa mở kiểm tra nội dung', 120000, 500,
    '[{"key":"demo-products/jacket.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now()
  ),
  (
    'RBX-01JTESTDRAFTLISTING000000', 'RBX-01JTESTVERIFIED0000000000',
    'Listing nháp không công khai', NULL,
    'fashion', 'GOOD', 'Synthetic draft', 90000, 400,
    '[]'::jsonb, 'SELLER_DECLARED', 'DRAFT', NULL
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category_id = EXCLUDED.category_id,
  condition_grade = EXCLUDED.condition_grade,
  condition_notes = EXCLUDED.condition_notes,
  price = EXCLUDED.price,
  weight_gram = EXCLUDED.weight_gram,
  images = EXCLUDED.images,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at;
WITH seeded AS (
  INSERT INTO ledger_transactions(id,kind,reference_id,status)
  VALUES('RBX-LTX-SANDBOX-SEED','SANDBOX_BALANCE_SEED','RBX-01JTESTVERIFIED0000000000:DEFAULT','DRAFT')
  ON CONFLICT(kind,reference_id) DO NOTHING RETURNING id
)
INSERT INTO ledger_postings(id,transaction_id,account_key,amount_vnd)
SELECT 'RBX-LP-SANDBOX-SHOP',id,'shop:RBX-01JTESTVERIFIED0000000000:available',10000000 FROM seeded
UNION ALL SELECT 'RBX-LP-SANDBOX-CLEARING',id,'sandbox:clearing',-10000000 FROM seeded;

UPDATE ledger_transactions SET status='POSTED'
WHERE id='RBX-LTX-SANDBOX-SEED' AND status='DRAFT';
