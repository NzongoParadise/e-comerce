import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[#1d6ac4] text-white hover:bg-[#155099] focus-visible:ring-[#1d6ac4]/25",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:border-[#1d6ac4] hover:bg-[#e8f0fc] hover:text-[#155099] focus-visible:ring-[#1d6ac4]/20",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-300",
    danger: "bg-[#c1121f] text-white hover:bg-[#a50f1a] focus-visible:ring-red-200",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "min-h-8 px-3 text-xs",
    md: "min-h-10 px-4 text-sm",
    lg: "min-h-11 px-5 text-sm",
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-bold tracking-[-0.01em] shadow-sm transition-[background-color,border-color,color,box-shadow,transform] duration-150 hover:-translate-y-px active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
