import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { Pigeon } from "@/components/pigeon";
import { SubwayBullet } from "@/components/subway-bullet";
import { requireAdmin } from "@/lib/admin";
import { first, hrefWith, pageNumber } from "@/lib/params";
import { photoUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { buttonClass } from "@/lib/ui";
import { getVoice, VOICES } from "@/lib/voices";
import { deleteImage } from "./actions";

export const metadata = { title: "Media" };

const PAGE_SIZE = 10;

type Row = {
  id: string;
  storage_path: string;
  created_at: string;
  user_id: string;
  captions: {
    id: string;
    content: string;
    style: string;
    score: number;
    vote_count: number;
    model: string;
  }[];
};

export default async function MediaPage(props: PageProps<"/media">) {
  const { supabase } = await requireAdmin();
  const params = await props.searchParams;
  const q = (first(params.q) ?? "").trim().slice(0, 80);
  const voice = first(params.voice) ?? "";
  const page = pageNumber(params.page);

  // Filtering happens on captions first, so each photo still shows all of its captions.
  let imageIds: string[] | null = null;
  if (q || voice) {
    let query = supabase.from("captions").select("image_id").limit(2000);
    if (q) query = query.ilike("content", `%${q}%`);
    if (voice) query = query.eq("style", voice);
    const { data } = await query;
    imageIds = [...new Set((data ?? []).map((r) => r.image_id))];
  }

  let rows: Row[] = [];
  let total = 0;
  if (imageIds === null || imageIds.length > 0) {
    let query = supabase
      .from("images")
      .select(
        "id, storage_path, created_at, user_id, captions(id, content, style, score, vote_count, model)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (imageIds) query = query.in("id", imageIds);
    const { data, count } = await query;
    rows = (data ?? []) as Row[];
    total = count ?? 0;
  }

  const authorIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", authorIds)
    : { data: [] };
  const authorMap = new Map((authors ?? []).map((a) => [a.id, a]));

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">Media</h1>
          <p className="mt-1 font-semibold text-muted">
            AI-generated photos and captions. Create, edit, and delete.
          </p>
        </div>
        <Link href="/media/new" className={buttonClass("primary")}>
          <PlusIcon className="h-4 w-4" />
          New AI post
        </Link>
      </div>

      <form method="get" className="mb-6 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search captions</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search caption text"
            className="h-12 w-full rounded-2xl border-2 border-border bg-surface pl-12 pr-4 font-semibold placeholder:text-muted focus-visible:border-blue"
          />
        </label>
        <label>
          <span className="sr-only">Filter by voice</span>
          <select
            name="voice"
            defaultValue={voice}
            className="h-12 rounded-2xl border-2 border-border bg-surface px-4 font-bold"
          >
            <option value="">All voices</option>
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
            <option value="manual">Added by an admin</option>
          </select>
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Filter
        </button>
        {(q || voice) && (
          <Link href="/media" className={buttonClass("ghost")}>
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-border p-10 text-center">
          <Pigeon size={100} />
          <p className="mt-2 font-display text-2xl font-black">No media found</p>
          <p className="mt-1 font-semibold text-muted">
            {q || voice ? "Try a different search." : "Create the first AI post."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const author = authorMap.get(row.user_id);
            const authorName =
              [author?.first_name, author?.last_name].filter(Boolean).join(" ") || "Unknown";
            const voiceInfo = getVoice(row.captions[0]?.style ?? "");
            return (
              <li
                key={row.id}
                className="flex flex-col gap-4 rounded-3xl border-2 border-border bg-surface p-4 sm:flex-row"
              >
                <Link href={`/media/${row.id}`} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(row.storage_path)}
                    alt=""
                    loading="lazy"
                    className="h-40 w-full rounded-2xl border-2 border-border object-cover sm:w-40"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted">
                    {voiceInfo && (
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <SubwayBullet line={voiceInfo.line} size={20} />
                        {voiceInfo.label}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <Avatar url={author?.avatar_url} name={authorName} size={20} />
                      {authorName}
                    </span>
                    <span>{timeAgo(row.created_at)}</span>
                    <span>{row.captions.length} captions</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {row.captions.slice(0, 3).map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-sm font-semibold">
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-black tabular-nums ${
                            c.score > 0
                              ? "bg-primary/15 text-primary"
                              : c.score < 0
                                ? "bg-danger/15 text-danger"
                                : "bg-surface-2 text-muted"
                          }`}
                        >
                          {c.score > 0 ? "+" : ""}
                          {c.score}
                        </span>
                        <span className="line-clamp-2">{c.content}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex shrink-0 gap-2 sm:flex-col">
                  <Link href={`/media/${row.id}`} className={buttonClass("secondary")}>
                    Edit
                  </Link>
                  <ActionForm
                    action={deleteImage}
                    confirmMessage="Delete this photo, all of its captions, and every vote on them? This can't be undone."
                  >
                    <input type="hidden" name="id" value={row.id} />
                    <SubmitButton variant="danger" pendingLabel="Deleting…">
                      Delete
                    </SubmitButton>
                  </ActionForm>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pagination
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        hrefFor={(p) => hrefWith("/media", { q, voice, page: p })}
      />
    </main>
  );
}
