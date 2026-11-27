-- Demo-only fixtures for reviewing seller finance and buyer order screens.
-- Auth users are created through the Supabase Admin API before this file runs.

INSERT INTO profiles (id, status)
SELECT id, 'ACTIVE' FROM auth.users
WHERE email IN ('zeycallisto@gmail.com', 'buyer-test@rebox.test')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

INSERT INTO shops (id, display_name, legal_type, kyc_status, kyc_verified_at, status)
VALUES ('RBX-DEMO-SHOP-2026', 'Kho Hoàn Giá Tốt', 'INDIVIDUAL', 'VERIFIED', now(), 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, kyc_status = EXCLUDED.kyc_status, status = EXCLUDED.status;

INSERT INTO shop_memberships (user_id, shop_id, role, status)
SELECT id, 'RBX-DEMO-SHOP-2026', 'OWNER', 'ACTIVE' FROM auth.users WHERE email = 'zeycallisto@gmail.com'
ON CONFLICT (user_id, shop_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

INSERT INTO categories (id, name, active, sort_order)
VALUES
  ('electronics', 'Điện tử', true, 10),
  ('fashion', 'Thời trang', true, 20),
  ('home', 'Nhà cửa và đời sống', true, 30),
  ('accessories', 'Phụ kiện', true, 40)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order;

INSERT INTO listings (
  id, shop_id, title, description, category_id, condition_grade,
  condition_notes, price, weight_gram, images, price_source, status, published_at
)
VALUES
  ('RBX-DEMO-PRODUCT-001', 'RBX-DEMO-SHOP-2026', 'Tai nghe Sony WH-1000XM4', 'Kiện hoàn test cho giao diện đối soát.', 'electronics', 'GOOD', 'Vỏ kiện có vết móp nhẹ, chưa mở kiểm tra nội dung.', 950000, 620, '[{"key":"demo-products/headphones.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'SOLD', now() - interval '5 days'),
  ('RBX-DEMO-PRODUCT-002', 'RBX-DEMO-SHOP-2026', 'Giày Jordan 4 Retro', 'Kiện hoàn test cho giao diện đối soát.', 'fashion', 'GOOD', 'Vỏ hộp có vết cấn nhẹ, chưa mở kiểm tra nội dung.', 850000, 1300, '[{"key":"demo-products/sneakers.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'SOLD', now() - interval '4 days'),
  ('RBX-DEMO-PRODUCT-003', 'RBX-DEMO-SHOP-2026', 'Váy satin dáng dài', 'Kiện hoàn test cho giao diện đối soát.', 'fashion', 'GOOD', 'Bao bì ngoài còn nguyên, chưa mở kiểm tra nội dung.', 225000, 480, '[{"key":"demo-products/dress.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'SOLD', now() - interval '3 days'),
  ('RBX-DEMO-PRODUCT-004', 'RBX-DEMO-SHOP-2026', 'Bàn phím cơ không dây', E'[CHI TIẾT]\nLoại bàn phím: Bàn phím cơ không dây\nKết nối: Đa chế độ không dây / Bluetooth\nChất liệu keycap: Nhựa ABS/PBT bền màu\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Bàn phím cơ không dây\n\n1. TRẢI NGHIỆM GÕ & THIẾT KẾ:\n- Hành trình phím cơ cho cảm giác gõ nảy tay, chính xác khi làm việc văn phòng hoặc chơi game\n- Kết nối không dây giúp góc bàn làm việc gọn gàng, tối giản dây cáp\n\n2. TƯƠNG THÍCH:\n- Dễ dàng kết nối với máy tính Windows, macOS, máy tính bảng và điện thoại\n\n3. BẢO QUẢN:\n- Tránh đổ nước trực tiếp lên bề mặt phím; vệ sinh khe phím định kỳ bằng chổi mềm\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Seal ngoài còn nguyên, chưa mở kiểm tra nội dung bên trong.', 'electronics', 'GOOD', 'Seal ngoài còn nguyên, chưa mở kiểm tra nội dung.', 690000, 980, '[{"key":"demo-products/keyboard.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '2 days'),
  ('RBX-DEMO-PRODUCT-005', 'RBX-DEMO-SHOP-2026', 'Đèn bàn LED chống cận', E'[CHI TIẾT]\nNguồn sáng: LED chống nhấp nháy bảo vệ mắt\nChất liệu: Nhựa ABS + Hợp kim sơn tĩnh điện\nPhù hợp: Bàn học, bàn đọc sách, bàn làm việc\nXuất xứ: Trung Quốc\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Đèn bàn LED chống cận\n\n1. TÍNH NĂNG CHIẾU SÁNG:\n- Ánh sáng đều, giảm chói lóa và hạn chế mỏi mắt khi đọc sách hoặc học tập lâu\n- Cổ đèn điều chỉnh linh hoạt hướng chiếu sáng theo nhu cầu\n\n2. THIẾT KẾ & BẢO QUẢN:\n- Kiểu dáng hiện đại, chân đế chắc chắn tiết kiệm không gian mặt bàn\n- Đặt nơi khô ráo, lau bụi bề mặt đèn bằng khăn khô mềm\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Thùng ngoài hơi móp, sản phẩm nguyên kiện chưa mở kiểm tra nội dung bên trong.', 'home', 'GOOD', 'Thùng ngoài hơi móp, chưa mở kiểm tra nội dung.', 320000, 1700, '[{"key":"demo-products/lamp.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now() - interval '1 day'),
  ('RBX-DEMO-PRODUCT-006', 'RBX-DEMO-SHOP-2026', 'Túi tote canvas nhiều ngăn', E'[CHI TIẾT]\nChất liệu: Vải Canvas dệt dày\nKiểu dáng: Túi tote nhiều ngăn tiện dụng\nSức chứa: Vừa laptop, tài liệu A4 và đồ dùng hàng ngày\nXuất xứ: Việt Nam\n\n[MÔ TẢ]\nTHÔNG TIN SẢN PHẨM: Túi tote canvas nhiều ngăn\n\n1. THIẾT KẾ & CÔNG NĂNG:\n- Bố trí nhiều ngăn giúp phân chia đồ cá nhân ngăn nắp, dễ tìm kiếm\n- Đường may đáy và quai túi chắc chắn chịu được tải trọng đồ dùng đi học, đi làm\n\n2. CHẤT LIỆU & BẢO QUẢN:\n- Vải canvas đứng form, dễ giặt tay bằng nước mát và phơi nơi thoáng gió\n\nLƯU Ý KIỆN HOÀN REBOXE:\n- Bao bì ngoài còn nguyên, chưa mở kiểm tra nội dung bên trong.', 'accessories', 'GOOD', 'Bao bì ngoài còn nguyên, chưa mở kiểm tra nội dung.', 180000, 350, '[{"key":"demo-products/tote.webp","width":1200,"height":900}]'::jsonb, 'SELLER_DECLARED', 'ACTIVE', now())
ON CONFLICT (id) DO UPDATE SET
  shop_id = EXCLUDED.shop_id, title = EXCLUDED.title, description = EXCLUDED.description,
  category_id = EXCLUDED.category_id, condition_grade = EXCLUDED.condition_grade,
  condition_notes = EXCLUDED.condition_notes, price = EXCLUDED.price,
  weight_gram = EXCLUDED.weight_gram, images = EXCLUDED.images,
  status = EXCLUDED.status, published_at = EXCLUDED.published_at;

INSERT INTO return_import_batches (
  id, shop_id, source, file_hash, manifest_hash, status, can_commit,
  normalized_payload, idempotency_key, commit_result, committed_at
)
VALUES (
  'RBX-DEMO-RETURN-BATCH', 'RBX-DEMO-SHOP-2026', 'SPREADSHEET',
  'demo-finance-file-v1', 'demo-finance-manifest-v1', 'COMMITTED', true,
  '[]'::jsonb, 'demo-finance-import-v1', '{"packageCount":3}'::jsonb, now() - interval '6 days'
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status, can_commit = EXCLUDED.can_commit,
  commit_result = EXCLUDED.commit_result, committed_at = EXCLUDED.committed_at;

INSERT INTO return_packages (
  id, shop_id, source_platform, source_tracking_enc, source_tracking_hash,
  source_order_ref, source_return_ref, returned_at, manifest_source,
  manifest_fetched_at, manifest_hash, ingest_batch_ref, seal_status,
  disclosure, package_weight_gram, package_listing_price_vnd, inventory_status
)
VALUES
  ('RBX-DEMO-PACKAGE-001', 'RBX-DEMO-SHOP-2026', 'SHOPEE', convert_to('DEMO-TRACKING-001', 'UTF8'), 'demo-tracking-hash-001', 'DEMO-SOURCE-ORDER-001', 'DEMO-RETURN-001', now() - interval '7 days', 'SPREADSHEET', now() - interval '6 days', 'demo-finance-manifest-v1', 'RBX-DEMO-RETURN-BATCH', 'DAMAGED', 'UNOPENED_UNINSPECTED', 620, 950000, 'SOLD'),
  ('RBX-DEMO-PACKAGE-002', 'RBX-DEMO-SHOP-2026', 'TIKTOK', convert_to('DEMO-TRACKING-002', 'UTF8'), 'demo-tracking-hash-002', 'DEMO-SOURCE-ORDER-002', 'DEMO-RETURN-002', now() - interval '6 days', 'SPREADSHEET', now() - interval '6 days', 'demo-finance-manifest-v1', 'RBX-DEMO-RETURN-BATCH', 'DAMAGED', 'UNOPENED_UNINSPECTED', 1300, 850000, 'SOLD'),
  ('RBX-DEMO-PACKAGE-003', 'RBX-DEMO-SHOP-2026', 'SHOPEE', convert_to('DEMO-TRACKING-003', 'UTF8'), 'demo-tracking-hash-003', 'DEMO-SOURCE-ORDER-003', 'DEMO-RETURN-003', now() - interval '5 days', 'SPREADSHEET', now() - interval '6 days', 'demo-finance-manifest-v1', 'RBX-DEMO-RETURN-BATCH', 'INTACT', 'UNOPENED_UNINSPECTED', 480, 225000, 'SOLD')
ON CONFLICT (id) DO UPDATE SET
  package_weight_gram = EXCLUDED.package_weight_gram,
  package_listing_price_vnd = EXCLUDED.package_listing_price_vnd,
  inventory_status = EXCLUDED.inventory_status;

INSERT INTO return_lines (
  id, return_package_id, source_item_ref, source_sku, source_quantity,
  product_name, variant_name, brand, source_category, original_unit_price_vnd,
  return_reason, product_image_urls, reboxe_category_id
)
VALUES
  ('RBX-DEMO-LINE-001', 'RBX-DEMO-PACKAGE-001', 'DEMO-LINE-001', 'SONY-XM4', 1, 'Tai nghe Sony WH-1000XM4', 'Đen', 'Sony', 'Điện tử', 950000, 'Sản phẩm không phù hợp', '["/demo-products/headphones.webp"]'::jsonb, 'electronics'),
  ('RBX-DEMO-LINE-002', 'RBX-DEMO-PACKAGE-002', 'DEMO-LINE-002', 'JORDAN-4', 1, 'Giày Jordan 4 Retro', 'Size 42', 'Jordan', 'Thời trang', 850000, 'Đổi kích cỡ', '["/demo-products/sneakers.webp"]'::jsonb, 'fashion'),
  ('RBX-DEMO-LINE-003', 'RBX-DEMO-PACKAGE-003', 'DEMO-LINE-003', 'SATIN-DRESS', 1, 'Váy satin dáng dài', 'Màu kem', NULL, 'Thời trang', 225000, 'Đổi ý', '["/demo-products/dress.webp"]'::jsonb, 'fashion')
ON CONFLICT (id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  product_image_urls = EXCLUDED.product_image_urls;

UPDATE listings SET return_package_id = CASE id
  WHEN 'RBX-DEMO-PRODUCT-001' THEN 'RBX-DEMO-PACKAGE-001'
  WHEN 'RBX-DEMO-PRODUCT-002' THEN 'RBX-DEMO-PACKAGE-002'
  WHEN 'RBX-DEMO-PRODUCT-003' THEN 'RBX-DEMO-PACKAGE-003'
END
WHERE id IN ('RBX-DEMO-PRODUCT-001', 'RBX-DEMO-PRODUCT-002', 'RBX-DEMO-PRODUCT-003');

WITH buyer AS (SELECT id FROM auth.users WHERE email = 'buyer-test@rebox.test')
INSERT INTO orders (
  id, buyer_id, status, commerce_mode, payment_method, subtotal_vnd, fee_vnd,
  total_vnd, address_snapshot_enc, address_hash, fee_snapshot, expires_at,
  confirmed_at, completed_at, created_at, updated_at
)
SELECT order_data.id, buyer.id, order_data.status, 'SANDBOX', 'SANDBOX_COD',
       order_data.subtotal_vnd, 30000, order_data.subtotal_vnd + 30000,
       decode('00', 'hex'), 'demo-address-hash', '{"version":"sandbox-v1","shippingVnd":30000}'::jsonb,
       order_data.created_at + interval '30 minutes', order_data.created_at + interval '5 minutes',
       order_data.completed_at, order_data.created_at, now()
FROM buyer
CROSS JOIN (VALUES
  ('RBX-DEMO-ORDER-001', 'COMPLETED', 950000::bigint, now() - interval '4 days', now() - interval '3 days'),
  ('RBX-DEMO-ORDER-002', 'IN_TRANSIT', 850000::bigint, now() - interval '3 days', NULL::timestamptz),
  ('RBX-DEMO-ORDER-003', 'DELIVERED', 225000::bigint, now() - interval '2 days', NULL::timestamptz)
) AS order_data(id, status, subtotal_vnd, created_at, completed_at)
ON CONFLICT (id) DO UPDATE SET
  buyer_id = EXCLUDED.buyer_id, status = EXCLUDED.status,
  subtotal_vnd = EXCLUDED.subtotal_vnd, total_vnd = EXCLUDED.total_vnd,
  confirmed_at = EXCLUDED.confirmed_at, completed_at = EXCLUDED.completed_at,
  updated_at = now();

INSERT INTO sub_orders (id, order_id, shop_id, shop_snapshot, status, created_at)
VALUES
  ('RBX-DEMO-SUB-001', 'RBX-DEMO-ORDER-001', 'RBX-DEMO-SHOP-2026', '{"id":"RBX-DEMO-SHOP-2026","displayName":"Kho Hoàn Giá Tốt","status":"ACTIVE"}'::jsonb, 'COMPLETED', now() - interval '4 days'),
  ('RBX-DEMO-SUB-002', 'RBX-DEMO-ORDER-002', 'RBX-DEMO-SHOP-2026', '{"id":"RBX-DEMO-SHOP-2026","displayName":"Kho Hoàn Giá Tốt","status":"ACTIVE"}'::jsonb, 'IN_TRANSIT', now() - interval '3 days'),
  ('RBX-DEMO-SUB-003', 'RBX-DEMO-ORDER-003', 'RBX-DEMO-SHOP-2026', '{"id":"RBX-DEMO-SHOP-2026","displayName":"Kho Hoàn Giá Tốt","status":"ACTIVE"}'::jsonb, 'DELIVERED', now() - interval '2 days')
ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, shop_snapshot = EXCLUDED.shop_snapshot;

INSERT INTO sub_order_items (
  id, sub_order_id, listing_id, return_package_id, item_snapshot, amount_vnd, quantity
)
VALUES
  ('RBX-DEMO-ITEM-001', 'RBX-DEMO-SUB-001', 'RBX-DEMO-PRODUCT-001', 'RBX-DEMO-PACKAGE-001', '{"listingId":"RBX-DEMO-PRODUCT-001","title":"Tai nghe Sony WH-1000XM4","imageUrl":"/demo-products/headphones.webp","disclosure":"UNOPENED_UNINSPECTED","sealStatus":"DAMAGED","priceVnd":950000}'::jsonb, 950000, 1),
  ('RBX-DEMO-ITEM-002', 'RBX-DEMO-SUB-002', 'RBX-DEMO-PRODUCT-002', 'RBX-DEMO-PACKAGE-002', '{"listingId":"RBX-DEMO-PRODUCT-002","title":"Giày Jordan 4 Retro","imageUrl":"/demo-products/sneakers.webp","disclosure":"UNOPENED_UNINSPECTED","sealStatus":"DAMAGED","priceVnd":850000}'::jsonb, 850000, 1),
  ('RBX-DEMO-ITEM-003', 'RBX-DEMO-SUB-003', 'RBX-DEMO-PRODUCT-003', 'RBX-DEMO-PACKAGE-003', '{"listingId":"RBX-DEMO-PRODUCT-003","title":"Váy satin dáng dài","imageUrl":"/demo-products/dress.webp","disclosure":"UNOPENED_UNINSPECTED","sealStatus":"INTACT","priceVnd":225000}'::jsonb, 225000, 1)
ON CONFLICT (id) DO UPDATE SET item_snapshot = EXCLUDED.item_snapshot, amount_vnd = EXCLUDED.amount_vnd;

INSERT INTO fund_holds (id, order_id, shop_id, amount_vnd, status, created_at, updated_at)
VALUES
  ('RBX-DEMO-HOLD-001', 'RBX-DEMO-ORDER-001', 'RBX-DEMO-SHOP-2026', 95000, 'HELD', now() - interval '4 days', now()),
  ('RBX-DEMO-HOLD-002', 'RBX-DEMO-ORDER-002', 'RBX-DEMO-SHOP-2026', 85000, 'CAPTURED_SIMULATED', now() - interval '3 days', now()),
  ('RBX-DEMO-HOLD-003', 'RBX-DEMO-ORDER-003', 'RBX-DEMO-SHOP-2026', 22500, 'HELD', now() - interval '2 days', now())
ON CONFLICT (id) DO UPDATE SET amount_vnd = EXCLUDED.amount_vnd, status = EXCLUDED.status, updated_at = now();

INSERT INTO order_events (id, order_id, event_key, from_status, to_status, source, created_at)
VALUES
  ('RBX-DEMO-OE-001', 'RBX-DEMO-ORDER-001', 'demo-order-001-completed', 'DELIVERED', 'COMPLETED', 'DEMO_SEED', now() - interval '3 days'),
  ('RBX-DEMO-OE-002', 'RBX-DEMO-ORDER-002', 'demo-order-002-transit', 'PICKED_UP', 'IN_TRANSIT', 'DEMO_SEED', now() - interval '2 days'),
  ('RBX-DEMO-OE-003', 'RBX-DEMO-ORDER-003', 'demo-order-003-delivered', 'IN_TRANSIT', 'DELIVERED', 'DEMO_SEED', now() - interval '1 day')
ON CONFLICT (event_key) DO NOTHING;

WITH buyer AS (SELECT id FROM auth.users WHERE email = 'buyer-test@rebox.test')
INSERT INTO dispute_cases (
  id, order_id, buyer_id, shop_id, status, flags, reason,
  buyer_payable_vnd, created_at, updated_at
)
SELECT case_data.id, case_data.order_id, buyer.id, 'RBX-DEMO-SHOP-2026',
       'OPEN', '{}'::text[], case_data.reason, case_data.amount_vnd,
       case_data.created_at, now()
FROM buyer
CROSS JOIN (VALUES
  ('RBX-DEMO-CASE-001', 'RBX-DEMO-ORDER-001', 'Tai nghe phát tiếng rè và mất kết nối sau khi mở kiện.', 980000::bigint, now() - interval '18 hours'),
  ('RBX-DEMO-CASE-003', 'RBX-DEMO-ORDER-003', 'Màu sắc và kiểu dáng sản phẩm khác với thông tin công bố.', 255000::bigint, now() - interval '6 hours')
) AS case_data(id, order_id, reason, amount_vnd, created_at)
ON CONFLICT (id) DO UPDATE SET reason = EXCLUDED.reason, status = EXCLUDED.status, updated_at = now();

WITH buyer AS (SELECT id FROM auth.users WHERE email = 'buyer-test@rebox.test')
INSERT INTO dispute_case_events (id, case_id, actor_id, type, body, created_at)
SELECT event_data.id, event_data.case_id, buyer.id, 'OPENED', event_data.body, event_data.created_at
FROM buyer
CROSS JOIN (VALUES
  ('RBX-DEMO-DCE-001', 'RBX-DEMO-CASE-001', 'Người mua yêu cầu kiểm tra tình trạng tai nghe.', now() - interval '18 hours'),
  ('RBX-DEMO-DCE-003', 'RBX-DEMO-CASE-003', 'Người mua yêu cầu hướng dẫn hoàn trả váy.', now() - interval '6 hours')
) AS event_data(id, case_id, body, created_at)
ON CONFLICT (id) DO NOTHING;

INSERT INTO purchase_orders (id, buyer_id, shop_id, status, total_vnd, item_count, placed_at, updated_at)
SELECT order_data.id, users.id, 'RBX-DEMO-SHOP-2026', order_data.status, order_data.total_vnd, 1, order_data.placed_at, now()
FROM auth.users AS users
CROSS JOIN (VALUES
  ('RBX-DEMO-001', 'COMPLETED', 950000::bigint, now() - interval '4 days'),
  ('RBX-DEMO-002', 'SHIPPING', 850000::bigint, now() - interval '2 days'),
  ('RBX-DEMO-003', 'COMPLETED', 225000::bigint, now() - interval '1 day')
) AS order_data(id, status, total_vnd, placed_at)
WHERE users.email = 'buyer-test@rebox.test'
ON CONFLICT (id) DO UPDATE SET
  buyer_id = EXCLUDED.buyer_id, shop_id = EXCLUDED.shop_id, status = EXCLUDED.status, total_vnd = EXCLUDED.total_vnd,
  item_count = EXCLUDED.item_count, placed_at = EXCLUDED.placed_at, updated_at = now();

INSERT INTO seller_finance_snapshots (
  shop_id, available_balance_vnd, held_balance_vnd, net_revenue_vnd,
  monthly_revenue, product_revenue, wallet_transactions, updated_at
)
VALUES (
  'RBX-DEMO-SHOP-2026', 300000, 850000, 432000,
  '[{"label":"T1","amountVnd":320000},{"label":"T2","amountVnd":365000},{"label":"T3","amountVnd":410000},{"label":"T4","amountVnd":398000},{"label":"T5","amountVnd":455000},{"label":"T6","amountVnd":432000}]'::jsonb,
  '[{"label":"Sony XM4","amountVnd":950000},{"label":"Jordan 4","amountVnd":850000},{"label":"Váy Satin","amountVnd":225000},{"label":"Phụ kiện","amountVnd":180000}]'::jsonb,
  '[{"code":"#RBX-DEMO-003","kind":"REVENUE","detail":"Váy satin dáng dài — đã trừ phí nền tảng","amountVnd":202500,"occurredAt":"2026-09-05T03:00:00.000Z"},{"code":"#RBX-DEMO-002","kind":"HOLD","detail":"Giày Jordan 4 Retro — chờ người mua xác nhận","amountVnd":-850000,"occurredAt":"2026-09-04T03:00:00.000Z"},{"code":"#RBX-DEMO-001","kind":"REVENUE","detail":"Tai nghe Sony WH-1000XM4 — đã trừ phí nền tảng","amountVnd":855000,"occurredAt":"2026-09-02T03:00:00.000Z"},{"code":"#RBX-DEPOSIT","kind":"DEPOSIT","detail":"Nạp số dư ký quỹ ban đầu","amountVnd":300000,"occurredAt":"2026-09-01T03:00:00.000Z"}]'::jsonb,
  now()
)
ON CONFLICT (shop_id) DO UPDATE SET
  available_balance_vnd = EXCLUDED.available_balance_vnd,
  held_balance_vnd = EXCLUDED.held_balance_vnd,
  net_revenue_vnd = EXCLUDED.net_revenue_vnd,
  monthly_revenue = EXCLUDED.monthly_revenue,
  product_revenue = EXCLUDED.product_revenue,
  wallet_transactions = EXCLUDED.wallet_transactions,
  updated_at = now();
