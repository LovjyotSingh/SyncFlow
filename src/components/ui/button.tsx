import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "grad";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-black font-semibold hover:bg-white hover:shadow-[0_10px_40px_-10px_rgb(255_61_129/0.6)] disabled:hover:shadow-none",
  grad: "text-black font-semibold bg-[image:var(--grad)] hover:brightness-110 hover:shadow-[0_10px_40px_-10px_rgb(255_61_129/0.7)]",
  secondary: "border border-line2 bg-white/[0.03] text-ink hover:bg-white/[0.07] hover:border-white/25",
  ghost: "text-muted hover:text-ink hover:bg-white/[0.06]",
  danger: "border border-bad/30 text-bad hover:bg-bad/10",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2.5 rounded-full",
  icon: "size-9 rounded-lg",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-all duration-200 select-none",
        "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap font-medium transition-all duration-200 select-none active:scale-[0.98]",
    variants[variant],
    sizes[size],
    className,
  );
}
