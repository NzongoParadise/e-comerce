type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({ eyebrow, title, action, className = "" }: SectionHeaderProps) {
  return (
    <div className={`mb-5 flex items-end justify-between gap-3 ${className}`}>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1d6ac4]">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-black text-gray-900">{title}</h2>
      </div>
      {action}
    </div>
  );
}
