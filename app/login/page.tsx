import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { Logo } from "@/components/logo";
import { ShieldIcon } from "@/components/icons";

export const metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-night bg-subway-tiles px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border-2 border-white/10 bg-surface p-8 text-center shadow-2xl">
        <div className="flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mt-6 grid h-14 w-14 place-items-center rounded-2xl bg-blue/10 text-blue">
          <ShieldIcon className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-black tracking-tight">
          Admin sign-in
        </h1>
        <p className="mt-2 font-semibold text-muted">
          This area is for authorized admins only. Sign in with the Google
          account that has been granted access.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-2xl border-2 border-danger/40 bg-danger/10 p-3 text-sm font-bold text-danger"
          >
            Sign-in didn&apos;t finish. Please try again.
          </p>
        )}

        <div className="mt-6">
          <GoogleSignInButton />
        </div>
      </div>
    </main>
  );
}
