import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ActiveBadge, Badge } from "@/components/badge";
import { SubwayBullet } from "@/components/subway-bullet";
import { timeAgo } from "@/lib/time";

// Every table the generic CRUD engine may touch is listed here, and ONLY these.
// The URL segment is looked up in this registry; it is never used as a table name.

export type Row = Record<string, unknown>;
export type Ctx = Record<string, unknown>;

export type FieldType =
  | "text" | "textarea" | "number" | "boolean" | "email" | "domain" | "slug" | "url" | "fk";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  ref?: { table: string; value: string; label: string; nullLabel?: string };
};

export type Column = {
  label: string;
  align?: "right";
  cell: (row: Row, ctx: Ctx) => React.ReactNode;
};

export type Related = {
  title: string;
  resource: string;
  fk: string;
  mode: "cards" | "table";
};

export type Resource = {
  key: string;
  table: string;
  pk: string;
  group: "pipeline" | "activity" | "access";
  title: string;
  singular: string;
  description: string;
  icon: "chain" | "steps" | "mix" | "terms" | "examples" | "provider" | "model" | "request" | "response" | "domain" | "email";
  can: { create?: boolean; update?: boolean; delete?: boolean };
  select: string;
  order: { column: string; ascending: boolean }[];
  searchColumns?: string[];
  fields: Field[];
  columns: Column[];
  detail?: (row: Row, ctx: Ctx) => { label: string; value: React.ReactNode }[];
  card?: (row: Row) => React.ReactNode;
  related?: Related[];
  loadContext?: (supabase: SupabaseClient, rows: Row[]) => Promise<Ctx>;
  hasGate?: boolean;
};

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

type ChainRef = { label: string; slug: string; subway_line: string } | null;
const chainOf = (row: Row) => row.prompt_chains as ChainRef;

function ChainCell({ chain, fallback = "All chains" }: { chain: ChainRef; fallback?: string }) {
  if (!chain) return <span className="font-bold text-muted">{fallback}</span>;
  return (
    <span className="flex items-center gap-2 font-extrabold">
      <SubwayBullet line={chain.subway_line ?? "S"} size={22} />
      {chain.label}
    </span>
  );
}

const excerpt = (v: unknown, n = 90) => {
  const t = str(v).replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
};

const chainFk = (nullLabel?: string): Field["ref"] => ({
  table: "prompt_chains", value: "id", label: "label", nullLabel,
});

export const RESOURCES: Resource[] = [
  {
    key: "chains", table: "prompt_chains", pk: "id", group: "pipeline", icon: "chain",
    title: "Prompt chains", singular: "prompt chain",
    description: "Each caption voice is a prompt chain: a named, ordered set of prompt steps. Read-only here; chains are defined in migrations.",
    can: {},
    select: "id, slug, label, description, subway_line, is_active, created_at, prompt_chain_steps(count)",
    order: [{ column: "id", ascending: true }],
    searchColumns: ["label", "slug"],
    fields: [],
    columns: [
      { label: "Chain", cell: (r) => (
        <span className="flex items-center gap-3">
          <SubwayBullet line={str(r.subway_line)} size={30} />
          <span><span className="block font-extrabold">{str(r.label)}</span><span className="block text-xs font-bold text-muted">{str(r.slug)}</span></span>
        </span>) },
      { label: "Description", cell: (r) => <span className="font-semibold text-muted">{str(r.description)}</span> },
      { label: "Steps", align: "right", cell: (r) => <span className="font-black tabular-nums">{num((r.prompt_chain_steps as { count: number }[] | null)?.[0]?.count)}</span> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
    detail: (r) => [
      { label: "Slug", value: str(r.slug) },
      { label: "Label", value: str(r.label) },
      { label: "Description", value: str(r.description) || "None" },
      { label: "Subway line", value: <SubwayBullet line={str(r.subway_line)} size={26} /> },
      { label: "Status", value: <ActiveBadge active={r.is_active} /> },
      { label: "Created", value: timeAgo(str(r.created_at)) },
    ],
    related: [
      { title: "Steps (in order)", resource: "steps", fk: "chain_id", mode: "cards" },
      { title: "Mix weight", resource: "mix", fk: "chain_id", mode: "table" },
      { title: "Examples", resource: "examples", fk: "chain_id", mode: "table" },
      { title: "Terms for this chain", resource: "terms", fk: "chain_id", mode: "table" },
    ],
  },
  {
    key: "steps", table: "prompt_chain_steps", pk: "id", group: "pipeline", icon: "steps",
    title: "Chain steps", singular: "chain step",
    description: "The ordered steps of every prompt chain. They are joined in order to build the prompt sent to the model. Read-only.",
    can: {},
    select: "id, chain_id, step_order, name, instruction, created_at, prompt_chains(label, slug, subway_line)",
    order: [{ column: "chain_id", ascending: true }, { column: "step_order", ascending: true }],
    searchColumns: ["name", "instruction"],
    fields: [],
    columns: [
      { label: "Chain", cell: (r) => <ChainCell chain={chainOf(r)} /> },
      { label: "Step", align: "right", cell: (r) => <span className="font-black tabular-nums">{num(r.step_order)}</span> },
      { label: "Name", cell: (r) => <span className="font-extrabold">{str(r.name)}</span> },
      { label: "Instruction", cell: (r) => <span className="font-semibold text-muted">{excerpt(r.instruction, 110)}</span> },
    ],
    detail: (r) => [
      { label: "Chain", value: <ChainCell chain={chainOf(r)} /> },
      { label: "Step order", value: String(num(r.step_order)) },
      { label: "Name", value: str(r.name) },
      { label: "Instruction", value: <pre className="whitespace-pre-wrap font-sans text-sm font-semibold">{str(r.instruction)}</pre> },
    ],
    card: (r) => (
      <div className="rounded-2xl border-2 border-border bg-background p-4">
        <p className="text-xs font-black uppercase tracking-wider text-muted">Step {num(r.step_order)} · {str(r.name)}</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm font-semibold">{str(r.instruction)}</pre>
      </div>
    ),
  },
  {
    key: "mix", table: "prompt_chain_mix", pk: "chain_id", group: "pipeline", icon: "mix",
    title: "Chain mix", singular: "mix weight",
    description: "How often “Surprise me” picks each chain. Weights are relative: 0 turns a chain off for Surprise me.",
    can: { update: true },
    select: "chain_id, weight, updated_at, prompt_chains(label, slug, subway_line)",
    order: [{ column: "chain_id", ascending: true }],
    fields: [
      { name: "weight", label: "Weight", type: "number", required: true, min: 0, max: 100, help: "0 to 100. Relative to the other chains." },
    ],
    loadContext: async (supabase) => {
      const { data } = await supabase.from("prompt_chain_mix").select("weight");
      return { totalWeight: (data ?? []).reduce((n, r) => n + num(r.weight), 0) };
    },
    detail: (r) => [{ label: "Chain", value: <ChainCell chain={chainOf(r)} /> }],
    columns: [
      { label: "Chain", cell: (r) => <ChainCell chain={chainOf(r)} /> },
      { label: "Weight", align: "right", cell: (r) => <span className="font-black tabular-nums">{num(r.weight)}</span> },
      { label: "Share of Surprise me", cell: (r, ctx) => {
        const total = num(ctx.totalWeight);
        const pct = total > 0 ? Math.round((num(r.weight) / total) * 100) : 0;
        return (
          <span className="flex items-center gap-3">
            <span className="h-2.5 w-28 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></span>
            <span className="text-sm font-black tabular-nums">{pct}%</span>
          </span>);
      } },
      { label: "Updated", cell: (r) => <span className="font-semibold text-muted">{timeAgo(str(r.updated_at))}</span> },
    ],
  },
  {
    key: "terms", table: "terms", pk: "id", group: "pipeline", icon: "terms",
    title: "Terms", singular: "term",
    description: "NYC vocabulary added to prompts so captions can reference it naturally. Leave the chain empty to use a term everywhere.",
    can: { create: true, update: true, delete: true },
    select: "id, term, definition, chain_id, is_active, created_at, prompt_chains(label, slug, subway_line)",
    order: [{ column: "term", ascending: true }],
    searchColumns: ["term", "definition"],
    fields: [
      { name: "term", label: "Term", type: "text", required: true, maxLength: 80, placeholder: "Bodega" },
      { name: "definition", label: "Definition", type: "textarea", required: true, maxLength: 400, placeholder: "A corner store, usually with a cat in charge." },
      { name: "chain_id", label: "Chain", type: "fk", ref: chainFk("All chains"), help: "Only used for this chain. Leave on “All chains” to use it everywhere." },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true, help: "Inactive terms are not added to prompts." },
    ],
    columns: [
      { label: "Term", cell: (r) => <span className="font-extrabold">{str(r.term)}</span> },
      { label: "Definition", cell: (r) => <span className="font-semibold text-muted">{excerpt(r.definition, 100)}</span> },
      { label: "Chain", cell: (r) => <ChainCell chain={chainOf(r)} /> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
  },
  {
    key: "examples", table: "generation_examples", pk: "id", group: "pipeline", icon: "examples",
    title: "AI generation examples", singular: "example",
    description: "Few-shot examples added to prompts: a described photo and the captions that suit it. Leave the chain empty to use an example everywhere.",
    can: { create: true, update: true, delete: true },
    select: "id, chain_id, image_description, example_captions, is_active, created_at, prompt_chains(label, slug, subway_line)",
    order: [{ column: "id", ascending: true }],
    searchColumns: ["image_description", "example_captions"],
    fields: [
      { name: "chain_id", label: "Chain", type: "fk", ref: chainFk("All chains") },
      { name: "image_description", label: "Photo shows", type: "textarea", required: true, maxLength: 300, placeholder: "A pigeon eating a pizza crust on the sidewalk" },
      { name: "example_captions", label: "Example captions", type: "textarea", required: true, maxLength: 800, help: "One caption per line.", placeholder: "My city. My crust. Back up." },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: [
      { label: "Chain", cell: (r) => <ChainCell chain={chainOf(r)} /> },
      { label: "Photo shows", cell: (r) => <span className="font-extrabold">{excerpt(r.image_description, 70)}</span> },
      { label: "Captions", cell: (r) => <span className="font-semibold text-muted">{excerpt(str(r.example_captions).split("\n")[0], 70)}</span> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
  },
  {
    key: "providers", table: "llm_providers", pk: "id", group: "pipeline", icon: "provider",
    title: "LLM providers", singular: "provider",
    description: "Companies that host the language models. The public app currently calls providers with the slug “google”.",
    can: { create: true, update: true, delete: true },
    select: "id, slug, name, api_base_url, is_active, created_at, llm_models(count)",
    order: [{ column: "id", ascending: true }],
    searchColumns: ["name", "slug"],
    fields: [
      { name: "name", label: "Name", type: "text", required: true, maxLength: 80, placeholder: "Google (Gemini API)" },
      { name: "slug", label: "Slug", type: "slug", required: true, maxLength: 40, placeholder: "google", help: "Lowercase letters, numbers, and dashes." },
      { name: "api_base_url", label: "API base URL", type: "url", maxLength: 200, placeholder: "https://generativelanguage.googleapis.com", help: "Optional. Must start with https://. Never put an API key here." },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: [
      { label: "Provider", cell: (r) => <span className="font-extrabold">{str(r.name)}</span> },
      { label: "Slug", cell: (r) => <code className="text-sm font-bold text-muted">{str(r.slug)}</code> },
      { label: "Models", align: "right", cell: (r) => <span className="font-black tabular-nums">{num((r.llm_models as { count: number }[] | null)?.[0]?.count)}</span> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
    related: [{ title: "Models from this provider", resource: "models", fk: "provider_id", mode: "table" }],
  },
  {
    key: "models", table: "llm_models", pk: "id", group: "pipeline", icon: "model",
    title: "LLM models", singular: "model",
    description: "The models the public app tries, in priority order (lowest first). If one is busy or slow, the next is used.",
    can: { create: true, update: true, delete: true },
    select: "id, provider_id, model_code, display_name, priority, timeout_ms, is_active, created_at, llm_providers(name, slug)",
    order: [{ column: "priority", ascending: true }],
    searchColumns: ["model_code", "display_name"],
    fields: [
      { name: "provider_id", label: "Provider", type: "fk", required: true, ref: { table: "llm_providers", value: "id", label: "name" } },
      { name: "model_code", label: "Model code", type: "text", required: true, maxLength: 80, placeholder: "gemini-3.5-flash-lite", help: "Exactly as the provider names it." },
      { name: "display_name", label: "Display name", type: "text", required: true, maxLength: 80, placeholder: "Gemini 3.5 Flash-Lite" },
      { name: "priority", label: "Priority", type: "number", required: true, min: 1, max: 1000, defaultValue: 100, help: "Lowest number is tried first." },
      { name: "timeout_ms", label: "Timeout (ms)", type: "number", required: true, min: 1000, max: 60000, defaultValue: 10000, help: "1,000 to 60,000. Moves on to the next model after this long." },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: [
      { label: "Model", cell: (r) => (<span><span className="block font-extrabold">{str(r.display_name)}</span><code className="text-xs font-bold text-muted">{str(r.model_code)}</code></span>) },
      { label: "Provider", cell: (r) => <span className="font-bold">{(r.llm_providers as { name: string } | null)?.name ?? "?"}</span> },
      { label: "Priority", align: "right", cell: (r) => <span className="font-black tabular-nums">{num(r.priority)}</span> },
      { label: "Timeout", align: "right", cell: (r) => <span className="font-bold tabular-nums text-muted">{(num(r.timeout_ms) / 1000).toFixed(0)}s</span> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
  },
  {
    key: "requests", table: "generation_requests", pk: "id", group: "activity", icon: "request",
    title: "Generation requests", singular: "request",
    description: "Every time someone asks for captions. Read-only.",
    can: {},
    select: "id, user_id, image_id, chain_id, status, error, model_used, latency_ms, created_at, prompt_chains(label, slug, subway_line)",
    order: [{ column: "created_at", ascending: false }],
    fields: [],
    loadContext: async (supabase, rows) => {
      const ids = [...new Set(rows.map((r) => str(r.user_id)))];
      const { data } = ids.length ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids) : { data: [] };
      return { names: Object.fromEntries((data ?? []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown"])) };
    },
    columns: [
      { label: "When", cell: (r) => <span className="font-semibold text-muted">{timeAgo(str(r.created_at))}</span> },
      { label: "User", cell: (r, ctx) => <span className="font-bold">{(ctx.names as Record<string, string>)?.[str(r.user_id)] ?? "Unknown"}</span> },
      { label: "Chain", cell: (r) => <ChainCell chain={chainOf(r)} fallback="Unknown" /> },
      { label: "Status", cell: (r) => <Badge tone={r.status === "succeeded" ? "green" : r.status === "blocked" ? "yellow" : "red"}>{str(r.status)}</Badge> },
      { label: "Model", cell: (r) => <code className="text-xs font-bold text-muted">{str(r.model_used) || "none"}</code> },
      { label: "Latency", align: "right", cell: (r) => <span className="font-bold tabular-nums text-muted">{r.latency_ms == null ? "-" : `${(num(r.latency_ms) / 1000).toFixed(1)}s`}</span> },
    ],
    detail: (r, ctx) => [
      { label: "Request", value: `#${str(r.id)}` },
      { label: "When", value: new Date(str(r.created_at)).toLocaleString("en-US", { timeZone: "America/New_York" }) + " (New York)" },
      { label: "User", value: (ctx.names as Record<string, string>)?.[str(r.user_id)] ?? "Unknown" },
      { label: "Chain", value: <ChainCell chain={chainOf(r)} fallback="Unknown" /> },
      { label: "Status", value: <Badge tone={r.status === "succeeded" ? "green" : r.status === "blocked" ? "yellow" : "red"}>{str(r.status)}</Badge> },
      { label: "Model used", value: str(r.model_used) || "none" },
      { label: "Latency", value: r.latency_ms == null ? "-" : `${num(r.latency_ms)} ms` },
      { label: "Error", value: str(r.error) || "None" },
      { label: "Photo", value: r.image_id ? <Link href={`/media/${str(r.image_id)}`} className="font-extrabold text-blue hover:underline">Open the photo</Link> : "Not saved" },
    ],
    related: [{ title: "Model attempts", resource: "responses", fk: "request_id", mode: "table" }],
  },
  {
    key: "responses", table: "llm_responses", pk: "id", group: "activity", icon: "response",
    title: "LLM responses", singular: "response",
    description: "What each model attempt returned, including failures before a fallback succeeded. Read-only.",
    can: {},
    select: "id, request_id, model_code, provider_slug, status, http_status, latency_ms, response_text, created_at",
    order: [{ column: "created_at", ascending: false }],
    searchColumns: ["model_code", "response_text"],
    fields: [],
    columns: [
      { label: "When", cell: (r) => <span className="font-semibold text-muted">{timeAgo(str(r.created_at))}</span> },
      { label: "Request", cell: (r) => <Link href={`/data/requests/${str(r.request_id)}`} className="font-extrabold text-blue hover:underline" >#{str(r.request_id)}</Link> },
      { label: "Model", cell: (r) => <code className="text-xs font-bold">{str(r.model_code)}</code> },
      { label: "Result", cell: (r) => <Badge tone={r.status === "ok" ? "green" : "red"}>{str(r.status)}{r.http_status ? ` ${str(r.http_status)}` : ""}</Badge> },
      { label: "Latency", align: "right", cell: (r) => <span className="font-bold tabular-nums text-muted">{r.latency_ms == null ? "-" : `${(num(r.latency_ms) / 1000).toFixed(1)}s`}</span> },
      { label: "Response", cell: (r) => <span className="font-semibold text-muted">{excerpt(r.response_text, 80)}</span> },
    ],
    detail: (r) => [
      { label: "Response", value: `#${str(r.id)}` },
      { label: "Request", value: <Link href={`/data/requests/${str(r.request_id)}`} className="font-extrabold text-blue hover:underline">#{str(r.request_id)}</Link> },
      { label: "Model", value: str(r.model_code) },
      { label: "Provider", value: str(r.provider_slug) || "Unknown" },
      { label: "Result", value: <Badge tone={r.status === "ok" ? "green" : "red"}>{str(r.status)}</Badge> },
      { label: "HTTP status", value: r.http_status ? str(r.http_status) : "-" },
      { label: "Latency", value: r.latency_ms == null ? "-" : `${num(r.latency_ms)} ms` },
      { label: "Raw text", value: <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-night p-3 font-mono text-xs text-white">{str(r.response_text) || "(empty)"}</pre> },
    ],
  },
  {
    key: "domains", table: "allowed_signup_domains", pk: "id", group: "access", icon: "domain",
    title: "Allowed signup domains", singular: "domain",
    description: "Email domains allowed to sign in when the signup gate is on.",
    can: { create: true, update: true, delete: true },
    select: "id, domain, note, is_active, created_at",
    order: [{ column: "domain", ascending: true }],
    searchColumns: ["domain", "note"],
    hasGate: true,
    fields: [
      { name: "domain", label: "Domain", type: "domain", required: true, maxLength: 100, placeholder: "columbia.edu", help: "Just the part after the @, in lowercase." },
      { name: "note", label: "Note", type: "text", maxLength: 120, placeholder: "Columbia University" },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: [
      { label: "Domain", cell: (r) => <span className="font-extrabold">@{str(r.domain)}</span> },
      { label: "Note", cell: (r) => <span className="font-semibold text-muted">{str(r.note)}</span> },
      { label: "Added", cell: (r) => <span className="font-semibold text-muted">{timeAgo(str(r.created_at))}</span> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
  },
  {
    key: "emails", table: "whitelisted_emails", pk: "id", group: "access", icon: "email",
    title: "Whitelisted emails", singular: "email",
    description: "Individual addresses allowed to sign in when the signup gate is on, even if their domain isn't on the list.",
    can: { create: true, update: true, delete: true },
    select: "id, email, note, is_active, created_at",
    order: [{ column: "email", ascending: true }],
    searchColumns: ["email", "note"],
    hasGate: true,
    fields: [
      { name: "email", label: "Email address", type: "email", required: true, maxLength: 200, placeholder: "name@example.com" },
      { name: "note", label: "Note", type: "text", maxLength: 120, placeholder: "Product manager" },
      { name: "is_active", label: "Active", type: "boolean", defaultValue: true },
    ],
    columns: [
      { label: "Email", cell: (r) => <span className="font-extrabold">{str(r.email)}</span> },
      { label: "Note", cell: (r) => <span className="font-semibold text-muted">{str(r.note)}</span> },
      { label: "Added", cell: (r) => <span className="font-semibold text-muted">{timeAgo(str(r.created_at))}</span> },
      { label: "Status", cell: (r) => <ActiveBadge active={r.is_active} /> },
    ],
  },
];

export function getResource(key: string): Resource | undefined {
  return RESOURCES.find((r) => r.key === key);
}

export const GROUPS: { id: Resource["group"]; title: string }[] = [
  { id: "pipeline", title: "AI pipeline" },
  { id: "activity", title: "Activity" },
  { id: "access", title: "Access" },
];
