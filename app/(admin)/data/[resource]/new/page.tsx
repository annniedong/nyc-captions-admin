import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ResourceFields } from "@/components/resource-fields";
import { requireAdmin } from "@/lib/admin";
import { createRecord } from "@/lib/resource-actions";
import { loadFkOptions } from "@/lib/resource-form";
import { getResource } from "@/lib/resources";
import { buttonClass } from "@/lib/ui";

export async function generateMetadata(props: PageProps<"/data/[resource]/new">) {
  const { resource } = await props.params;
  return { title: `New ${getResource(resource)?.singular ?? "record"}` };
}

export default async function NewRecordPage(props: PageProps<"/data/[resource]/new">) {
  const { supabase } = await requireAdmin();
  const { resource: key } = await props.params;
  const resource = getResource(key);
  if (!resource || !resource.can.create) notFound();

  const options = await loadFkOptions(supabase, resource.fields);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href={`/data/${key}`} className="text-sm font-extrabold uppercase tracking-wide text-blue hover:underline">
        ← Back to {resource.title.toLowerCase()}
      </Link>
      <h1 className="mt-3 font-display text-4xl font-black tracking-tight">New {resource.singular}</h1>

      <ActionForm
        action={createRecord.bind(null, key)}
        className="mt-6 rounded-3xl border-2 border-border bg-surface p-5 sm:p-6"
      >
        <ResourceFields fields={resource.fields} options={options} />
        <div className="mt-6 flex gap-3">
          <SubmitButton pendingLabel="Creating…">Create {resource.singular}</SubmitButton>
          <Link href={`/data/${key}`} className={buttonClass("ghost")}>Cancel</Link>
        </div>
      </ActionForm>
    </main>
  );
}
