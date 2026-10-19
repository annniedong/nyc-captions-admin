import Link from "next/link";
import { buttonClass } from "@/lib/ui";

export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass("secondary")}>
          Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm font-extrabold text-muted">
        Page {page} of {pages} · {total} total
      </p>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={buttonClass("secondary")}>
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
