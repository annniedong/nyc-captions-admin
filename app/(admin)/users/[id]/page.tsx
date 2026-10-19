import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/admin";
import { displayName, type AdminUser } from "@/lib/stats";
import { photoUrl } from "@/lib/storage";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "User" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function UserDetailPage(props: PageProps<"/users/[id]">) {
  const { supabase } = await requireAdmin();
  const { id } = await props.params;
  if (!UUID.test(id)) notFound();

  const { data: all, error } = await supabase.rpc("admin_users");
  if (error) throw new Error(`users: ${error.message}`);
  const user = ((all ?? []) as AdminUser[]).find((u) => u.uid === id);
  if (!user) notFound();

  const [{ data: images }, { data: votes }] = await Promise.all([
    supabase
      .from("images")
      .select("id, storage_path, created_at, captions(score)")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("votes")
      .select("id, value, created_at, caption_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const captionIds = (votes ?? []).map((v) => v.caption_id);
  const { data: captions } = captionIds.length
    ? await supabase.from("captions").select("id, content, image_id").in("id", captionIds)
    : { data: [] as { id: string; content: string; image_id: string }[] };
  const captionMap = new Map((captions ?? []).map((c) => [c.id, c]));

  const name = displayName(user);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/users" className="text-sm font-extrabold uppercase tracking-wide text-blue hover:underline">
        ← Back to users
      </Link>

      <header className="mb-8 mt-4 flex flex-wrap items-center gap-5">
        <Avatar url={user.avatar_url} name={name} size={88} />
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">{name}</h1>
          <p className="mt-1 font-semibold text-muted">{user.email}</p>
          <p className="mt-1 break-all text-xs font-bold text-muted">{user.uid}</p>
          {user.superadmin && (
            <span className="mt-2 inline-block rounded-full bg-orange/20 px-3 py-1 text-xs font-black uppercase tracking-wider text-orange">
              Superadmin
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Photos" value={user.photos} />
        <StatCard label="Votes cast" value={user.votes_cast} accent="var(--primary)" />
        <StatCard label="Votes received" value={user.votes_received} accent="var(--blue)" />
        <StatCard
          label="Joined"
          value={timeAgo(user.joined_at)}
          hint={user.last_seen_at ? `Last seen ${timeAgo(user.last_seen_at)}` : "Never signed in"}
        />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-xl font-black">Photos</h2>
          {(images ?? []).length === 0 ? (
            <p className="font-semibold text-muted">No photos yet.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-3">
              {(images ?? []).map((image) => (
                <li key={image.id}>
                  <Link href={`/media/${image.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(image.storage_path)}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full rounded-2xl border-2 border-border object-cover transition-transform hover:-translate-y-1"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl font-black">Recent votes</h2>
          {(votes ?? []).length === 0 ? (
            <p className="font-semibold text-muted">No votes yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {(votes ?? []).map((vote) => {
                const caption = captionMap.get(vote.caption_id);
                return (
                  <li key={vote.id} className="flex items-start gap-3 rounded-2xl border-2 border-border bg-surface p-3">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${
                        vote.value === 1 ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {vote.value === 1 ? "Up" : "Down"}
                    </span>
                    <div className="min-w-0 flex-1">
                      {caption ? (
                        <Link href={`/media/${caption.image_id}`} className="line-clamp-2 text-sm font-bold hover:underline">
                          {caption.content}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-muted">Deleted caption</span>
                      )}
                      <p className="text-xs font-bold text-muted">{timeAgo(vote.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
