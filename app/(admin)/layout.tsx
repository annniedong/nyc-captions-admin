import { Avatar } from "@/components/avatar";
import { AdminNav } from "@/components/admin-nav";
import { Logo } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { supabase, user } = await requireAdmin();
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const name = profile?.first_name ?? user.email ?? "Admin";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col bg-night p-5 text-white md:flex">
        <div className="sticky top-5 flex h-[calc(100vh-2.5rem)] flex-col">
          <Logo inverted />
          <div className="mt-8">
            <AdminNav layout="sidebar" />
          </div>
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-white/10 p-3">
            <Avatar url={profile?.avatar_url} name={name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{name}</p>
              <p className="truncate text-xs font-semibold text-white/60">
                {user.email}
              </p>
            </div>
          </div>
          <div className="mt-3 flex justify-center">
            <SignOutButton className="text-sm font-bold text-white/60 hover:text-white" />
          </div>
        </div>
      </aside>

      <header className="bg-night p-4 text-white md:hidden">
        <div className="flex items-center justify-between">
          <Logo inverted />
          <SignOutButton className="text-sm font-bold text-white/70" />
        </div>
        <div className="mt-3">
          <AdminNav layout="bar" />
        </div>
      </header>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
