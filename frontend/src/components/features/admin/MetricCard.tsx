import type { LucideIcon } from "lucide-react";

export function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
  progress,
}: {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: string;
  progress?: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-gray-500">{title}</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-gray-950">{value}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-gray-500">{detail}</p>
      {progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
