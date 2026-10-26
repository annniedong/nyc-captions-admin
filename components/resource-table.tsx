import Link from "next/link";
import type { Ctx, Resource, Row } from "@/lib/resources";

export function ResourceTable({
  resource,
  rows,
  ctx,
  empty = "Nothing here yet.",
}: {
  resource: Resource;
  rows: Row[];
  ctx: Ctx;
  empty?: string;
}) {
  const clickable = resource.can.update || resource.detail || resource.can.delete;
  return (
    <div className="overflow-x-auto rounded-3xl border-2 border-border bg-surface">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <thead className="border-b-2 border-border text-xs font-black uppercase tracking-wider text-muted">
          <tr>
            {resource.columns.map((c) => (
              <th key={c.label} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>{c.label}</th>
            ))}
            <th className="w-px px-4 py-3"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={resource.columns.length + 1} className="px-4 py-10 text-center font-semibold text-muted">
                {empty}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const id = String(row[resource.pk]);
            return (
              <tr key={id} className="border-b border-border last:border-0 hover:bg-surface-2">
                {resource.columns.map((c) => (
                  <td key={c.label} className={`px-4 py-3 align-middle ${c.align === "right" ? "text-right" : ""}`}>
                    {c.cell(row, ctx)}
                  </td>
                ))}
                <td className="px-4 py-3 text-right">
                  {clickable && (
                    <Link
                      href={`/data/${resource.key}/${id}`}
                      className="rounded-xl border-2 border-border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-blue hover:bg-surface"
                    >
                      {resource.can.update ? "Edit" : "View"}
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
