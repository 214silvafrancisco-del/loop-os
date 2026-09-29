import type { Metadata } from "next";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Recuperar password" };

export default function ResetPasswordPage() {
  return <ResetRequestForm />;
}
