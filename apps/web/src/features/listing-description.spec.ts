import { describe, expect, it } from "vitest";
import { parseListingDescription } from "./listing-description";

describe("parseListingDescription", () => {
  it("extracts spec rows and preserves multi-line body sections", () => {
    const raw = `[CHI TIẾT]
Chất liệu: Nỉ 2 da cao cấp
Xuất xứ: Việt Nam
Phong cách: Thể thao

[MÔ TẢ]
HƯỚNG DẪN CHỌN SIZE:
Size M từ 55kg - 60kg

1. KIỂU DÁNG:
- Áo Unisex, Quần ống Suông`;

    expect(parseListingDescription(raw, "fallback")).toEqual({
      extraSpecs: [
        { label: "Chất liệu", value: "Nỉ 2 da cao cấp" },
        { label: "Xuất xứ", value: "Việt Nam" },
        { label: "Phong cách", value: "Thể thao" }
      ],
      body: "HƯỚNG DẪN CHỌN SIZE:\nSize M từ 55kg - 60kg\n\n1. KIỂU DÁNG:\n- Áo Unisex, Quần ống Suông"
    });
  });

  it("keeps plain descriptions intact without extra specs", () => {
    expect(parseListingDescription("Áo sơ mi cotton thoáng mát.", "fallback")).toEqual({
      extraSpecs: [],
      body: "Áo sơ mi cotton thoáng mát."
    });
  });

  it("falls back to condition notes when description is empty", () => {
    expect(parseListingDescription(undefined, "Hộp nguyên seal")).toEqual({
      extraSpecs: [],
      body: "Hộp nguyên seal"
    });
    expect(parseListingDescription("   ", "Hộp nguyên seal")).toEqual({
      extraSpecs: [],
      body: "Hộp nguyên seal"
    });
  });
});
