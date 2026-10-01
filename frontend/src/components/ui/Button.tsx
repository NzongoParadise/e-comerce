import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  icon,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[#1d6ac4] text-white hover:bg-[#155099]",
    secondary: "border border-[#1d6ac4] bg-white text-[#1d6ac4] hover:bg-[#e8f0fc]",
    ghost: "bg-transparent text-[#1d6ac4] hover:bg-[#e8f0fc]",
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
