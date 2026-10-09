"use client";

import AppError from "@/components/layout/AppError";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <AppError error={error} retry={retry} />;
}
