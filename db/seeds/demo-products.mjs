/* global console, process */
import { createHmac } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = require("../../packages/backend/node_modules/pg");
const { createClient } = require("../../apps/api/node_modules/@supabase/supabase-js");
const { createPiiKey, encryptPii } = require("../../packages/backend/dist/modules/identity/pii.js");

const SHOP_ID = "RBX-01JDM0SELLER00000000000001";
const BATCH_ID = "RBX-BATCH-DEMO-NB1-001";

const supabaseUrl = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseSecretKey) {
  throw new Error("SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY is required");
}

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const trackingEncSecret = process.env.RETURN_TRACKING_ENCRYPTION_KEY ?? "local-dev-only-RETURN_TRACKING_ENCRYPTION_KEY-change-before-production";
const trackingHmacSecret = process.env.RETURN_TRACKING_HMAC_KEY ?? "local-dev-only-RETURN_TRACKING_HMAC_KEY-change-before-production";
const trackingEncKey = createPiiKey(trackingEncSecret);

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined
});

const obsoleteFiles = [
  "demo-products/phone-case-bundle.webp",
  "demo-products/floral-dress.webp"
];

const products = [
  {
    id: "RBX-DEMO-NB1-001",
    packageId: "RBX-PKG-NB1-001",
    trackingCode: "NB1-RETURN-TRACK-001",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0001",
    sourceReturnRef: "RET-2611-0001",
    sealStatus: "INTACT",
    title: "Ốp lưng MagSafe trong suốt chống sốc iPhone 15 Pro",
    description: `[CHI TIẾT]
Chất liệu: Nhựa cứng PC + Viền TPU chống sốc
Tương thích: iPhone 15 Pro (6.1 inch)
Tính năng: Tích hợp vòng từ tính MagSafe
Xuất xứ: Trung Quốc
Màu sắc: Trong suốt

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Ốp lưng MagSafe trong suốt chống sốc iPhone 15 Pro

1. THIẾT KẾ & TÍNH NĂNG NỔI BẬT:
- Mặt lưng trong suốt giữ trọn vẻ đẹp nguyên bản của máy
- Vòng nam châm MagSafe lực hút chắc chắn, hỗ trợ sạc không dây ổn định
- Viền camera và viền màn hình gờ cao hạn chế trầy xước khi đặt trên mặt phẳng

2. CHẤT LIỆU & HOÀN THIỆN:
- Lưng PC cứng hạn chế ố vàng theo thời gian
- 4 góc bo đệm khí TPU dẻo giúp phân tán lực khi rơi rớt
- Nút bấm cắt khoét chính xác, độ nảy nhẹ tay

3. PHỤ KIỆN & ĐÓNG GÓI:
- Nguyên hộp từ shop nguồn, còn lớp màng bảo vệ chống trầy mặt ốp

4. MÀU SẮC / PHÂN LOẠI:
- Trong suốt · Viền MagSafe (iPhone 15 Pro)

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Lau sạch bụi mặt lưng điện thoại trước khi lắp ốp để tránh cấn xước
- Tránh tiếp xúc hóa chất tẩy rửa mạnh hoặc nhiệt độ cao

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên hộp chưa mở kiểm tra từ đơn khách đặt nhầm dòng máy; chi tiết theo bản kê nguồn Shopee.`,
    categoryId: "accessories",
    conditionGrade: "NEW_SEALED",
    conditionNotes: "Hộp ngoài nguyên seal, góc vỏ giấy hơi trầy nhẹ khi vận chuyển hoàn.",
    priceVnd: 49000,
    weightGram: 95,
    lines: [
      {
        sku: "CASE-IP15P-SIL-BLK",
        productName: "Ốp lưng MagSafe trong suốt chống sốc iPhone 15 Pro",
        variantName: "Trong suốt · Viền MagSafe",
        brand: "Apple",
        sourceCategory: "Phụ kiện điện thoại",
        categoryId: "accessories",
        quantity: 1,
        originalUnitPriceVnd: 129000,
        returnReason: "Khách đặt nhầm dòng máy",
        imageFile: "phone-case-silicone.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-002",
    packageId: "RBX-PKG-NB1-002",
    trackingCode: "NB1-RETURN-TRACK-002",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0002",
    sourceReturnRef: "RET-2611-0002",
    sealStatus: "INTACT",
    title: "Kiện hoàn 3 món phụ kiện điện thoại: 2 ốp lưng trong suốt + 1 ví da đựng thẻ",
    description: `[CHI TIẾT]
Chất liệu: TPU dẻo + PC nhám, Ví da bò tổng hợp
Tương thích: iPhone 14 / 15 và thẻ kích thước chuẩn ATM
Số lượng trong kiện: 3 sản phẩm (2 ốp lưng + 1 ví thẻ)
Xuất xứ: Việt Nam / Trung Quốc
Màu sắc: Trong suốt viền nhám, Đen vân da

[MÔ TẢ]
THÔNG TIN KIỆN HÀNG: Combo 3 món phụ kiện điện thoại nguyên kiện hoàn

1. THÀNH PHẦN THEO BẢN KÊ:
- 02 Ốp lưng bảo vệ trong suốt ESR chống sốc iPhone 14/15 (trong suốt viền nhám)
- 01 Ví da bò mini đựng thẻ cá nhân nhỏ gọn (màu đen vân da thật)

2. CHẤT LIỆU & HOÀN THIỆN:
- Ốp lưng viền nhám chống bám vân tay, chống sốc 4 góc
- Ví thẻ mỏng gọn, các ngăn may viền chỉ chắc chắn, vừa 3-5 thẻ và tiền gấp

3. ĐÓNG GÓI & TEM MÁC:
- Đóng gói chung từ một đơn hàng hoàn còn nguyên đai nguyên kiện từ kho vận chuyển

4. MÀU SẮC / PHÂN LOẠI:
- 2 ốp trong suốt viền nhám + 1 ví đen vân da

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Bảo quản ví ở nơi khô thoáng, tránh ẩm ướt trực tiếp
- Lau ốp bằng khăn ẩm mềm định kỳ

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn chưa mở kiểm đếm thực tế; thông tin từng món căn cứ theo bản kê gốc từ Shopee.`,
    categoryId: "accessories",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Kiện hoàn nguyên đai nguyên kiện từ kho vận chuyển, chưa bóc kiểm tra bên trong.",
    priceVnd: 89000,
    weightGram: 210,
    lines: [
      {
        sku: "CASE-WHITE-PRO",
        productName: "Ốp lưng bảo vệ trong suốt ESR chống sốc iPhone 14/15",
        variantName: "Trong suốt viền nhám",
        brand: "ESR",
        sourceCategory: "Phụ kiện điện thoại",
        categoryId: "accessories",
        quantity: 2,
        originalUnitPriceVnd: 75000,
        returnReason: "Đổi ý trước khi nhận hàng",
        imageFile: "phone-case-white.webp"
      },
      {
        sku: "WALLET-LEATHER-BLK",
        productName: "Ví da bò mini đựng thẻ cá nhân nhỏ gọn",
        variantName: "Đen vân da thật",
        brand: "Bụi Leather",
        sourceCategory: "Phụ kiện điện thoại",
        categoryId: "accessories",
        quantity: 1,
        originalUnitPriceVnd: 89000,
        returnReason: "Đổi ý trước khi nhận hàng",
        imageFile: "leather-cardholder.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-003",
    packageId: "RBX-PKG-NB1-003",
    trackingCode: "NB1-RETURN-TRACK-003",
    sourcePlatform: "TIKTOK",
    sourceOrderRef: "TTK-2611-0003",
    sourceReturnRef: "RET-2611-0003",
    sealStatus: "INTACT",
    title: "Kiện hoàn phụ kiện điện thoại: 2 bao da gập + 1 cáp sạc nhanh",
    description: `[CHI TIẾT]
Chất liệu: Da PU chống trầy + Sợi dù bện cáp Type-C
Chiều dài cáp: 1.2 mét
Số lượng trong kiện: 3 sản phẩm (2 bao da gập + 1 cáp sạc)
Xuất xứ: Trung Quốc
Màu sắc: Đen cổ điển / Đen xám

[MÔ TẢ]
THÔNG TIN KIỆN HÀNG: Combo 3 món phụ kiện điện thoại nguyên kiện

1. THÀNH PHẦN THEO BẢN KÊ:
- 02 Bao da gập bảo vệ toàn thân điện thoại chống va đập (màu đen cổ điển)
- 01 Cáp sạc nhanh Type-C bọc dù Hoco dài 1.2m (màu đen xám bọc dù)

2. CHẤT LIỆU & THIẾT KẾ:
- Bao da nắp gập che phủ cả mặt trước và mặt sau, có khay giữ máy ôm sát
- Cáp sạc bọc sợi dù chống rối, đầu cắm gia cố chống gãy gập

3. ĐÓNG GÓI:
- Toàn bộ nằm trong túi niêm phong nguyên trạng từ đơn giao không thành công

4. MÀU SẮC / PHÂN LOẠI:
- Đen cổ điển (bao da) + Đen xám bọc dù (cáp sạc)

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Dùng đúng củ sạc tương thích cổng USB-C để đạt tốc độ sạc ổn định
- Tránh bẻ gập đầu cáp khi đang cắm sạc

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên niêm phong chưa mở kiểm tra; chi tiết từng món theo bản kê nguồn TikTok Shop.`,
    categoryId: "accessories",
    conditionGrade: "GOOD",
    conditionNotes: "Bao bì ngoài có vết gấp nhẹ ở mép túi giao hàng, tem niêm phong còn nguyên.",
    priceVnd: 129000,
    weightGram: 260,
    lines: [
      {
        sku: "FLIP-CASE-BLK",
        productName: "Bao da gập bảo vệ toàn thân điện thoại chống va đập",
        variantName: "Đen cổ điển",
        brand: null,
        sourceCategory: "Ốp lưng & Bao da",
        categoryId: "accessories",
        quantity: 2,
        originalUnitPriceVnd: 95000,
        returnReason: "Giao hàng không thành công",
        imageFile: "phone-case-accessory.webp"
      },
      {
        sku: "CABLE-USBC-15M",
        productName: "Cáp sạc nhanh Type-C bọc dù dài 1.2m",
        variantName: "Đen xám bọc dù",
        brand: "Hoco",
        sourceCategory: "Cáp & Sạc",
        categoryId: "accessories",
        quantity: 1,
        originalUnitPriceVnd: 89000,
        returnReason: "Giao hàng không thành công",
        imageFile: "cable.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-004",
    packageId: "RBX-PKG-NB1-004",
    trackingCode: "NB1-RETURN-TRACK-004",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0004",
    sourceReturnRef: "RET-2611-0004",
    sealStatus: "INTACT",
    title: "Áo sơ mi cotton xanh navy dài tay cổ đứng",
    description: `[CHI TIẾT]
Chất liệu: Cotton 100% dệt mật độ cao
Xuất xứ: Việt Nam
Phong cách: Công sở / Tối giản / Smart Casual
Kiểu tay: Dài tay, cổ đứng
Mùa: Quanh năm
Kích cỡ: Size L
Màu sắc: Xanh navy

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo sơ mi dài tay cotton cổ đứng Anton

Size M từ 55kg - 63kg, cao 1m65 - 1m72
Size L từ 64kg - 72kg, cao 1m70 - 1m78
Size XL từ 73kg - 82kg, cao trên 1m75

THÔNG TIN SẢN PHẨM: Áo sơ mi cotton xanh navy dài tay cổ đứng (Kiện này size L)

1. KIỂU DÁNG:
- Form suông gọn gàng dễ phối cùng quần tây, kaki hoặc jeans
- Thiết kế cổ đứng giữ form chỉn chu khi mặc đi làm hay đi chơi

2. CHẤT LIỆU:
- Vải cotton mềm mịn, thấm hút mồ hôi tốt, ít nhăn khi vận động

3. TEM MÁC VÀ ĐƯỜNG MAY:
- Gồm bộ tem mác dệt bên trong cổ áo từ hãng Anton
- Đường may tỉ mỉ, cúc áo đồng màu chắc chắn

4. MÀU SẮC / PHÂN LOẠI:
- Size L · Xanh navy

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Giặt máy ở chế độ nhẹ hoặc giặt tay nước mát dưới 30°C
- Phơi trong bóng râm và ủi ở nhiệt độ trung bình

LƯU Ý KIỆN HOÀN REBOXE:
- Túi zip bọc áo còn nguyên vẹn chưa mở kiểm tra; thông số size và màu theo bản kê hoàn Shopee.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Túi zip bọc áo còn nguyên vẹn, chưa mở kiểm tra sản phẩm bên trong.",
    priceVnd: 165000,
    weightGram: 320,
    lines: [
      {
        sku: "SHIRT-COTTON-NVY-L",
        productName: "Áo sơ mi dài tay cotton cổ đứng dáng suông",
        variantName: "Size L · Xanh navy",
        brand: "Anton",
        sourceCategory: "Áo sơ mi",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 320000,
        returnReason: "Đổi kích cỡ",
        imageFile: "linen-shirt.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-005",
    packageId: "RBX-PKG-NB1-005",
    trackingCode: "NB1-RETURN-TRACK-005",
    sourcePlatform: "TIKTOK",
    sourceOrderRef: "TTK-2611-0005",
    sourceReturnRef: "RET-2611-0005",
    sealStatus: "INTACT",
    title: "Đầm midi hoa nhí vàng vintage tay ngắn",
    description: `[CHI TIẾT]
Chất liệu: Voan lụa hai lớp mềm rủ
Xuất xứ: Việt Nam
Phong cách: Vintage / Nữ tính / Dạo phố
Chiều dài váy: Dáng midi qua gối
Mùa: Xuân / Hè / Thu
Kích cỡ: Size M
Màu sắc: Vàng hoa nhí

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Đầm midi hoa nhí Nàng Thơ Studio

Size S từ 42kg - 48kg (eo dưới 66cm)
Size M từ 49kg - 55kg (eo 67cm - 72cm)
Size L từ 56kg - 62kg (eo 73cm - 78cm)

THÔNG TIN SẢN PHẨM: Đầm midi hoa nhí vàng vintage tay ngắn (Kiện này size M)

1. KIỂU DÁNG:
- Cổ tim thanh thoát tôn dáng cổ, tay ngắn bồng nhẹ che khuyết điểm bắp tay
- Tùng váy dáng chữ A xòe nhẹ tạo độ bay tự nhiên khi di chuyển

2. CHẤT LIỆU:
- Vải voan lụa thoáng nhẹ kèm lớp lót lụa mịn bên trong không gây mỏng lộ

3. TEM MÁC VÀ ĐƯỜNG MAY:
- Đầy đủ tem mác thương hiệu Nàng Thơ Studio
- Khóa kéo giọt lệ sau lưng may chìm tinh tế

4. MÀU SẮC / PHÂN LOẠI:
- Size M · Vàng hoa nhí

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Nên giặt tay nhẹ nhàng hoặc cho vào túi giặt khi giặt máy
- Ủi hơi nước ở mức nhiệt thấp

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên túi niêm phong từ shop do giao chậm lịch dự kiến, chưa mở kiểm tra bên trong.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Kiện hàng còn nguyên túi niêm phong của shop, chưa bóc kiểm đếm lại.",
    priceVnd: 189000,
    weightGram: 390,
    lines: [
      {
        sku: "DRESS-FLORAL-YLW-M",
        productName: "Đầm midi hoa nhí cổ tim tay ngắn dáng xòe",
        variantName: "Size M · Vàng hoa nhí",
        brand: "Nàng Thơ Studio",
        sourceCategory: "Váy / Đầm",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 380000,
        returnReason: "Giao chậm hơn lịch dự kiến",
        imageFile: "boutique-dress.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-006",
    packageId: "RBX-PKG-NB1-006",
    trackingCode: "NB1-RETURN-TRACK-006",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0006",
    sourceReturnRef: "RET-2611-0006",
    sealStatus: "INTACT",
    title: "Quần bò ống suông cạp cao xanh wash cổ điển",
    description: `[CHI TIẾT]
Chất liệu: Vải Denim Cotton 12oz đứng form
Xuất xứ: Việt Nam
Phong cách: Trẻ trung / Casual / Đường phố
Kiểu dáng: Cạp cao, ống suông (Straight Fit)
Mùa: Quanh năm
Kích cỡ: Size 28
Màu sắc: Xanh denim wash

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Quần bò nữ ống suông BlueYard

Size 26: 42kg - 47kg (eo 62 - 65cm)
Size 27: 48kg - 52kg (eo 66 - 69cm)
Size 28: 53kg - 57kg (eo 70 - 73cm)
Size 29: 58kg - 63kg (eo 74 - 77cm)

THÔNG TIN SẢN PHẨM: Quần bò ống suông cạp cao xanh wash cổ điển (Kiện này size 28)

1. KIỂU DÁNG:
- Thiết kế cạp cao giúp tôn vòng eo và kéo dài tỷ lệ chân
- Ống suông vừa vặn che khuyết điểm bắp chân, dễ phối áo thun, croptop hay sơ mi

2. CHẤT LIỆU:
- Denim dệt dày dặn, giữ phom tốt sau nhiều lần giặt

3. TEM MÁC VÀ ĐƯỜNG MAY:
- Tem da sau lưng và cúc đồng dập nổi chuẩn xưởng BlueYard
- Đường chỉ đôi nổi màu nâu vàng sắc nét, khóa kéo kim loại bền bỉ

4. MÀU SẮC / PHÂN LOẠI:
- Size 28 · Xanh denim

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Lộn trái quần khi giặt, giặt riêng ở 1-2 lần đầu để giữ màu wash
- Tránh ngâm thuốc tẩy

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên niêm phong do khách đặt nhầm size, chưa bóc kiểm tra sản phẩm bên trong.`,
    categoryId: "fashion",
    conditionGrade: "GOOD",
    conditionNotes: "Vỏ bọc ngoài hơi nhăn ở góc nhưng niêm phong kiện hàng vẫn còn nguyên.",
    priceVnd: 239000,
    weightGram: 640,
    lines: [
      {
        sku: "JEANS-STRAIGHT-28",
        productName: "Quần bò nữ ống suông cạp cao wash xanh",
        variantName: "Size 28 · Xanh denim",
        brand: "BlueYard",
        sourceCategory: "Quần jean",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 450000,
        returnReason: "Khách đặt nhầm size",
        imageFile: "denim-jeans.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-007",
    packageId: "RBX-PKG-NB1-007",
    trackingCode: "NB1-RETURN-TRACK-007",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0007",
    sourceReturnRef: "RET-2611-0007",
    sealStatus: "INTACT",
    title: "Túi xách đeo vai da vân cá sấu màu be kem",
    description: `[CHI TIẾT]
Chất liệu: Da PU dập vân cá sấu cao cấp
Xuất xứ: Trung Quốc
Phong cách: Thanh lịch / Công sở / Dự tiệc
Kích thước tham khảo: Ngang 22cm x Cao 15cm x Rộng 7cm
Loại khóa: Khóa xoay kim loại mạ vàng
Màu sắc: Be kem

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Túi xách đeo vai da vân cá sấu màu be kem Maison Minimal

1. KIỂU DÁNG & CÔNG NĂNG:
- Dáng túi kẹp nách / đeo vai thanh lịch, dễ kết hợp váy liền hoặc blazer
- Ngăn chính rộng rãi đựng vừa điện thoại màn hình lớn, ví mini, son phấn và chìa khóa

2. CHẤT LIỆU & HOÀN THIỆN:
- Bề mặt da PU dập vân cá sấu bóng nhẹ, chống thấm nước mưa nhẹ
- Khóa kim loại mạ vàng sáng bóng, bên trong có lớp vải lót dày dặn

3. PHỤ KIỆN & ĐÓNG GÓI:
- Kèm hộp bảo vệ và dây đeo vai đồng bộ nguyên kiện từ shop nguồn

4. MÀU SẮC / PHÂN LOẠI:
- Be kem

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Lau nhẹ bề mặt bằng khăn khô mềm sau khi đi mưa
- Nhồi giấy giữ form và cất trong túi vải khi không sử dụng

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên lớp bọc bảo vệ chưa mở kiểm tra; thông số theo bản kê nguồn Shopee.`,
    categoryId: "accessories",
    conditionGrade: "NEW_SEALED",
    conditionNotes: "Hộp carton ngoài móp nhẹ một góc, lớp bọc bảo vệ sản phẩm còn nguyên.",
    priceVnd: 289000,
    weightGram: 520,
    lines: [
      {
        sku: "BAG-CROC-BEIGE",
        productName: "Túi xách cầm tay nắp gập khóa kim loại vàng",
        variantName: "Be kem",
        brand: "Maison Minimal",
        sourceCategory: "Túi xách nữ",
        categoryId: "accessories",
        quantity: 1,
        originalUnitPriceVnd: 540000,
        returnReason: "Khách đổi sang màu đen",
        imageFile: "beige-handbag.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-008",
    packageId: "RBX-PKG-NB1-008",
    trackingCode: "NB1-RETURN-TRACK-008",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0008",
    sourceReturnRef: "RET-2611-0008",
    sealStatus: "INTACT",
    title: "Kiện hoàn 3 món: 2 áo thun cotton boxy + 1 quần bò ống đứng",
    description: `[CHI TIẾT]
Chất liệu: Áo thun Cotton 250gsm + Quần Denim Cotton
Xuất xứ: Việt Nam
Phong cách: Streetwear / Năng động / Hàng ngày
Số lượng trong kiện: 3 sản phẩm (2 áo thun + 1 quần bò)
Mùa: Quanh năm
Kích cỡ: Áo size L · Quần size 31

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Combo BasicLab (Áo L + Quần 31)

- Áo thun size L: phù hợp 62kg - 74kg, cao 1m68 - 1m78
- Quần jean size 31: phù hợp 64kg - 72kg, vòng bụng ~80 - 83cm

THÔNG TIN KIỆN HÀNG: Kiện hoàn 3 món đồng bộ từ BasicLab

1. THÀNH PHẦN THEO BẢN KÊ:
- 02 Áo thun cotton 250gsm cổ tròn form boxy (Size L · Đỏ đô & Cơ bản)
- 01 Quần bò ống đứng wash xanh cổ điển (Size 31 · Xanh indigo)

2. CHẤT LIỆU & KIỂU DÁNG:
- Áo thun định lượng dày 250gsm đứng form, bo cổ dày dặn không bai nhão
- Quần bò ống đứng thanh lịch, tôn dáng khi phối cùng áo boxy

3. TEM MÁC VÀ ĐƯỜNG MAY:
- Đầy đủ tem nhãn BasicLab, đường may vắt sổ 2 kim chắc chắn

4. MÀU SẮC / PHÂN LOẠI:
- 2 áo thun (Đỏ đô & Cơ bản - Size L) + 1 quần bò xanh indigo (Size 31)

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Lộn trái khi giặt máy ở nước mát, không sấy nhiệt độ cao

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên túi đóng gói ban đầu, chưa mở kiểm đếm thực tế từng món.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Kiện hàng lớn còn nguyên tem vận chuyển hoàn và túi đóng gói ban đầu.",
    priceVnd: 359000,
    weightGram: 1120,
    lines: [
      {
        sku: "TEE-BOXY-250-WHT",
        productName: "Áo thun cotton 250gsm cổ tròn form boxy",
        variantName: "Size L · Đỏ đô & Cơ bản",
        brand: "BasicLab",
        sourceCategory: "Áo thun",
        categoryId: "fashion",
        quantity: 2,
        originalUnitPriceVnd: 189000,
        returnReason: "Người mua hoàn toàn bộ đơn",
        imageFile: "bundle-tees-jeans.webp"
      },
      {
        sku: "JEANS-MEN-SLIM-31",
        productName: "Quần bò ống đứng wash xanh cổ điển",
        variantName: "Size 31 · Xanh indigo",
        brand: "BasicLab",
        sourceCategory: "Quần jean",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 420000,
        returnReason: "Người mua hoàn toàn bộ đơn",
        imageFile: "denim-jeans.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-009",
    packageId: "RBX-PKG-NB1-009",
    trackingCode: "NB1-RETURN-TRACK-009",
    sourcePlatform: "TIKTOK",
    sourceOrderRef: "TTK-2611-0009",
    sourceReturnRef: "RET-2611-0009",
    sealStatus: "INTACT",
    title: "Kiện hoàn 3 món thu đông: 2 áo cardigan dệt kim + 1 khăn choàng len",
    description: `[CHI TIẾT]
Chất liệu: Len sợi Acrylic pha Cotton mềm mịn
Xuất xứ: Việt Nam / Quảng Châu
Phong cách: Hàn Quốc / Thu Đông / Ấm áp
Số lượng trong kiện: 3 sản phẩm (2 cardigan + 1 khăn choàng)
Mùa: Thu / Đông
Kích cỡ: Freesize (45kg - 65kg)

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo cardigan Freesize Nordic Knit

- Phù hợp người mặc từ 45kg - 65kg, cao 1m50 - 1m70 mặc form thoải mái

THÔNG TIN KIỆN HÀNG: Combo 3 món thu đông nguyên kiện

1. THÀNH PHẦN THEO BẢN KÊ:
- 02 Áo khoác len cardigan dệt kim cổ V cúc gài (Freesize · Hồng phối xanh rêu)
- 01 Khăn choàng cổ len dệt mịn giữ ấm (Màu xám than)

2. CHẤT LIỆU & HOÀN THIỆN:
- Sợi len dệt mịn êm da, không gây ngứa rát khi mặc trực tiếp
- Bo gấu tay và nẹp cúc dệt dày giữ form ổn định

3. ĐÓNG GÓI & TEM MÁC:
- Hàng còn nguyên túi bọc từ đơn hàng TikTok Shop hủy sau khi xuất kho

4. MÀU SẮC / PHÂN LOẠI:
- 2 áo cardigan Hồng phối xanh rêu + 1 khăn choàng Xám than

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Nên giặt tay nước lạnh với nước giặt dịu nhẹ, không vắt xoắn mạnh
- Phơi nằm ngang trên mặt phẳng để len không bị giãn

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên túi bọc chưa cắt niêm phong kiểm đếm từng món.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Túi bọc kiện còn nguyên vẹn, chưa cắt niêm phong để kiểm đếm từng món.",
    priceVnd: 389000,
    weightGram: 1250,
    lines: [
      {
        sku: "KNIT-SWEATER-BRN-CRM",
        productName: "Áo khoác len cardigan dệt kim cổ V cúc gài",
        variantName: "Freesize · Hồng phối xanh rêu",
        brand: "Nordic Knit",
        sourceCategory: "Áo len",
        categoryId: "fashion",
        quantity: 2,
        originalUnitPriceVnd: 245000,
        returnReason: "Khách hủy đơn sau khi đã gửi vận chuyển",
        imageFile: "knitwear-bundle.webp"
      },
      {
        sku: "SCARF-WOOL-PRP",
        productName: "Khăn choàng cổ len dệt mịn giữ ấm",
        variantName: "Xám than",
        brand: "Nordic Knit",
        sourceCategory: "Phụ kiện mùa đông",
        categoryId: "accessories",
        quantity: 1,
        originalUnitPriceVnd: 150000,
        returnReason: "Khách hủy đơn sau khi đã gửi vận chuyển",
        imageFile: "woven-scarf.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-010",
    packageId: "RBX-PKG-NB1-010",
    trackingCode: "NB1-RETURN-TRACK-010",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0010",
    sourceReturnRef: "RET-2611-0010",
    sealStatus: "INTACT",
    title: "Kiện hoàn 3 món pha cà phê: 2 ly sứ espresso + 1 ấm Moka Pot",
    description: `[CHI TIẾT]
Chất liệu: Gốm sứ tráng men + Hợp kim nhôm đúc
Dung tích: Ly sứ 90ml · Ấm Moka Pot 3 cup (~150ml)
Số lượng trong kiện: 3 sản phẩm (2 ly kèm đĩa + 1 ấm Moka)
Xuất xứ: Trung Quốc
Màu sắc: Kem phối nâu đất / Be kem mờ

[MÔ TẢ]
THÔNG TIN KIỆN HÀNG: Bộ 3 món pha cà phê thủ công tại nhà

1. THÀNH PHẦN THEO BẢN KÊ:
- 02 Ly sứ dày kèm đĩa lót uống espresso CafeHome (90ml · Kem phối nâu đất)
- 01 Ấm pha cà phê Moka Pot hợp kim nhôm 3 cup Cafe de Kona (Be kem mờ)

2. CHẤT LIỆU & CÔNG NĂNG:
- Thành ly sứ dày giữ nhiệt espresso tốt, men sứ bóng mịn dễ vệ sinh
- Ấm Moka Pot dùng được trên bếp gas, bếp hồng ngoại (không dùng trực tiếp bếp từ nếu không có đế chuyển)

3. ĐÓNG GÓI CHỐNG SỐC:
- Thùng carton chèn xốp theo quy chuẩn chống va đập từ shop gửi ban đầu

4. MÀU SẮC / PHÂN LOẠI:
- Kem phối nâu đất (ly) + Be kem mờ (ấm Moka)

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Rửa sạch ấm bằng nước ấm sau khi pha, lau khô trước khi cất giữ
- Tránh chà búi sắt lên lớp phủ bên ngoài ấm

LƯU Ý KIỆN HOÀN REBOXE:
- Thùng carton còn nguyên băng keo niêm phong, chưa mở kiểm tra bên trong.`,
    categoryId: "home",
    conditionGrade: "NEW_SEALED",
    conditionNotes: "Thùng carton chèn xốp còn nguyên băng keo niêm phong, chưa mở kiểm tra.",
    priceVnd: 399000,
    weightGram: 1380,
    lines: [
      {
        sku: "MUG-CERAMIC-WHT-2",
        productName: "Ly sứ dày kèm đĩa lót uống espresso",
        variantName: "90ml · Kem phối nâu đất",
        brand: "CafeHome",
        sourceCategory: "Ly & Cốc",
        categoryId: "home",
        quantity: 2,
        originalUnitPriceVnd: 120000,
        returnReason: "Người nhận đi vắng nhiều ngày",
        imageFile: "ceramic-mug.webp"
      },
      {
        sku: "MOKA-POT-3CUP",
        productName: "Ấm pha cà phê Moka Pot hợp kim nhôm 3 cup",
        variantName: "Be kem mờ",
        brand: "Cafe de Kona",
        sourceCategory: "Dụng cụ pha chế",
        categoryId: "home",
        quantity: 1,
        originalUnitPriceVnd: 380000,
        returnReason: "Người nhận đi vắng nhiều ngày",
        imageFile: "moka-pot.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-011",
    packageId: "RBX-PKG-NB1-011",
    trackingCode: "NB1-RETURN-TRACK-011",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0011",
    sourceReturnRef: "RET-2611-0011",
    sealStatus: "INTACT",
    title: "Áo khoác denim wash cổ điển hai túi ngực",
    description: `[CHI TIẾT]
Chất liệu: Vải Denim Cotton 100% dày dặn
Xuất xứ: Việt Nam
Phong cách: Cổ điển / Đường phố / Unisex
Kiểu dáng: Form rộng (Relaxed Fit), hai túi ngực
Mùa: Thu / Đông / Chống nắng
Kích cỡ: Size XL
Màu sắc: Xanh nhạt wash

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo khoác denim wash DenimCo

Size M từ 52kg - 62kg, cao dưới 1m70
Size L từ 63kg - 72kg, cao 1m70 - 1m76
Size XL từ 73kg - 84kg, cao trên 1m74

THÔNG TIN SẢN PHẨM: Áo khoác denim wash cổ điển hai túi ngực (Kiện này size XL)

1. KIỂU DÁNG:
- Form rộng unisex dễ mặc khoác ngoài áo thun hoặc hoodie
- Hai túi ngực có nắp gài cúc tiện dụng cùng hai túi sườn sâu

2. CHẤT LIỆU:
- Vải denim cotton dày dặn, thoáng khí, giữ dáng áo chuẩn

3. TEM MÁC VÀ ĐƯỜNG MAY:
- Đầy đủ tem nhãn DenimCo, cúc cài kim loại dập chắc chắn
- Đường chỉ chần đôi nổi dọc thân áo tăng độ bền

4. MÀU SẮC / PHÂN LOẠI:
- Size XL · Xanh nhạt

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Lộn trái khi giặt máy, không ngâm chung với đồ sáng màu
- Phơi trong bóng râm để giữ màu wash

LƯU Ý KIỆN HOÀN REBOXE:
- Bao bì ngoài nguyên trạng chưa mở kiểm tra; thông số theo bản kê nguồn Shopee.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Bao bì ngoài nguyên trạng, không rách thủng, còn mã đơn hoàn gốc.",
    priceVnd: 419000,
    weightGram: 860,
    lines: [
      {
        sku: "JKT-DENIM-WASH-XL",
        productName: "Áo khoác denim wash xanh cổ điển form rộng",
        variantName: "Size XL · Xanh nhạt",
        brand: "DenimCo",
        sourceCategory: "Áo khoác",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 790000,
        returnReason: "Khách đổi mẫu khác",
        imageFile: "denim-jacket.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-012",
    packageId: "RBX-PKG-NB1-012",
    trackingCode: "NB1-RETURN-TRACK-012",
    sourcePlatform: "TIKTOK",
    sourceOrderRef: "TTK-2611-0012",
    sourceReturnRef: "RET-2611-0012",
    sealStatus: "INTACT",
    title: "Kiện hoàn set đồ nữ 3 món: 1 chân váy caro xếp ly + 1 áo sơ mi xanh navy + 1 túi tote vải",
    description: `[CHI TIẾT]
Chất liệu: Vải Tuyết mưa / Cotton / Vải Canvas dày
Xuất xứ: Việt Nam
Phong cách: Nữ tính / Thanh lịch / Đi học - Đi làm
Số lượng trong kiện: 3 sản phẩm (1 chân váy + 1 áo sơ mi + 1 túi tote)
Mùa: Quanh năm
Kích cỡ: Chân váy size S · Áo sơ mi size M

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Set đồ nữ 3 món

- Chân váy size S: 42kg - 48kg (eo 62 - 66cm)
- Áo sơ mi size M: 46kg - 55kg (form thanh lịch dễ sơ vin)
- Túi tote canvas: đựng vừa laptop 14 inch, sổ tay A4

THÔNG TIN KIỆN HÀNG: Kiện hoàn trọn bộ 3 món thời trang nữ

1. THÀNH PHẦN THEO BẢN KÊ:
- 01 Chân váy caro xếp ly phối hàng cúc dáng chữ A LuneWear (Size S · Caro đen trắng)
- 01 Áo sơ mi cotton xanh navy dài tay thanh lịch Anton (Size M · Xanh navy)
- 01 Túi tote vải canvas dáng đứng tối giản YUUMY (Kem / Be)

2. CHẤT LIỆU & HOÀN THIỆN:
- Chân váy xếp ly giữ nếp tốt kèm quần bảo hộ bên trong
- Áo sơ mi cotton mềm đứng cổ, túi tote canvas dày có đường may gia cố quai đeo

3. ĐÓNG GÓI:
- Toàn bộ đóng chung trong hộp quà nguyên niêm phong của shop

4. MÀU SẮC / PHÂN LOẠI:
- Chân váy Caro đen trắng (S) + Áo Xanh navy (M) + Túi Kem/Be

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Giặt riêng đồ màu xanh navy ở lần giặt đầu; giặt tay túi canvas để giữ dáng

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên hộp chưa bóc niêm phong kiểm tra thực tế.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Kiện hoàn nguyên hộp quà của shop, lớp niêm phong ngoài còn nguyên vẹn.",
    priceVnd: 429000,
    weightGram: 780,
    lines: [
      {
        sku: "DRESS-SATIN-WHT",
        productName: "Chân váy caro xếp ly phối hàng cúc dáng chữ A",
        variantName: "Size S · Caro đen trắng",
        brand: "LuneWear",
        sourceCategory: "Chân váy",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 440000,
        returnReason: "Hoàn toàn bộ đơn hàng",
        imageFile: "dress.webp"
      },
      {
        sku: "SHIRT-LINEN-CRM",
        productName: "Áo sơ mi cotton xanh navy dài tay thanh lịch",
        variantName: "Size M · Xanh navy",
        brand: "Anton",
        sourceCategory: "Áo sơ mi",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 320000,
        returnReason: "Hoàn toàn bộ đơn hàng",
        imageFile: "linen-shirt.webp"
      },
      {
        sku: "TOTE-CANVAS-NVY",
        productName: "Túi tote vải canvas dáng đứng màu kem tối giản",
        variantName: "Kem / Be",
        brand: "YUUMY",
        sourceCategory: "Túi xách",
        categoryId: "accessories",
        quantity: 1,
        originalUnitPriceVnd: 150000,
        returnReason: "Hoàn toàn bộ đơn hàng",
        imageFile: "tote.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-013",
    packageId: "RBX-PKG-NB1-013",
    trackingCode: "NB1-RETURN-TRACK-013",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0013",
    sourceReturnRef: "RET-2611-0013",
    sealStatus: "DAMAGED",
    title: "Giày sneaker da trắng tối giản đế êm",
    description: `[CHI TIẾT]
Chất liệu: Da tổng hợp Microfiber + Đế cao su non đúc
Xuất xứ: Việt Nam
Phong cách: Tối giản / Thể thao / Unisex
Chiều cao đế: ~3cm
Mùa: Quanh năm
Kích cỡ: Size 41
Màu sắc: Trắng kem

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Giày sneaker DINCOX

Size 39: chiều dài bàn chân ~24.5cm
Size 40: chiều dài bàn chân ~25.0cm
Size 41: chiều dài bàn chân ~25.5cm - 26.0cm
Size 42: chiều dài bàn chân ~26.5cm

THÔNG TIN SẢN PHẨM: Giày sneaker da trắng tối giản đế êm (Kiện này size 41)

1. KIỂU DÁNG:
- Cổ thấp ôm chân gọn gàng, phối màu trắng kem dễ kết hợp mọi trang phục

2. CHẤT LIỆU & ĐẾ GIÀY:
- Da Microfiber mềm, ít gãy mũi và dễ lau sạch bụi bẩn
- Đế cao su chống trơn trượt, lót giày êm giúp đi bộ cả ngày không đau chân

3. ĐÓNG GÓI & TEM MÁC:
- Kèm hộp DINCOX chính hãng (vỏ hộp ngoài móp nhẹ cạnh do vận chuyển hoàn)

4. MÀU SẮC / PHÂN LOẠI:
- Size 41 · Trắng kem

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Lau giày bằng khăn ẩm hoặc dung dịch vệ sinh giày chuyên dụng
- Không giặt ngâm nước lâu hoặc phơi dưới nắng gắt

LƯU Ý KIỆN HOÀN REBOXE:
- Hộp giày có vết móp nhẹ ở vỏ ngoài; chưa mở kiểm tra đôi giày bên trong.`,
    categoryId: "fashion",
    conditionGrade: "GOOD",
    conditionNotes: "Hộp giày bên ngoài hơi móp ở cạnh nhưng chưa mở kiểm tra đôi giày bên trong.",
    priceVnd: 449000,
    weightGram: 980,
    lines: [
      {
        sku: "SNK-RETRO-WHT-41",
        productName: "Giày sneaker da trắng cổ thấp thoáng khí",
        variantName: "Size 41 · Trắng kem",
        brand: "DINCOX",
        sourceCategory: "Giày thể thao",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 890000,
        returnReason: "Khách chọn nhầm size giày",
        imageFile: "sneakers.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-014",
    packageId: "RBX-PKG-NB1-014",
    trackingCode: "NB1-RETURN-TRACK-014",
    sourcePlatform: "SHOPEE",
    sourceOrderRef: "SPX-2611-0014",
    sourceReturnRef: "RET-2611-0014",
    sealStatus: "INTACT",
    title: "Kiện hoàn 2 món công sở: 1 áo blazer xám than + 1 áo sơ mi trắng",
    description: `[CHI TIẾT]
Chất liệu: Vải Tuyết mưa Hàn cao cấp (có lót lụa) + Cotton lụa
Xuất xứ: Việt Nam
Phong cách: Công sở / Lịch sự / Smart Formal
Số lượng trong kiện: 2 sản phẩm (1 blazer + 1 áo sơ mi)
Mùa: Quanh năm
Kích cỡ: Size M

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Set công sở Atelier Office (Size M)

Size S: 45kg - 52kg (cao 1m52 - 1m62)
Size M: 53kg - 60kg (cao 1m58 - 1m68)
Size L: 61kg - 68kg (cao 1m64 - 1m75)

THÔNG TIN KIỆN HÀNG: Set 2 món công sở nguyên túi bảo quản

1. THÀNH PHẦN THEO BẢN KÊ:
- 01 Áo khoác blazer hai lớp dáng suông công sở (Size M · Xám than)
- 01 Áo sơ mi công sở cổ đứng màu trắng kem (Size M · Trắng)

2. CHẤT LIỆU & KIỂU DÁNG:
- Blazer may 2 lớp có đệm vai nhẹ giúp lên phom đứng vai thanh lịch
- Áo sơ mi trắng kem mềm mịn, ít nhăn, phối hợp chuẩn bộ cùng blazer

3. ĐÓNG GÓI & TEM MÁC:
- Nằm nguyên trong túi bọc vest công sở khóa kéo niêm phong của Atelier Office

4. MÀU SẮC / PHÂN LOẠI:
- Blazer Xám than (Size M) + Sơ mi Trắng (Size M)

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Khuyến nghị giặt hấp hoặc giặt nhẹ bằng nước lạnh với blazer
- Treo móc bản rộng để giữ form vai áo

LƯU Ý KIỆN HOÀN REBOXE:
- Túi bọc còn nguyên khóa kéo niêm phong, chưa mở kiểm tra chi tiết bên trong.`,
    categoryId: "fashion",
    conditionGrade: "LIKE_NEW_99",
    conditionNotes: "Túi bọc vest công sở còn nguyên khóa kéo niêm phong, chưa mở kiểm tra.",
    priceVnd: 469000,
    weightGram: 920,
    lines: [
      {
        sku: "BLAZER-TAILOR-GRY-M",
        productName: "Áo khoác blazer hai lớp dáng suông công sở",
        variantName: "Size M · Xám than",
        brand: "Atelier Office",
        sourceCategory: "Áo Blazer",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 650000,
        returnReason: "Hoàn đơn không nhận hàng",
        imageFile: "blazer-set.webp"
      },
      {
        sku: "SHIRT-OFFICE-WHT-M",
        productName: "Áo sơ mi công sở cổ đứng màu trắng kem",
        variantName: "Size M · Trắng",
        brand: "Atelier Office",
        sourceCategory: "Áo sơ mi",
        categoryId: "fashion",
        quantity: 1,
        originalUnitPriceVnd: 320000,
        returnReason: "Hoàn đơn không nhận hàng",
        imageFile: "white-shirts-hanger.webp"
      }
    ]
  },
  {
    id: "RBX-DEMO-NB1-015",
    packageId: "RBX-PKG-NB1-015",
    trackingCode: "NB1-RETURN-TRACK-015",
    sourcePlatform: "TIKTOK",
    sourceOrderRef: "TTK-2611-0015",
    sourceReturnRef: "RET-2611-0015",
    sealStatus: "INTACT",
    title: "Loa Bluetooth di động JBL Flip chống nước pin 12 giờ",
    description: `[CHI TIẾT]
Kết nối: Bluetooth không dây ổn định
Chuẩn kháng nước: IPX7 (chống nước, đi mưa / hồ bơi)
Thời lượng pin: Lên đến 12 giờ nghe nhạc liên tục
Cổng sạc: USB Type-C
Chất liệu vỏ: Vải dệt bền bỉ + viền cao su chống va đập
Xuất xứ: Trung Quốc
Màu sắc: Trắng bạc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Loa Bluetooth di động JBL Flip chống nước pin 12 giờ

1. THIẾT KẾ & CHẤT ÂM:
- Dáng trụ nhỏ gọn dễ bỏ balo mang đi du lịch, dã ngoại hoặc đặt bàn làm việc
- Âm thanh JBL cân bằng, dải bass chắc khỏe dù kích thước gọn nhẹ

2. KHÁNG NƯỚC & ĐỘ BỀN:
- Đạt chuẩn kháng nước IPX7 giúp an tâm sử dụng ngoài trời
- Thân loa bọc vải dệt chuyên dụng kết hợp hai đầu đệm cao su hạn chế va đập

3. PIN & KẾT NỐI:
- Pin dung lượng lớn cho thời gian phát nhạc tối đa lên đến 12 giờ (tùy mức âm lượng)
- Ghép nối nhanh với điện thoại, máy tính bảng và laptop qua Bluetooth

4. MÀU SẮC / PHÂN LOẠI:
- Trắng bạc (JBL-FLIP7-WHT theo bản kê)

HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Sạc đầy trước khi sử dụng lần đầu; đậy kín nắp/lau khô cổng sạc sau khi tiếp xúc nước
- Không vừa sạc vừa đặt loa ở nơi ẩm ướt

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn còn nguyên tem niêm phong vỏ hộp, chưa bóc seal để kiểm tra máy bên trong; thông số theo bản kê TikTok Shop.`,
    categoryId: "electronics",
    conditionGrade: "NEW_SEALED",
    conditionNotes: "Vỏ hộp sản phẩm còn nguyên tem niêm phong, lớp màng co hơi trầy nhẹ.",
    priceVnd: 489000,
    weightGram: 680,
    lines: [
      {
        sku: "JBL-FLIP7-WHT",
        productName: "Loa Bluetooth di động chống nước IPX7",
        variantName: "Trắng bạc",
        brand: "JBL",
        sourceCategory: "Thiết bị âm thanh",
        categoryId: "electronics",
        quantity: 1,
        originalUnitPriceVnd: 950000,
        returnReason: "Khách đổi sang dòng loa công suất lớn hơn",
        imageFile: "bluetooth-speaker.webp"
      }
    ]
  }
];

const catalogDescriptions = {
  "RBX-01JTESTCATALOG-TECH-001": `[CHI TIẾT]
Kết nối: Bluetooth không dây
Tính năng: Chống ồn chủ động (ANC)
Chất liệu: Nhựa ABS + Đệm tai da PU êm ái
Xuất xứ: Trung Quốc
Màu sắc: Đen / Trắng (theo kiện)

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Tai nghe Bluetooth chống ồn

1. THIẾT KẾ & TÍNH NĂNG:
- Chụp tai êm ái ôm sát vành tai, hỗ trợ giảm tạp âm môi trường khi làm việc hoặc di chuyển
- Micro đàm thoại tích hợp tiện lợi cho học online và họp trực tuyến

2. KẾT NỐI & SỬ DỤNG:
- Kết nối Bluetooth ổn định với điện thoại, tablet và laptop
- Có thể gập gọn mang theo trong túi xách hoặc balo

3. BẢO QUẢN:
- Bảo quản nơi khô ráo, tránh làm rơi va đập mạnh và sạc bằng nguồn 5V ổn định

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên trạng, hộp có vết móp nhẹ ở góc; chưa mở kiểm tra nội dung bên trong.`,

  "RBX-01JTESTCATALOG-TECH-002": `[CHI TIẾT]
Màn hình: Cảm ứng màu hiển thị rõ nét
Thời lượng pin: Lên đến 7 ngày sử dụng
Chất liệu dây: Silicone mềm thoáng khí
Khả năng kết nối: Bluetooth (iOS & Android)
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Đồng hồ thông minh pin 7 ngày

1. TÍNH NĂNG CHÍNH:
- Theo dõi bước chân, nhịp tim, giấc ngủ và nhận thông báo cuộc gọi/tin nhắn từ điện thoại
- Pin tối ưu cho thời gian sử dụng lên tới 7 ngày tùy cường độ bật màn hình

2. CHẤT LIỆU & THIẾT KẾ:
- Dây đeo silicone nhẹ tay, không gây bí khi tập thể thao hoặc đeo cả ngày
- Khung viền gọn nhẹ phù hợp cả nam và nữ

3. HƯỚNG DẪN SỬ DỤNG:
- Sạc bằng cáp từ tính đi kèm trong hộp theo nguồn USB 5V-1A

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên trạng, vỏ hộp có vết xước nhỏ ở cạnh; chưa mở kiểm tra nội dung.`,

  "RBX-01JTESTCATALOG-HOME-001": `[CHI TIẾT]
Loại máy: Máy hút bụi cầm tay không dây
Chất liệu: Nhựa ABS chịu lực
Phạm vi dùng: Sofa, bàn làm việc, khe cửa, nội thất ô tô
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Máy hút bụi cầm tay

1. THIẾT KẾ & CÔNG NĂNG:
- Thiết kế cầm tay nhỏ gọn, dễ len lỏi vào các góc hẹp như bàn phím, kẽ ghế sofa và khoang xe
- Hộp chứa bụi tháo lắp nhanh để đổ bụi và vệ sinh lưới lọc

2. CHẤT LIỆU & HOÀN THIỆN:
- Thân máy nhựa ABS cứng cáp, tay cầm chắc chắn hạn chế mỏi cổ tay

3. HƯỚNG DẪN SỬ DỤNG & BẢO QUẢN:
- Vệ sinh màng lọc khô ráo sau vài lần hút để duy trì lực hút ổn định
- Không dùng máy để hút chất lỏng hoặc tàn lửa nóng

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên trạng thiếu lớp nilon bọc ngoài nhưng hộp sản phẩm còn nguyên, chưa mở kiểm định bên trong.`,

  "RBX-01JTESTCATALOG-HOME-002": `[CHI TIẾT]
Nguồn sáng: LED bảo vệ mắt 3 chế độ màu
Điều khiển: Nút cảm ứng điều chỉnh độ sáng
Chất liệu: Nhựa ABS + Hợp kim nhẹ
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Đèn bàn LED ba chế độ sáng

1. TÍNH NĂNG NỔI BẬT:
- Trang bị 3 chế độ ánh sáng (Trắng, Trung tính, Vàng ấm) phù hợp học tập, đọc sách và làm việc ban đêm
- Ánh sáng LED ổn định, hạn chế nhấp nháy gây mỏi mắt

2. THIẾT KẾ:
- Cần đèn gập xoay linh hoạt điều chỉnh góc chiếu theo bàn học hoặc bàn làm việc
- Chân đế vững chắc, gọn gàng không chiếm nhiều diện tích

3. HƯỚNG DẪN SỬ DỤNG:
- Đặt đèn trên bề mặt phẳng, tránh ẩm ướt gần khu vực nguồn điện

LƯU Ý KIỆN HOÀN REBOXE:
- Thùng ngoài có vết cấn nhỏ, sản phẩm nguyên kiện chưa mở kiểm tra nội dung.`,

  "RBX-01JTESTCATALOG-FASHION-001": `[CHI TIẾT]
Chất liệu: Vải nỉ cotton pha ấm áp
Phong cách: Trẻ trung / Unisex / Streetwear
Kiểu dáng: Form rộng có mũ / khóa kéo
Mùa: Thu / Đông / Chống nắng
Xuất xứ: Việt Nam

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo khoác nỉ form rộng

- Form rộng unisex dễ mặc, phù hợp người từ 50kg - 72kg tùy chiều cao

THÔNG TIN SẢN PHẨM: Áo khoác nỉ form rộng

1. KIỂU DÁNG:
- Thiết kế form rộng thoải mái, dễ layer cùng áo thun hoặc sơ mi bên trong

2. CHẤT LIỆU:
- Vải nỉ dày vừa phải, giữ ấm tốt nhưng vẫn thoáng khí khi mặc cả ngày

3. BẢO QUẢN:
- Giặt máy ở chế độ nhẹ, lộn trái áo khi giặt và phơi nơi thoáng gió

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn do khách đổi kích cỡ, bao bì ngoài còn nguyên chưa mở kiểm tra bên trong.`,

  "RBX-01JTESTCATALOG-FASHION-002": `[CHI TIẾT]
Chất liệu: Vải Canvas dày bền bỉ
Kiểu dáng: Túi tote dáng đứng nhiều ngăn tiện dụng
Phong cách: Tối giản / Đi học / Đi làm
Sức chứa: Đựng vừa laptop 14 inch, tài liệu A4
Xuất xứ: Việt Nam

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Túi tote canvas nhiều ngăn

1. THIẾT KẾ & TIỆN ÍCH:
- Chia nhiều ngăn phụ giúp sắp xếp gọn sổ tay, bình nước, ví tiền và phụ kiện cá nhân
- Quai đeo vai bản vừa khâu gia cố chắc chắn, chịu lực tốt khi mang sách vở hoặc laptop

2. CHẤT LIỆU:
- Vải bố canvas dệt dày đứng form, ít bám bẩn và dễ giặt sạch

3. BẢO QUẢN:
- Giặt tay với nước lạnh và xà phòng dịu nhẹ, phơi tự nhiên tránh sấy nhiệt cao

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên trạng, bao bì ngoài có vết bụi nhẹ ở đáy, chưa mở kiểm tra.`,

  "RBX-01JTESTCATALOG-BEAUTY-001": `[CHI TIẾT]
Chế độ gió: Sấy nóng & sấy mát hai chiều
Chất liệu vỏ: Nhựa cách nhiệt cao cấp
Tính năng: Đầu tập trung gió giúp tạo kiểu gọn nhanh
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Máy sấy tóc hai chiều

1. CÔNG NĂNG NỔI BẬT:
- Hỗ trợ chuyển đổi linh hoạt giữa chế độ sấy nóng làm khô nhanh và gió mát bảo vệ sợi tóc
- Luồng gió ổn định giúp giảm xơ rối và tiết kiệm thời gian sấy sau khi gội

2. THIẾT KẾ:
- Tay cầm vừa vặn dễ thao tác, có móc treo tiện lợi trong phòng tắm hoặc bàn trang điểm

3. HƯỚNG DẪN AN TOÀN:
- Giữ khoảng cách 15-20cm khi sấy tóc; không đặt máy đang hoạt động gần nước

LƯU Ý KIỆN HOÀN REBOXE:
- Vỏ hộp rách nhẹ ở mép nhưng seal chính vẫn còn nguyên, chưa mở kiểm tra máy bên trong.`,

  "RBX-01JTESTCATALOG-BEAUTY-002": `[CHI TIẾT]
Phân loại: Bộ chăm sóc da cơ bản
Loại da phù hợp: Mọi loại da, ưu tiên da nhạy cảm
Tình trạng seal: Nguyên seal nhà sản xuất
Xuất xứ: Hàn Quốc / Việt Nam (theo bao bì)

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Bộ chăm sóc da dịu nhẹ

1. CÔNG DỤNG CHÍNH:
- Hỗ trợ làm sạch nhẹ nhàng, cấp ẩm và làm dịu hàng rào bảo vệ da hàng ngày
- Kết cấu mỏng nhẹ, không gây nhờn rít

2. ĐÓNG GÓI & TÌNH TRẠNG:
- Bộ sản phẩm nguyên seal từ đơn khách đặt nhầm, chưa mở nắp hay thử nghiệm

3. LƯU Ý SỬ DỤNG:
- Đọc kỹ bảng thành phần và hạn sử dụng in trên bao bì trước khi dùng; thử trước trên vùng da nhỏ nếu da quá nhạy cảm

LƯU Ý KIỆN HOÀN REBOXE:
- Seal kiện còn nguyên vẹn, hộp ngoài hơi móp ở một góc do vận chuyển hoàn.`,

  "RBX-01JTESTCATALOG-ACCESSORY-001": `[CHI TIẾT]
Công nghệ: Sạc nhanh GaN (Gallium Nitride)
Công suất tối đa: 65W
Tương thích: Laptop USB-C, máy tính bảng, điện thoại hỗ trợ PD/QC
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Sạc nhanh GaN 65W

1. HIỆU NĂNG & CÔNG NGHỆ:
- Ứng dụng vật liệu bán dẫn GaN giúp thu nhỏ kích thước củ sạc nhưng vẫn đạt công suất tới 65W
- Tối ưu nhiệt lượng và tốc độ sạc cho điện thoại, tablet và ultrabook hỗ trợ chuẩn PD

2. THIẾT KẾ:
- Kích thước gọn nhẹ dễ bỏ túi mang đi công tác hoặc đi học

3. HƯỚNG DẪN SỬ DỤNG:
- Nên kết hợp cùng cáp sạc chuẩn 65W/100W có chip E-Marker để đạt công suất tối đa

LƯU Ý KIỆN HOÀN REBOXE:
- Hộp ngoài không còn lớp seal nilon ngoài nhưng sản phẩm bên trong chưa mở kiểm tra.`,

  "RBX-01JTESTCATALOG-ACCESSORY-002": `[CHI TIẾT]
Chuẩn công suất: Hỗ trợ sạc nhanh tối đa 100W
Chất liệu vỏ: Sợi dù bện chống rối, chống gãy gập
Chức năng: Sạc nhanh & truyền dữ liệu ổn định
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Cáp sạc bọc dù 100W

1. ĐẶC ĐIỂM NỔI BẬT:
- Hỗ trợ truyền tải công suất cao lên đến 100W, đáp ứng nhu cầu sạc nhanh cho laptop, tablet và smartphone
- Lớp vỏ bện dù mật độ cao chống xoắn rối và bảo vệ lõi đồng bên trong

2. ĐỘ BỀN:
- Cổ cáp gia cố chống đứt gãy khi uốn cong nhiều lần

3. BẢO QUẢN:
- Cuộn tròn nhẹ nhàng khi cất giữ, tránh kéo giật mạnh vào phần đầu cắm

LƯU Ý KIỆN HOÀN REBOXE:
- Bao bì ngoài có nếp gấp nhẹ, chưa mở kiểm tra nội dung bên trong.`,

  "RBX-01JTESTCATALOG-LIFESTYLE-001": `[CHI TIẾT]
Loại sản phẩm: Quạt mini cầm tay sạc pin tiện lợi
Chất liệu: Nhựa ABS nhẹ bền
Công dụng: Làm mát cá nhân khi đi học, đi làm, du lịch
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Quạt mini cầm tay

1. THIẾT KẾ & TIỆN ÍCH:
- Kích thước nhỏ gọn dễ cầm tay hoặc đặt bàn học, bàn làm việc
- Nhiều mức gió tùy chỉnh linh hoạt theo nhu cầu sử dụng

2. PIN & SẠC:
- Sạc lại tiện lợi qua cổng USB (sạc dự phòng, laptop hoặc củ sạc 5V)

3. BẢO QUẢN:
- Tránh để vật lạ rơi vào lồng quạt khi cánh đang quay; vệ sinh bụi bám định kỳ

LƯU Ý KIỆN HOÀN REBOXE:
- Kiện hoàn nguyên trạng, vỏ hộp có vết xước nhẹ gần cạnh dưới, chưa mở kiểm tra thiết bị bên trong.`,

  "RBX-01JTESTPUBLICLISTING00000": `[CHI TIẾT]
Chất liệu: Vải dù Polyester trượt nước, chắn gió
Phong cách: Năng động / Unisex / Ngoài trời
Kiểu dáng: Có mũ, khóa kéo toàn thân
Mùa: Quanh năm
Xuất xứ: Việt Nam

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE THAM KHẢO: Áo khoác gió unisex chống nước

- Form rộng dễ khoác ngoài nhiều lớp áo, phù hợp từ 48kg - 72kg

THÔNG TIN SẢN PHẨM: Áo khoác gió unisex chống nước

1. KIỂU DÁNG & CÔNG NĂNG:
- Áo khoác gió nhẹ, chắn gió bụi và chống thấm nước mưa phùn nhẹ
- Mũ trùm có dây rút tiện lợi khi di chuyển ngoài trời

2. CHẤT LIỆU:
- Vải gió 2 lớp thoáng nhẹ, nhanh khô và dễ gấp gọn bỏ cốp xe hoặc balo

3. BẢO QUẢN:
- Giặt nước lạnh ở chế độ nhẹ, không ủi trực tiếp ở nhiệt độ cao

LƯU Ý KIỆN HOÀN REBOXE:
- Bao bì ngoài có vết cấn nhẹ, chưa mở kiểm tra nội dung bên trong.`,

  "RBX-DEMO-PRODUCT-004": `[CHI TIẾT]
Loại bàn phím: Bàn phím cơ không dây
Kết nối: Đa chế độ không dây / Bluetooth
Chất liệu keycap: Nhựa ABS/PBT bền màu
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Bàn phím cơ không dây

1. TRẢI NGHIỆM GÕ & THIẾT KẾ:
- Hành trình phím cơ cho cảm giác gõ nảy tay, chính xác khi làm việc văn phòng hoặc chơi game
- Kết nối không dây giúp góc bàn làm việc gọn gàng, tối giản dây cáp

2. TƯƠNG THÍCH:
- Dễ dàng kết nối với máy tính Windows, macOS, máy tính bảng và điện thoại

3. BẢO QUẢN:
- Tránh đổ nước trực tiếp lên bề mặt phím; vệ sinh khe phím định kỳ bằng chổi mềm

LƯU Ý KIỆN HOÀN REBOXE:
- Seal ngoài còn nguyên, chưa mở kiểm tra nội dung bên trong.`,

  "RBX-DEMO-PRODUCT-005": `[CHI TIẾT]
Nguồn sáng: LED chống nhấp nháy bảo vệ mắt
Chất liệu: Nhựa ABS + Hợp kim sơn tĩnh điện
Phù hợp: Bàn học, bàn đọc sách, bàn làm việc
Xuất xứ: Trung Quốc

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Đèn bàn LED chống cận

1. TÍNH NĂNG CHIẾU SÁNG:
- Ánh sáng đều, giảm chói lóa và hạn chế mỏi mắt khi đọc sách hoặc học tập lâu
- Cổ đèn điều chỉnh linh hoạt hướng chiếu sáng theo nhu cầu

2. THIẾT KẾ & BẢO QUẢN:
- Kiểu dáng hiện đại, chân đế chắc chắn tiết kiệm không gian mặt bàn
- Đặt nơi khô ráo, lau bụi bề mặt đèn bằng khăn khô mềm

LƯU Ý KIỆN HOÀN REBOXE:
- Thùng ngoài hơi móp, sản phẩm nguyên kiện chưa mở kiểm tra nội dung bên trong.`,

  "RBX-DEMO-PRODUCT-006": `[CHI TIẾT]
Chất liệu: Vải Canvas dệt dày
Kiểu dáng: Túi tote nhiều ngăn tiện dụng
Sức chứa: Vừa laptop, tài liệu A4 và đồ dùng hàng ngày
Xuất xứ: Việt Nam

[MÔ TẢ]
THÔNG TIN SẢN PHẨM: Túi tote canvas nhiều ngăn

1. THIẾT KẾ & CÔNG NĂNG:
- Bố trí nhiều ngăn giúp phân chia đồ cá nhân ngăn nắp, dễ tìm kiếm
- Đường may đáy và quai túi chắc chắn chịu được tải trọng đồ dùng đi học, đi làm

2. CHẤT LIỆU & BẢO QUẢN:
- Vải canvas đứng form, dễ giặt tay bằng nước mát và phơi nơi thoáng gió

LƯU Ý KIỆN HOÀN REBOXE:
- Bao bì ngoài còn nguyên, chưa mở kiểm tra nội dung bên trong.`
};

function trackingHash(code) {
  return createHmac("sha256", trackingHmacSecret).update(code.trim().toUpperCase()).digest("hex");
}

async function syncStorageImages() {
  const uniqueFiles = [...new Set(products.flatMap((p) => p.lines.map((l) => l.imageFile)))];
  const publicDir = path.resolve("apps/web/public/demo-products");

  await supabase.storage.from("catalog-media").remove(obsoleteFiles);

  await Promise.all(
    uniqueFiles.map(async (file) => {
      const bytes = await fs.readFile(path.join(publicDir, file));
      const { error } = await supabase.storage
        .from("catalog-media")
        .upload(`demo-products/${file}`, bytes, {
          contentType: "image/webp",
          upsert: true
        });
      if (error) {
        throw new Error(`Failed to upload demo-products/${file}: ${error.message}`);
      }
    })
  );

  return uniqueFiles.length;
}

async function seedProducts() {
  const shopCheck = await pool.query("SELECT id, display_name FROM shops WHERE id = $1", [SHOP_ID]);
  if (!shopCheck.rowCount) {
    throw new Error(`Shop ${SHOP_ID} not found. Run db/seeds/demo-accounts.mjs first.`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO return_import_batches (
         id, shop_id, source, file_hash, manifest_hash, status, can_commit,
         normalized_payload, idempotency_key, commit_result, committed_at
       ) VALUES (
         $1, $2, 'SPREADSHEET', 'demo-nb1-catalog-file-v1', 'demo-nb1-catalog-manifest-v1',
         'COMMITTED', true, '[]'::jsonb, 'demo-nb1-catalog-import-v1', $3::jsonb, now()
       )
       ON CONFLICT (id) DO UPDATE SET
         status = 'COMMITTED',
         can_commit = true,
         commit_result = EXCLUDED.commit_result,
         committed_at = now()`,
      [BATCH_ID, SHOP_ID, JSON.stringify({ packageCount: products.length })]
    );

    for (let index = 0; index < products.length; index++) {
      const item = products[index];
      const manifestHash = `demo-nb1-pkg-${String(index + 1).padStart(3, "0")}`;
      const packageImageFiles = [...new Set(item.lines.map((l) => l.imageFile))];

      await client.query(
        `INSERT INTO return_packages (
           id, shop_id, source_platform, source_tracking_enc, source_tracking_hash,
           source_order_ref, source_return_ref, returned_at, manifest_source,
           manifest_fetched_at, manifest_hash, manifest_version, ingest_batch_ref,
           seal_status, disclosure, package_weight_gram, package_listing_price_vnd,
           inventory_status
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, now() - ($8 || ' days')::interval, 'SPREADSHEET',
           now(), $9, 1, $10,
           $11, 'UNOPENED_UNINSPECTED', $12, $13, 'AVAILABLE'
         )
         ON CONFLICT (id) DO UPDATE SET
           source_platform = EXCLUDED.source_platform,
           source_tracking_enc = EXCLUDED.source_tracking_enc,
           source_tracking_hash = EXCLUDED.source_tracking_hash,
           source_order_ref = EXCLUDED.source_order_ref,
           source_return_ref = EXCLUDED.source_return_ref,
           seal_status = EXCLUDED.seal_status,
           package_weight_gram = EXCLUDED.package_weight_gram,
           package_listing_price_vnd = EXCLUDED.package_listing_price_vnd,
           inventory_status = 'AVAILABLE'`,
        [
          item.packageId,
          SHOP_ID,
          item.sourcePlatform,
          encryptPii(item.trackingCode, trackingEncKey),
          trackingHash(item.trackingCode),
          item.sourceOrderRef,
          item.sourceReturnRef,
          String((index % 5) + 1),
          manifestHash,
          BATCH_ID,
          item.sealStatus,
          item.weightGram,
          item.priceVnd
        ]
      );

      const lineIds = [];
      for (let lineIdx = 0; lineIdx < item.lines.length; lineIdx++) {
        const line = item.lines[lineIdx];
        const lineId = `RBX-RL-NB1-${String(index + 1).padStart(3, "0")}-${lineIdx + 1}`;
        lineIds.push(lineId);

        await client.query(
          `INSERT INTO return_lines (
             id, return_package_id, source_item_ref, source_sku, source_quantity,
             product_name, variant_name, brand, source_category, original_unit_price_vnd,
             return_reason, product_image_urls, reboxe_category_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
           ON CONFLICT (id) DO UPDATE SET
             source_sku = EXCLUDED.source_sku,
             source_quantity = EXCLUDED.source_quantity,
             product_name = EXCLUDED.product_name,
             variant_name = EXCLUDED.variant_name,
             brand = EXCLUDED.brand,
             source_category = EXCLUDED.source_category,
             original_unit_price_vnd = EXCLUDED.original_unit_price_vnd,
             return_reason = EXCLUDED.return_reason,
             product_image_urls = EXCLUDED.product_image_urls,
             reboxe_category_id = EXCLUDED.reboxe_category_id`,
          [
            lineId,
            item.packageId,
            `ITEM-${String(index + 1).padStart(3, "0")}-${lineIdx + 1}`,
            line.sku,
            line.quantity,
            line.productName,
            line.variantName,
            line.brand,
            line.sourceCategory,
            line.originalUnitPriceVnd,
            line.returnReason,
            JSON.stringify([`demo-products/${line.imageFile}`]),
            line.categoryId
          ]
        );
      }

      await client.query(
        "DELETE FROM return_lines WHERE return_package_id = $1 AND NOT (id = ANY($2::text[]))",
        [item.packageId, lineIds]
      );

      const imagesJson = JSON.stringify(
        packageImageFiles.map((file) => ({ key: `demo-products/${file}`, width: 1200, height: 900 }))
      );

      await client.query(
        `INSERT INTO listings (
           id, shop_id, return_package_id, title, description, category_id,
           condition_grade, condition_notes, price, weight_gram, images,
           price_source, status, published_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11::jsonb,
           'VERIFIED_CSV', 'ACTIVE', now() - ($12 || ' minutes')::interval
         )
         ON CONFLICT (id) DO UPDATE SET
           shop_id = EXCLUDED.shop_id,
           return_package_id = EXCLUDED.return_package_id,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           category_id = EXCLUDED.category_id,
           condition_grade = EXCLUDED.condition_grade,
           condition_notes = EXCLUDED.condition_notes,
           price = EXCLUDED.price,
           weight_gram = EXCLUDED.weight_gram,
           images = EXCLUDED.images,
           price_source = EXCLUDED.price_source,
           status = 'ACTIVE',
           published_at = EXCLUDED.published_at`,
        [
          item.id,
          SHOP_ID,
          item.packageId,
          item.title,
          item.description,
          item.categoryId,
          item.conditionGrade,
          item.conditionNotes,
          item.priceVnd,
          item.weightGram,
          imagesJson,
          String(index * 5)
        ]
      );
    }

    for (const [id, description] of Object.entries(catalogDescriptions)) {
      await client.query("UPDATE listings SET description = $2 WHERE id = $1", [id, description]);
    }

    const remaining = await client.query(
      "SELECT id, title FROM listings WHERE status = 'ACTIVE' AND coalesce(description, '') NOT LIKE '[CHI TIẾT]%' ORDER BY id"
    );

    await client.query("COMMIT");
    return remaining.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const uploadedCount = await syncStorageImages();
  const remainingPlainListings = await seedProducts();
  console.log(JSON.stringify({
    shopId: SHOP_ID,
    uploadedImages: uploadedCount,
    seededListings: products.length,
    multiItemPackages: products.filter((p) => p.lines.reduce((s, l) => s + l.quantity, 0) > 1).length,
    remainingPlainListings
  }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
