import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  color,
  size = 28,
  ring,
  className,
  title,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold text-black select-none",
        ring && "ring-2 ring-bg",
        className,
      )}
      style={{ width: size, height: size, background: color, fontSize: Math.max(10, size * 0.38) }}
    >
      {initials(name)}
    </span>
  );
}
