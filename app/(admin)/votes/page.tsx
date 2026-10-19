import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { Pigeon } from "@/components/pigeon";
import { requireAdmin } from "@/lib/admin";
import { first, hrefWith, pageNumber } from "@/lib/params";
import { photoUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { buttonClass } from "@/lib/ui";

export const metadata = { title: "Votes" };

const PAGE_SIZE = 20;

const FILTERS = [
  { key: "", label: "All" },
  { key: "up", label: "Upvotes" },
  { key: "down", label: "Downvotes" },
];

export default async function VotesPage(props: PageProps<"/votes">) {
  const { supabase } = await requireAdmin();
  const params = await props.searchParams;
  const q = (first(params.q) ?? "").trim().slice(0, 80);
  const kind = first(params.kind) === "up" || first(params.kind) === "down" ? first(params.kind)! : "";
  const page = pageNumber(params.page);

  let captionIds: string[] | null = null;
  if (q) {
    const { data } = await supabase
      .from("captions")
      .select("id")
      .ilike("content", `%${q}%`)
      .limit(2000);
    captionIds = (data ?? []).map((c) => c.id);
  }

  let rows: { id: number; value: number; created_at: string; user_id: string; caption_id: string }[] = [];
  let total = 0;
  if (captionIds === null || captionIds.length > 0) {
    let query = supabase
      .from("votes")
      .select("id, value, created_at, user_id, caption_id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (kind) query = query.eq("value", kind === "up" ? 1 : -1);
    if (captionIds) query = query.in("caption_id", captionIds);
    const { data, count } = await query;
    rows = data ?? [];
    total = count ?? 0;
  }

  const voterIds = [...new Set(rows.map((r) => r.user_id))];
  const capIds = [...new Set(rows.map((r) => r.caption_id))];
  const [{ data: voters }, { data: captions }] = await Promise.all([
    voterIds.length
      ? supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", voterIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[] }),
    capIds.length
      ? supabase.from("captions").select("id, content, image_id, images(storage_path)").in("id", capIds)
      : Promise.resolve({ data: [] }),
  ]);
  const voterMap = new Map((voters ?? []).map((v) => [v.id, v]));
  const captionMap = new Map(
    ((captions ?? []) as unknown as {
      id: string;
      content: string;
      image_id: string;
      images: { storage_path: string };
    }[]).map((c) => [c.id, c]),
  );

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="font-display text-4xl font-black tracking-tight">Votes</h1>
      <p className="mt-1 font-semibold text-muted">
        Every upvote and downvote, newest first. Read-only.
      </p>

      <form method="get" className="mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="kind" value={kind} />
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search by caption text</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by caption text"
            className="h-12 w-full rounded-2xl border-2 border-border bg-surface pl-12 pr-4 font-semibold placeholder:text-muted focus-visible:border-blue"
          />
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>

      <nav aria-label="Filter" className="mb-5 mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={hrefWith("/votes", { q, kind: f.key })}
            aria-current={f.key === kind ? "page" : undefined}
            className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors ${
              f.key === kind
                ? "border-blue bg-blue/10 text-blue"
                : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-border p-10 text-center">
          <Pigeon size={100} />
          <p className="mt-2 font-display text-2xl font-black">No votes found</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const voter = voterMap.get(row.user_id);
            const voterName =
              [voter?.first_name, voter?.last_name].filter(Boolean).join(" ") || "Unknown";
            const caption = captionMap.get(row.caption_id);
            return (
              <li key={row.id} className="flex items-center gap-4 rounded-3xl border-2 border-border bg-surface p-3">
                {caption ? (
                  <Link href={`/media/${caption.image_id}`} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(caption.images.storage_path)}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 rounded-2xl border-2 border-border object-cover"
                    />
                  </Link>
                ) : (
                  <span className="h-16 w-16 shrink-0 rounded-2xl bg-surface-2" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-bold leading-snug">
                    {caption ? caption.content : "Deleted caption"}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs font-bold text-muted">
                    <Avatar url={voter?.avatar_url} name={voterName} size={20} />
                    <Link href={`/users/${row.user_id}`} className="text-blue hover:underline">
                      {voterName}
                    </Link>
                    <span>{timeAgo(row.created_at)}</span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${
                    row.value === 1 ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"
                  }`}
                >
                  {row.value === 1 ? "Upvote" : "Downvote"}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={(p) => hrefWith("/votes", { q, kind, page: p })}
      />
    </main>
  );
}
