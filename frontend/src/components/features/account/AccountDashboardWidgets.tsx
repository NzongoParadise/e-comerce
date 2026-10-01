import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight, UserRound } from "lucide-react";

export function Metric({
  icon: Icon,
  value,
  label,
  href,
  tone = "blue",
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  href: string;
  tone?: "blue" | "pink";
}) {
  return (
    <Link
      href={href}
      className="card group animate-fade-in-up p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_32px_rgba(15,23,42,0.08)]"
      style={{ animationDelay: "80ms" }}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-105 ${tone === "pink" ? "bg-pink-50 text-pink-600" : "bg-blue-50 text-[#1555d8]"}`}>
        <Icon size={17} />
      </span>
      <strong className="mt-2 block text-xl font-black text-gray-900">{value}</strong>
      <span className="text-[10px] font-semibold text-gray-500">{label}</span>
    </Link>
  );
}

export function DataRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon size={14} className="shrink-0 text-gray-600" />
      <span>
        <small className="block text-gray-500">{label}</small>
        <b className="block text-gray-800">{value}</b>
      </span>
    </div>
  );
}

export function ChevronRightIcon() {
  return <span className="text-sm">›</span>;
}

export function HeadsetIcon() {
  return <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[#1555d8]">◉</span>;
}

export function ListArrow() {
  return <ArrowRight size={12} className="text-[#1555d8]" />;
}

export function AccountInfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <DataRow icon={Icon} label={label} value={value} />;
}

export function AccountInfoFooter() {
  return <div className="mt-1 text-xs text-gray-500">Conta / apoio</div>;
}

export function UserProfileRow({ value }: { value: string }) {
  return <DataRow icon={UserRound} label="Perfil" value={value} />;
}
