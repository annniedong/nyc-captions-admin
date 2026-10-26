"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { friendlyError, ID, parseForm } from "@/lib/resource-form";
import { getResource } from "@/lib/resources";

export type ActionState = { error?: string; ok?: string };

// Every action re-checks the admin and looks the resource up in the registry.
// The key comes from the client, so an unknown key (or an operation the registry
// doesn't allow, e.g. deleting a step) is refused before any query is built.

export async function createRecord(key: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource || !resource.can.create) return { error: "That isn't allowed." };

  const parsed = parseForm(resource, formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from(resource.table).insert(parsed.values);
  if (error) return { error: friendlyError(error, resource) };

  revalidatePath(`/data/${key}`);
  revalidatePath("/");
  redirect(`/data/${key}`);
}

export async function updateRecord(key: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource || !resource.can.update || !ID.test(id)) return { error: "That isn't allowed." };

  const parsed = parseForm(resource, formData);
  if ("error" in parsed) return { error: parsed.error };

  const values = key === "mix" ? { ...parsed.values, updated_at: new Date().toISOString() } : parsed.values;
  const { data, error } = await supabase.from(resource.table).update(values).eq(resource.pk, Number(id)).select(resource.pk);
  if (error) return { error: friendlyError(error, resource) };
  if (!data || data.length === 0) return { error: "Nothing was changed. It may have been deleted." };

  revalidatePath(`/data/${key}`);
  revalidatePath(`/data/${key}/${id}`);
  return { ok: "Saved" };
}

export async function deleteRecord(key: string, id: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const resource = getResource(key);
  if (!resource || !resource.can.delete || !ID.test(id)) return { error: "That isn't allowed." };

  const { data, error } = await supabase.from(resource.table).delete().eq(resource.pk, Number(id)).select(resource.pk);
  if (error) return { error: friendlyError(error, resource) };
  if (!data || data.length === 0) return { error: "Nothing was deleted. It may already be gone." };

  revalidatePath(`/data/${key}`);
  revalidatePath("/");
  redirect(`/data/${key}`);
}

// The signup gate: when on, only whitelisted emails and allowed domains can sign in to the public app.
export async function setSignupGate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const enabled = formData.get("enabled") === "true";

  const { data, error } = await supabase
    .from("app_settings")
    .upsert({ key: "signup_gate_enabled", value: enabled ? "true" : "false", updated_at: new Date().toISOString() })
    .select("key");
  if (error || !data || data.length === 0) return { error: "Couldn't change the signup gate." };

  revalidatePath("/data/domains");
  revalidatePath("/data/emails");
  return { ok: enabled ? "Signup gate is on" : "Signup gate is off" };
}
