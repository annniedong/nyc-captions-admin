export function Avatar({
  url,
  name,
  size = 32,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
}) {
  const initial = (name?.trim()[0] ?? "?").toUpperCase();
  const style = { width: size, height: size };

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        referrerPolicy="no-referrer"
        style={style}
        className="rounded-full border border-border object-cover"
      />
    );
  }

  return (
    <span
      style={{ ...style, fontSize: size * 0.42 }}
      className="grid place-items-center rounded-full bg-surface-2 font-semibold text-foreground"
      aria-hidden
    >
      {initial}
    </span>
  );
}
