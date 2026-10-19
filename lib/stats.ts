import type { SupabaseClient } from "@supabase/supabase-js";

export type Overview = {
  users: number;
  photos: number;
  captions: number;
  votes: number;
  upvotes: number;
  downvotes: number;
  votes_today: number;
  photos_today: number;
  active_7d: number;
  superadmins: number;
};

export type DailyRow = { day: string; photos: number; votes: number; signups: number };
export type HourRow = { hr: number; vote_total: number };
export type VoiceRow = {
  style_id: string;
  caption_count: number;
  photo_count: number;
  avg_score: number;
  vote_total: number;
  upvote_pct: number | null;
};
export type ModelRow = { model_name: string; caption_count: number };
export type DivisiveRow = {
  cap_id: string;
  img_id: string;
  caption_text: string;
  caption_score: number;
  ups: number;
  downs: number;
};
export type AdminUser = {
  uid: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  superadmin: boolean;
  joined_at: string;
  last_seen_at: string | null;
  photos: number;
  votes_cast: number;
  votes_received: number;
};

function unwrap<T>(label: string, result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

export async function getOverviewData(supabase: SupabaseClient) {
  const [overview, daily, hourly, voices, models, divisive, users, best] =
    await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.rpc("admin_daily", { p_days: 14 }),
      supabase.rpc("admin_hourly"),
      supabase.rpc("admin_voices"),
      supabase.rpc("admin_models"),
      supabase.rpc("admin_divisive", { p_limit: 3 }),
      supabase.rpc("admin_users"),
      supabase
        .from("captions")
        .select("id, content, score, vote_count, style, image_id")
        .gt("vote_count", 0)
        .order("score", { ascending: false })
        .limit(1),
    ]);

  return {
    overview: unwrap<Overview>("overview", overview),
    daily: unwrap<DailyRow[]>("daily", daily),
    hourly: unwrap<HourRow[]>("hourly", hourly),
    voices: unwrap<VoiceRow[]>("voices", voices),
    models: unwrap<ModelRow[]>("models", models),
    divisive: unwrap<DivisiveRow[]>("divisive", divisive),
    users: unwrap<AdminUser[]>("users", users),
    best: ((best.data ?? [])[0] ?? null) as {
      id: string;
      content: string;
      score: number;
      vote_count: number;
      style: string;
      image_id: string;
    } | null,
  };
}

export function displayName(user: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
  return name || user.email || "Unknown";
}
