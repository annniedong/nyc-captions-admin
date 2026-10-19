import { redirect } from "next/navigation";
import { Pigeon } from "@/components/pigeon";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/lib/ui";

export const metadata = { title: "Access denied" };

// Shown to signed-in people who are not superadmins. It reveals nothing but
// their own identity, and doubles as the answer to "how do I unlock myself":
// the owner promotes their own row from the Supabase SQL Editor.
export default async function DeniedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (isSuperadmin === true) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] border-2 border-border bg-surface p-8 text-center">
        <div className="flex justify-center">
          <Pigeon size={110} />
        </div>
        <h1 className="mt-2 font-display text-4xl font-black tracking-tight">
          Access denied
        </h1>
        <p className="mt-2 font-semibold text-muted">
          You&apos;re signed in as{" "}
          <span className="font-extrabold text-foreground">{user.email}</span>,
          but that account isn&apos;t an admin.
        </p>

        <details className="mt-6 rounded-2xl border-2 border-border bg-background p-4 text-left">
          <summary className="cursor-pointer text-sm font-extrabold">
            I own this project
          </summary>
          <p className="mt-3 text-sm font-semibold text-muted">
            Admin access is a flag in the database that this app can&apos;t
            change from the outside. Grant it to yourself in the Supabase SQL
            Editor:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-night p-3 text-xs leading-relaxed text-white">
{`update public.profiles
set is_superadmin = true
where id = '${user.id}';`}
          </pre>
        </details>

        <div className="mt-6 flex justify-center">
          <SignOutButton className={buttonClass("secondary")} />
        </div>
      </div>
    </main>
  );
}
