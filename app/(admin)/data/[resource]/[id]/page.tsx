import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Panel } from "@/components/stat-card";
import { ResourceFields } from "@/components/resource-fields";
import { ResourceTable } from "@/components/resource-table";
import { requireAdmin } from "@/lib/admin";
import { deleteRecord, updateRecord } from "@/lib/resource-actions";
import { ID, loadFkOptions } from "@/lib/resource-form";
import { getResource, type Row } from "@/lib/resources";

export async function generateMetadata(props: PageProps<"/data/[resource]/[id]">) {
  const { resource } = await props.params;
  return { title: getResource(resource)?.singular ?? "Record" };
}

export default async function RecordPage(props: PageProps<"/data/[resource]/[id]">) {
  const { supabase } = await requireAdmin();
  const { resource: key, id } = await props.params;
  const resource = getResource(key);
  if (!resource || !ID.test(id)) notFound();

  const { data } = await supabase
    .from(resource.table)
    .select(resource.select)
    .eq(resource.pk, Number(id))
    .maybeSingle();
  if (!data) notFound();
  const row = data as unknown as Row;
  const ctx = (await resource.loadContext?.(supabase, [row])) ?? {};
  const options = await loadFkOptions(supabase, resource.fields);

  const related = await Promise.all(
    (resource.related ?? []).map(async (rel) => {
      const target = getResource(rel.resource);
      if (!target) return null;
      let query = supabase.from(target.table).select(target.select).eq(rel.fk, Number(id));
      for (const o of target.order) query = query.order(o.column, { ascending: o.ascending });
      const { data: rows } = await query.limit(50);
      const list = (rows ?? []) as unknown as Row[];
      const relCtx = (await target.loadContext?.(supabase, list)) ?? {};
      return { rel, target, list, relCtx };
    }),
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href={`/data/${key}`} className="text-sm font-extrabold uppercase tracking-wide text-blue hover:underline">
        ← Back to {resource.title.toLowerCase()}
      </Link>
      <h1 className="mt-3 font-display text-4xl font-black capitalize tracking-tight">
        {resource.can.update ? "Edit" : "View"} {resource.singular}
      </h1>

      <div className="mt-6 grid gap-6">
        {resource.detail && (
          <Panel title="Details">
            <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              {resource.detail(row, ctx).map((item) => (
                <div key={item.label} className="contents">
                  <dt className="text-xs font-black uppercase tracking-wider text-muted">{item.label}</dt>
                  <dd className="min-w-0 break-words font-semibold">{item.value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        )}

        {resource.can.update && (
          <ActionForm
            action={updateRecord.bind(null, key, id)}
            className="rounded-3xl border-2 border-border bg-surface p-5 sm:p-6"
          >
            <ResourceFields fields={resource.fields} row={row} options={options} />
            <div className="mt-6">
              <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            </div>
          </ActionForm>
        )}

        {related.map(
          (item) =>
            item && (
              <section key={item.rel.title}>
                <h2 className="mb-3 font-display text-xl font-black">{item.rel.title}</h2>
                {item.rel.mode === "cards" ? (
                  <div className="grid gap-3">
                    {item.list.length === 0 && <p className="font-semibold text-muted">None yet.</p>}
                    {item.list.map((r) => (
                      <div key={String(r[item.target.pk])}>{item.target.card?.(r)}</div>
                    ))}
                  </div>
                ) : (
                  <ResourceTable resource={item.target} rows={item.list} ctx={item.relCtx} />
                )}
              </section>
            ),
        )}

        {resource.can.delete && (
          <Panel title="Delete" subtitle={`Permanently remove this ${resource.singular}. This can't be undone.`}>
            <ActionForm
              action={deleteRecord.bind(null, key, id)}
              confirmMessage={`Delete this ${resource.singular}? This can't be undone.`}
            >
              <SubmitButton variant="danger" pendingLabel="Deleting…">
                Delete {resource.singular}
              </SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </main>
  );
}
