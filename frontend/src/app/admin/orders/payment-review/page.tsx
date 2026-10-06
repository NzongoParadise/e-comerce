import { redirect } from "next/navigation";

export default function LegacyPaymentReviewRedirect() {
  redirect("/admin/finance/review");
}
