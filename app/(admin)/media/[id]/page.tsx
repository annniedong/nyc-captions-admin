import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { SubwayBullet } from "@/components/subway-bullet";
import { requireAdmin } from "@/lib/admin";
import { MAIN_APP_URL } from "@/lib/config";
import { photoUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";
import { getVoice } from "@/lib/voices";
import { addCaption, deleteCaption, deleteImage, updateCaption } from "../actions";

export const metadata = { title: "Edit media" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MediaDetailPage(props: PageProps<"/media/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const { data: image } = await supabase
    .from("images")
    .select(
      "id, storage_path, created_at, user_id, captions(id, content, style, prompt, model, score, vote_count, created_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!image) notFound();

  const captions = [...image.captions].sort(
    (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );

  const [{ data: author }, { data: votes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .eq("id", image.user_id)
      .maybeSingle(),
    captions.length
      ? supabase.from("votes").select("caption_id, value").in("caption_id", captions.map((c) => c.id))
      : Promise.resolve({ data: [] as { caption_id: string; value: number }[] }),
  ]);

  const tally = new Map<string, { up: number; down: number }>();
  for (const v of votes ?? []) {
    const t = tally.get(v.caption_id) ?? { up: 0, down: 0 };
    if (v.value === 1) t.up += 1;
    else t.down += 1;
    tally.set(v.caption_id, t);
  }

  const authorName =
    [author?.first_name, author?.last_name].filter(Boolean).join(" ") || "Unknown";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/media" className="text-sm font-extrabold uppercase tracking-wide text-blue hover:underline">
        ← Back to media
      </Link>
      <h1 className="mb-6 mt-3 font-display text-4xl font-black tracking-tight">Edit media</h1>

      <div className="grid gap-8 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-3xl border-2 border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(image.storage_path)} alt="The photo being edited" className="w-full object-contain" />
          </div>
          <div className="mt-4 rounded-3xl border-2 border-border bg-surface p-4 text-sm font-bold">
            <p className="flex items-center gap-2">
              <Avatar url={author?.avatar_url} name={authorName} size={28} />
              <Link href={`/users/${image.user_id}`} className="text-blue hover:underline">
                {authorName}
              </Link>
            </p>
            <p className="mt-2 text-muted">Posted {timeAgo(image.created_at)}</p>
            <p className="mt-1 break-all text-xs text-muted">{image.id}</p>
            <a
              href={`${MAIN_APP_URL}/image/${image.id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-blue hover:underline"
            >
              View in the public app
            </a>
          </div>

          <ActionForm
            action={deleteImage}
            confirmMessage="Delete this photo, all of its captions, and every vote on them? This can't be undone."
            className="mt-4 rounded-3xl border-2 border-danger/40 bg-danger/5 p-4"
          >
            <p className="text-sm font-extrabold text-danger">Danger zone</p>
            <p className="mt-1 text-sm font-semibold text-muted">
              Removes the photo, its {captions.length} captions, all their votes, and the stored file.
            </p>
            <input type="hidden" name="id" value={image.id} />
            <div className="mt-3">
              <SubmitButton variant="danger" pendingLabel="Deleting…">
                Delete photo
              </SubmitButton>
            </div>
          </ActionForm>
        </aside>

        <section className="flex flex-col gap-4">
          {captions.map((caption) => {
            const voice = getVoice(caption.style);
            const t = tally.get(caption.id) ?? { up: 0, down: 0 };
            return (
              <article key={caption.id} className="rounded-3xl border-2 border-border bg-surface p-5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-muted">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <SubwayBullet line={voice?.line ?? "S"} size={22} />
                    {voice?.label ?? (caption.style === "manual" ? "Added by an admin" : caption.style)}
                  </span>
                  <span>{caption.model}</span>
                  <span>{timeAgo(caption.created_at)}</span>
                  <span className="ml-auto flex gap-2 text-xs font-black">
                    <span className="rounded-full bg-primary/15 px-2.5 py-1 text-primary">{t.up} up</span>
                    <span className="rounded-full bg-danger/15 px-2.5 py-1 text-danger">{t.down} down</span>
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-foreground">
                      score {caption.score}
                    </span>
                  </span>
                </div>

                <ActionForm action={updateCaption} className="mt-3">
                  <input type="hidden" name="id" value={caption.id} />
                  <label className="sr-only" htmlFor={`c-${caption.id}`}>Caption text</label>
                  <textarea
                    id={`c-${caption.id}`}
                    name="content"
                    defaultValue={caption.content}
                    rows={2}
                    maxLength={300}
                    className="w-full resize-y rounded-2xl border-2 border-border bg-background p-3 font-semibold focus-visible:border-blue"
                  />
                  <div className="mt-2">
                    <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
                  </div>
                </ActionForm>

                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                  <details className="min-w-0 flex-1 text-sm">
                    <summary className="cursor-pointer font-extrabold text-muted">Prompt used</summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-night p-3 text-xs leading-relaxed text-white">
                      {caption.prompt}
                    </pre>
                  </details>
                  <ActionForm action={deleteCaption} confirmMessage="Delete this caption and its votes?">
                    <input type="hidden" name="id" value={caption.id} />
                    <SubmitButton variant="secondary" pendingLabel="Deleting…">
                      Delete caption
                    </SubmitButton>
                  </ActionForm>
                </div>
              </article>
            );
          })}

          <ActionForm
            action={addCaption}
            className="rounded-3xl border-2 border-dashed border-border bg-surface p-5"
          >
            <h2 className="font-display text-lg font-black">Add a caption by hand</h2>
            <input type="hidden" name="imageId" value={image.id} />
            <textarea
              name="content"
              rows={2}
              maxLength={300}
              required
              placeholder="Write a caption…"
              aria-label="New caption text"
              className="mt-3 w-full resize-y rounded-2xl border-2 border-border bg-background p-3 font-semibold placeholder:text-muted focus-visible:border-blue"
            />
            <div className="mt-2">
              <SubmitButton pendingLabel="Adding…">Add caption</SubmitButton>
            </div>
          </ActionForm>
        </section>
      </div>
    </main>
  );
}
