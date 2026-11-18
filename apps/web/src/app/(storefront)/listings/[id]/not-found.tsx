import { SiteStatus } from "../../../../features/site-status";

export default function ListingNotFound() {
  return <SiteStatus code={404} title="Không tìm thấy sản phẩm" message="Tin đăng có thể chưa được công khai hoặc đã được gỡ." />;
}
