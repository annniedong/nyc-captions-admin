import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Call this at the top of EVERY page and EVERY server action. Layouts are not
// re-run on client-side navigation and actions are reachable by direct POST,
// so neither can be trusted to have been checked by something earlier.
export const requireAdmin = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (isSuperadmin !== true) redirect("/denied");

  return { supabase, user };
});
