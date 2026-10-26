import Link from "next/link";
import { notFound } from "next/navigation";
import { Pagination } from "@/components/pagination";
import { ResourceTable } from "@/components/resource-table";
import { SignupGate } from "@/components/signup-gate";
import { SearchIcon, PlusIcon } from "@/components/icons";
import { requireAdmin } from "@/lib/admin";
import { first, hrefWith, pageNumber } from "@/lib/params";
import { getResource, type Row } from "@/lib/resources";
import { buttonClass } from "@/lib/ui";

const PAGE_SIZE = 25;

export async function generateMetadata(props: PageProps<"/data/[resource]">) {
  const { resource } = await props.params;
  return { title: getResource(resource)?.title ?? "Data" };
}

export default async function ResourceListPage(props: PageProps<"/data/[resource]">) {
  const { supabase } = await requireAdmin();
  const { resource: key } = await props.params;
  const resource = getResource(key);
  if (!resource) notFound();

  const params = await props.searchParams;
  // Only letters, numbers and a few safe symbols reach the filter string.
  const q = (first(params.q) ?? "").replace(/[^\p{L}\p{N}\s@.\-']/gu, "").trim().slice(0, 60);
  const page = pageNumber(params.page);

  let query = supabase.from(resource.table).select(resource.select, { count: "exact" });
  if (q && resource.searchColumns?.length) {
    query = query.or(resource.searchColumns.map((c) => `${c}.ilike.%${q}%`).join(","));
  }
  for (const o of resource.order) query = query.order(o.column, { ascending: o.ascending });
  const from = (page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(`${resource.key}: ${error.message}`);

  const rows = (data ?? []) as unknown as Row[];
  const ctx = (await resource.loadContext?.(supabase, rows)) ?? {};

  let gate: { enabled: boolean; domains: number; emails: number } | null = null;
  if (resource.hasGate) {
    const [{ data: setting }, { count: domains }, { count: emails }] = await Promise.all([
      supabase.from("app_settings").select("value").eq("key", "signup_gate_enabled").maybeSingle(),
      supabase.from("allowed_signup_domains").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("whitelisted_emails").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    gate = { enabled: setting?.value === "true", domains: domains ?? 0, emails: emails ?? 0 };
  }

  const base = `/data/${resource.key}`;
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-black tracking-tight">{resource.title}</h1>
          <p className="mt-1 max-w-2xl font-semibold text-muted">{resource.description}</p>
        </div>
        {resource.can.create && (
          <Link href={`${base}/new`} className={buttonClass("primary")}>
            <PlusIcon className="h-5 w-5" />
            New {resource.singular}
          </Link>
        )}
      </div>

      {gate && (
        <div className="mt-6">
          <SignupGate enabled={gate.enabled} activeDomains={gate.domains} activeEmails={gate.emails} />
        </div>
      )}

      {resource.searchColumns && (
        <form method="get" className="mb-5 mt-6 flex flex-wrap gap-3">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">Search {resource.title}</span>
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search"
              className="h-12 w-full rounded-2xl border-2 border-border bg-surface pl-12 pr-4 font-semibold placeholder:text-muted focus-visible:border-blue"
            />
          </label>
          <button type="submit" className={buttonClass("secondary")}>Search</button>
        </form>
      )}

      <div className={resource.searchColumns || gate ? "" : "mt-6"}>
        <ResourceTable
          resource={resource}
          rows={rows}
          ctx={ctx}
          empty={q ? "No matches for that search." : `No ${resource.title.toLowerCase()} yet.`}
        />
      </div>
      <Pagination
        page={page}
        total={count ?? rows.length}
        pageSize={PAGE_SIZE}
        hrefFor={(p) => hrefWith(base, { q, page: p })}
      />
    </main>
  );
}
