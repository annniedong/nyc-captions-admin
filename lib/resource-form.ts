import type { SupabaseClient } from "@supabase/supabase-js";
import type { Field, Resource, Row } from "@/lib/resources";

// Validation lives on the server and mirrors the database's own checks, so a bad
// value gets a friendly message here and is still refused by Postgres if this is bypassed.

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DOMAIN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const SLUG = /^[a-z0-9-]+$/;
export const ID = /^\d{1,15}$/;

export type Parsed = { values: Record<string, unknown> } | { error: string };

function parseField(field: Field, raw: FormDataEntryValue | null): { value: unknown } | { error: string } {
  if (field.type === "boolean") return { value: raw === "on" || raw === "true" };

  const text = typeof raw === "string" ? raw.trim() : "";
  if (text === "") {
    if (field.required) return { error: `${field.label} is required.` };
    return { value: null };
  }
  if (field.maxLength && text.length > field.maxLength) {
    return { error: `${field.label} must be ${field.maxLength} characters or fewer.` };
  }

  switch (field.type) {
    case "number": {
      const n = Number(text);
      if (!Number.isInteger(n)) return { error: `${field.label} must be a whole number.` };
      if (field.min !== undefined && n < field.min) return { error: `${field.label} must be at least ${field.min}.` };
      if (field.max !== undefined && n > field.max) return { error: `${field.label} must be at most ${field.max}.` };
      return { value: n };
    }
    case "email": {
      const email = text.toLowerCase();
      return EMAIL.test(email) ? { value: email } : { error: "Enter a valid email address." };
    }
    case "domain": {
      const domain = text.toLowerCase().replace(/^@/, "");
      return DOMAIN.test(domain) ? { value: domain } : { error: "Enter a domain like columbia.edu (no @ or spaces)." };
    }
    case "slug": {
      const slug = text.toLowerCase();
      return SLUG.test(slug) ? { value: slug } : { error: `${field.label} can only use lowercase letters, numbers, and dashes.` };
    }
    case "url": {
      try {
        const url = new URL(text);
        if (url.protocol !== "https:") throw new Error("not https");
        return { value: url.toString().replace(/\/$/, "") };
      } catch {
        return { error: `${field.label} must be a full https:// address.` };
      }
    }
    case "fk":
      return ID.test(text) ? { value: Number(text) } : { error: `Choose a valid ${field.label.toLowerCase()}.` };
    default:
      return { value: text };
  }
}

// Only fields declared in the registry are ever read from the form, so extra
// form keys (is_superadmin, id, created_at, anything) can't reach the database.
export function parseForm(resource: Resource, formData: FormData): Parsed {
  const values: Record<string, unknown> = {};
  for (const field of resource.fields) {
    const result = parseField(field, formData.get(field.name));
    if ("error" in result) return { error: result.error };
    values[field.name] = result.value;
  }
  return { values };
}

export function friendlyError(error: { code?: string; message: string }, resource: Resource): string {
  switch (error.code) {
    case "23505":
      return `That ${resource.singular} already exists (or its order/name is already taken).`;
    case "23503":
      return `Other records still depend on this ${resource.singular}, so that isn't possible yet.`;
    case "23514":
    case "22P02":
    case "22003":
      return "One of the values isn't allowed. Check the fields and try again.";
    case "42501":
      return "You don't have permission to do that.";
    default:
      return `Couldn't save: ${error.message}`;
  }
}

export type FkOptions = Record<string, { value: string; label: string }[]>;

export async function loadFkOptions(supabase: SupabaseClient, fields: Field[]): Promise<FkOptions> {
  const options: FkOptions = {};
  await Promise.all(
    fields
      .filter((f) => f.type === "fk" && f.ref)
      .map(async (f) => {
        const ref = f.ref!;
        const { data } = await supabase.from(ref.table).select(`${ref.value}, ${ref.label}`).order(ref.value);
        options[f.name] = ((data ?? []) as unknown as Row[]).map((row) => ({
          value: String(row[ref.value]),
          label: String(row[ref.label]),
        }));
      }),
  );
  return options;
}
