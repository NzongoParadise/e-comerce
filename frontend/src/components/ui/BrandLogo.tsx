import Link from "next/link";
import { Monitor } from "lucide-react";

export function BrandLogo({
  compact = false,
  dark = false,
  className = "",
}: {
  compact?: boolean;
  dark?: boolean;
  className?: string;
}) {
  const textColor = dark ? "text-white" : "text-[#132238]";
  const subTextColor = dark ? "text-emerald-100" : "text-[#087e76]";

  return (
    <Link href="/" className={`flex shrink-0 items-center gap-2 sm:gap-3 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#087e76] text-white sm:h-10 sm:w-10">
        <Monitor size={compact ? 18 : 20} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <strong className={`block text-sm font-black tracking-tight sm:text-base ${textColor}`}>
          RUBRICA DILIGENTE
        </strong>
        <small className={`hidden text-[8px] font-bold uppercase tracking-widest sm:block ${subTextColor}`}>
          Tecnologia sem fronteiras
        </small>
      </span>
    </Link>
  );
}
