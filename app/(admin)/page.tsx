import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { DailyChart, HourChart, RatioBar } from "@/components/charts";
import { Pigeon } from "@/components/pigeon";
import { Panel, StatCard } from "@/components/stat-card";
import { SubwayBullet } from "@/components/subway-bullet";
import { requireAdmin } from "@/lib/admin";
import { displayName, getOverviewData } from "@/lib/stats";
import { photoUrl } from "@/lib/storage";
import { formatNyNow } from "@/lib/time";
import { getVoice } from "@/lib/voices";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

function voiceInfo(styleId: string) {
  const voice = getVoice(styleId);
  if (voice) return { label: voice.label, line: voice.line };
  return { label: styleId === "manual" ? "Added by an admin" : styleId, line: "S" };
}

export default async function OverviewPage() {
  const { supabase } = await requireAdmin();
  const data = await getOverviewData(supabase);
  const { overview: o } = data;

  const bestImage = data.best
    ? (
        await supabase
          .from("images")
          .select("storage_path")
          .eq("id", data.best.image_id)
          .maybeSingle()
      ).data
    : null;

  const topCreators = [...data.users]
    .filter((u) => u.photos > 0)
    .sort((a, b) => b.votes_received - a.votes_received || b.photos - a.photos)
    .slice(0, 5);
  const topVoters = [...data.users]
    .filter((u) => u.votes_cast > 0)
    .sort((a, b) => b.votes_cast - a.votes_cast)
    .slice(0, 5);

  const totalCaptions = Math.max(1, data.models.reduce((s, m) => s + m.caption_count, 0));
  const votesPerUser = o.users > 0 ? (o.votes / o.users).toFixed(1) : "0";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <header className="mb-8">
        <p className="text-xs font-black uppercase tracking-widest text-muted">
          {formatNyNow()} · New York time
        </p>
        <h1 className="mt-1 font-display text-4xl font-black tracking-tight sm:text-5xl">
          Control center
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Users" value={o.users} hint={`${o.active_7d} active this week`} accent="var(--blue)" />
        <StatCard label="Photos" value={o.photos} hint={`${o.photos_today} today`} />
        <StatCard label="Captions" value={o.captions} hint={`${o.photos ? (o.captions / o.photos).toFixed(1) : 0} per photo`} />
        <StatCard label="Votes" value={o.votes} hint={`${o.votes_today} today`} accent="var(--primary)" />
        <StatCard label="Votes per user" value={votesPerUser} hint="Average engagement" />
        <StatCard label="Admins" value={o.superadmins} hint="Superadmin accounts" accent="var(--orange)" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Last 14 days" subtitle="Votes, photos, and new sign-ups per day (New York time)">
          <DailyChart rows={data.daily} />
        </Panel>
        <Panel title="Mood of the city" subtitle="Upvotes against downvotes">
          <RatioBar up={o.upvotes} down={o.downvotes} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Which line wins?" subtitle="Caption voices ranked by average score">
          {data.voices.length === 0 ? (
            <p className="font-semibold text-muted">No captions yet.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {data.voices.map((v, i) => {
                const info = voiceInfo(v.style_id);
                return (
                  <li key={v.style_id} className="flex items-center gap-3">
                    <span className="w-5 text-center text-sm font-black text-muted">{i + 1}</span>
                    <SubwayBullet line={info.line} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-extrabold">{info.label}</p>
                        <p className="shrink-0 font-display text-lg font-black">
                          {v.avg_score > 0 ? "+" : ""}
                          {v.avg_score}
                          <span className="ml-1 text-xs font-bold text-muted">avg</span>
                        </p>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${v.upvote_pct ?? 0}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs font-bold text-muted">
                        {v.photo_count} photos · {v.caption_count} captions · {v.vote_total} votes
                        {v.upvote_pct !== null ? ` · ${v.upvote_pct}% upvoted` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>

        <Panel title="When does New York vote?" subtitle="Votes by hour of day">
          <HourChart rows={data.hourly} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Funniest caption ever" subtitle="Highest score across all captions">
          {data.best ? (
            <Link href={`/media/${data.best.image_id}`} className="flex gap-4 rounded-2xl transition-colors hover:bg-surface-2">
              {bestImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl(bestImage.storage_path)}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-2xl border-2 border-border object-cover"
                />
              )}
              <div>
                <p className="text-lg font-extrabold leading-snug">&ldquo;{data.best.content}&rdquo;</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-muted">
                  <SubwayBullet line={voiceInfo(data.best.style).line} size={20} />
                  {voiceInfo(data.best.style).label}
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-black text-primary">
                    +{data.best.score} from {data.best.vote_count} votes
                  </span>
                </p>
              </div>
            </Link>
          ) : (
            <p className="font-semibold text-muted">No votes yet.</p>
          )}
        </Panel>

        <Panel title="Most divisive" subtitle="Captions whose upvotes and downvotes cancel out">
          {data.divisive.length === 0 ? (
            <div className="flex items-center gap-3">
              <Pigeon size={56} bobbing={false} />
              <p className="font-semibold text-muted">
                Nothing divisive yet. A caption needs both an upvote and a downvote.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {data.divisive.map((c) => (
                <li key={c.cap_id}>
                  <Link href={`/media/${c.img_id}`} className="block rounded-2xl p-2 transition-colors hover:bg-surface-2">
                    <p className="font-bold leading-snug">&ldquo;{c.caption_text}&rdquo;</p>
                    <p className="mt-1 flex gap-3 text-xs font-extrabold">
                      <span className="text-primary">{c.ups} up</span>
                      <span className="text-danger">{c.downs} down</span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Top creators" subtitle="By votes received">
          <PeopleList
            empty="No photos yet."
            rows={topCreators.map((u) => ({
              id: u.uid,
              name: displayName(u),
              avatar: u.avatar_url,
              stat: `${u.votes_received} votes`,
              sub: `${u.photos} photos`,
            }))}
          />
        </Panel>
        <Panel title="Top voters" subtitle="By votes cast">
          <PeopleList
            empty="No votes yet."
            rows={topVoters.map((u) => ({
              id: u.uid,
              name: displayName(u),
              avatar: u.avatar_url,
              stat: `${u.votes_cast} votes`,
              sub: `${u.photos} photos`,
            }))}
          />
        </Panel>
        <Panel title="Which AI wrote it?" subtitle="Captions by Gemini model">
          <ul className="flex flex-col gap-3">
            {data.models.length === 0 && <li className="font-semibold text-muted">No captions yet.</li>}
            {data.models.map((m) => (
              <li key={m.model_name}>
                <div className="flex justify-between gap-2 text-sm font-extrabold">
                  <span className="truncate">{m.model_name}</span>
                  <span>{Math.round((m.caption_count / totalCaptions) * 100)}%</span>
                </div>
                <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-blue"
                    style={{ width: `${(m.caption_count / totalCaptions) * 100}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs font-bold text-muted">{m.caption_count} captions</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </main>
  );
}

function PeopleList({
  rows,
  empty,
}: {
  rows: { id: string; name: string; avatar: string | null; stat: string; sub: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="font-semibold text-muted">{empty}</p>;
  return (
    <ol className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <li key={row.id}>
          <Link href={`/users/${row.id}`} className="flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-surface-2">
            <span className="w-4 text-center text-sm font-black text-muted">{i + 1}</span>
            <Avatar url={row.avatar} name={row.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{row.name}</p>
              <p className="text-xs font-bold text-muted">{row.sub}</p>
            </div>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-black">{row.stat}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
