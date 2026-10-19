import Link from "next/link";
import { NewMediaForm } from "@/components/new-media-form";
import { requireAdmin } from "@/lib/admin";
import { VOICES } from "@/lib/voices";

export const maxDuration = 60;
export const metadata = { title: "New AI post" };

export default async function NewMediaPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/media" className="text-sm font-extrabold uppercase tracking-wide text-blue hover:underline">
        ← Back to media
      </Link>
      <h1 className="mb-8 mt-3 font-display text-4xl font-black tracking-tight">New AI post</h1>
      <NewMediaForm voices={VOICES} />
    </main>
  );
}
