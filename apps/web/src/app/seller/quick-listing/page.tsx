import { QuickListingWorkspace } from "../../../features/quick-listing/quick-listing-workspace";
import { SellerShell } from "../../../features/seller-shell";

export default function QuickListingPage() {
  return (
    <SellerShell>
      <QuickListingWorkspace />
    </SellerShell>
  );
}
