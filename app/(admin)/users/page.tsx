import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { SearchIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin";
import { first, hrefWith } from "@/lib/params";
import { displayName, type AdminUser } from "@/lib/stats";
import { timeAgo } from "@/lib/time";
import { buttonClass } from "@/lib/ui";

export const metadata = { title: "Users" };

const SORTS = {
  joined: { label: "Newest", fn: (a: AdminUser, b: AdminUser) => b.joined_at.localeCompare(a.joined_at) },
  seen: { label: "Last seen", fn: (a: AdminUser, b: AdminUser) => (b.last_seen_at ?? "").localeCompare(a.last_seen_at ?? "") },
  cast: { label: "Votes cast", fn: (a: AdminUser, b: AdminUser) => b.votes_cast - a.votes_cast },
  received: { label: "Votes received", fn: (a: AdminUser, b: AdminUser) => b.votes_received - a.votes_received },
  photos: { label: "Photos", fn: (a: AdminUser, b: AdminUser) => b.photos - a.photos },
} as const;

type SortKey = keyof typeof SORTS;

export default async function UsersPage(props: PageProps<"/users">) {
  const { supabase } = await requireAdmin();
  const params = await props.searchParams;
  const q = (first(params.q) ?? "").trim().toLowerCase().slice(0, 80);
  const rawSort = first(params.sort);
  const sort: SortKey = rawSort && rawSort in SORTS ? (rawSort as SortKey) : "joined";

  const { data, error } = await supabase.rpc("admin_users");
  if (error) throw new Error(`users: ${error.message}`);

  const all = (data ?? []) as AdminUser[];
  const users = all
    .filter(
      (u) =>
        !q ||
        displayName(u).toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    )
    .sort(SORTS[sort].fn);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <h1 className="font-display text-4xl font-black tracking-tight">Users</h1>
      <p className="mt-1 font-semibold text-muted">
        {all.length} accounts. Read-only: profiles are edited by their owners.
      </p>

      <form method="get" className="mt-6 flex flex-wrap gap-3">
        <input type="hidden" name="sort" value={sort} />
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search users</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or email"
            className="h-12 w-full rounded-2xl border-2 border-border bg-surface pl-12 pr-4 font-semibold placeholder:text-muted focus-visible:border-blue"
          />
        </label>
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>

      <nav aria-label="Sort" className="mb-5 mt-4 flex flex-wrap gap-2">
        {(Object.keys(SORTS) as SortKey[]).map((key) => (
          <Link
            key={key}
            href={hrefWith("/users", { q, sort: key })}
            aria-current={key === sort ? "page" : undefined}
            className={`rounded-xl border-2 px-3.5 py-1.5 text-xs font-extrabold uppercase tracking-wide transition-colors ${
              key === sort
                ? "border-blue bg-blue/10 text-blue"
                : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {SORTS[key].label}
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-3xl border-2 border-border bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b-2 border-border text-xs font-black uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Last seen</th>
              <th className="px-4 py-3 text-right">Photos</th>
              <th className="px-4 py-3 text-right">Cast</th>
              <th className="px-4 py-3 text-right">Received</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center font-semibold text-muted">
                  No users match that search.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.uid} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="px-4 py-3">
                  <Link href={`/users/${u.uid}`} className="flex items-center gap-3">
                    <Avatar url={u.avatar_url} name={displayName(u)} size={36} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-extrabold">
                        {displayName(u)}
                        {u.superadmin && (
                          <span className="rounded-full bg-orange/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-orange">
                            Admin
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs font-semibold text-muted">{u.email}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold text-muted">{timeAgo(u.joined_at)}</td>
                <td className="px-4 py-3 font-semibold text-muted">
                  {u.last_seen_at ? timeAgo(u.last_seen_at) : "Never"}
                </td>
                <td className="px-4 py-3 text-right font-black tabular-nums">{u.photos}</td>
                <td className="px-4 py-3 text-right font-black tabular-nums">{u.votes_cast}</td>
                <td className="px-4 py-3 text-right font-black tabular-nums">{u.votes_received}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
