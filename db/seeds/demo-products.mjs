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
    description: "Kiện hoàn 1 ốp lưng MagSafe trong suốt chống sốc còn nguyên hộp chưa mở do khách đặt nhầm dòng máy.",
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
    description: "Đơn hoàn gồm nhiều phụ kiện từ cùng một đơn hàng do khách đổi ý không nhận, nguyên kiện chưa mở kiểm đếm.",
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
    description: "Đơn hoàn gồm 3 món phụ kiện điện thoại của cùng 1 người mua, giao không thành công do không liên hệ được.",
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
    description: "Kiện hoàn áo sơ mi chất liệu cotton đứng form thanh lịch, hoàn do khách muốn đổi sang size nhỏ hơn.",
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
    description: "Kiện hoàn đầm nữ hoa nhí cổ tim dáng dài phong cách vintage, hoàn đơn do giao chậm hơn lịch dự kiến.",
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
    description: "Kiện hoàn quần jean denim dày dặn đứng form, thông tin kích cỡ theo bản kê gốc từ sàn.",
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
    description: "Kiện hoàn túi xách nữ kèm hộp bảo vệ, chưa mở hộp kiểm tra tình trạng chi tiết bên trong.",
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
    description: "Đơn hàng nhiều sản phẩm từ cùng một shop (2 áo thun + 1 quần jean), khách hoàn nguyên kiện khi giao không thành công.",
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
    description: "Đơn hoàn gồm 2 áo len cardigan dệt kim và 1 khăn choàng len giữ ấm cùng đơn mua, giữ nguyên kiện đóng gói từ shop.",
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
    description: "Bộ 3 món dụng cụ pha cà phê từ cùng 1 đơn hàng hoàn, được chèn chống sốc theo quy chuẩn ban đầu.",
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
    description: "Kiện hoàn áo khoác jean chất liệu cotton dày, nút kim loại chắc chắn, chưa mở kiểm tra sau khi hoàn kho.",
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
    description: "Đơn hoàn gồm trọn bộ 3 sản phẩm thời trang nữ mua cùng 1 shop, giao không thành công.",
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
    description: "Kiện hoàn giày sneaker đế êm form chuẩn, vỏ hộp ngoài có vết móp nhẹ khi vận chuyển hoàn.",
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
    description: "Đơn hoàn gồm 2 áo công sở cao cấp của cùng 1 người mua từ shop, còn nguyên túi bảo quản.",
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
    description: "Kiện hoàn loa Bluetooth di động thiết kế vải dệt bền bỉ, chưa bóc seal hộp để kiểm tra máy bên trong.",
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

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const uploadedCount = await syncStorageImages();
  await seedProducts();
  console.log(JSON.stringify({
    shopId: SHOP_ID,
    uploadedImages: uploadedCount,
    seededListings: products.length,
    multiItemPackages: products.filter((p) => p.lines.reduce((s, l) => s + l.quantity, 0) > 1).length
  }, null, 2));
}

try {
  await main();
} finally {
  await pool.end();
}
