"use client";

import AppError from "@/components/layout/AppError";
import "./globals.css";

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="pt">
      <body className="min-h-screen bg-[#f7f8f8] font-sans text-gray-900">
        <AppError error={error} retry={retry} />
      </body>
    </html>
  );
}
