type Variant = "primary" | "secondary" | "blue" | "yellow" | "ghost";
type Size = "md" | "lg";

// Chunky "press-down" buttons: a hard bottom shadow that collapses on press.
const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-extrabold uppercase tracking-wide transition-[transform,box-shadow,filter,background-color] duration-100 disabled:cursor-not-allowed disabled:opacity-50";

const press = "active:translate-y-1 active:shadow-none";

const variants: Record<Variant, string> = {
  primary: `bg-primary text-primary-foreground shadow-[0_4px_0_var(--primary-dark)] hover:brightness-110 ${press}`,
  blue: `bg-blue text-white shadow-[0_4px_0_var(--blue-dark)] hover:brightness-110 ${press}`,
  yellow: `bg-yellow text-yellow-foreground shadow-[0_4px_0_var(--yellow-dark)] hover:brightness-105 ${press}`,
  secondary: `border-2 border-border bg-surface text-foreground shadow-[0_4px_0_var(--border)] hover:bg-surface-2 ${press}`,
  ghost: "text-muted hover:bg-surface-2 hover:text-foreground",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}
