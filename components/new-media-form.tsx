"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { createMedia } from "@/app/(admin)/media/actions";
import { CameraIcon } from "@/components/icons";
import { SubwayBullet } from "@/components/subway-bullet";
import { buttonClass } from "@/lib/ui";
import type { Voice } from "@/lib/voices";

const MAX_DIMENSION = 1280;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not process image");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function NewMediaForm({ voices }: { voices: Voice[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState(voices[0].id);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function onFile(selected: File | null) {
    if (selected && !ALLOWED.includes(selected.type)) {
      setError("Photos must be JPEG, PNG, or WebP.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
    setError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a photo first.");
      return;
    }
    setError(null);
    setBusy(true);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("photo", await downscale(file));
        formData.set("voice", voiceId);
        const result = await createMedia(formData);
        if ("error" in result) {
          setError(result.error);
          setBusy(false);
          return;
        }
        router.push(`/media/${result.id}`);
      } catch {
        setError("Something went wrong. Try again.");
        setBusy(false);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-8">
      <section>
        <h2 className="mb-3 font-display text-xl font-black">1. Photo</h2>
        <input
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        {preview ? (
          <div className="relative overflow-hidden rounded-3xl border-2 border-border bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview" className="mx-auto max-h-80 w-full object-contain" />
            {!busy && (
              <label htmlFor="photo" className={`${buttonClass("secondary")} absolute right-3 top-3 cursor-pointer`}>
                Change
              </label>
            )}
          </div>
        ) : (
          <label
            htmlFor="photo"
            className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border bg-surface p-10 text-center transition-colors hover:border-blue hover:bg-blue/5"
          >
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue/10 text-blue">
              <CameraIcon className="h-7 w-7" />
            </span>
            <span className="text-lg font-black">Choose a photo</span>
            <span className="text-sm font-semibold text-muted">JPEG, PNG, or WebP</span>
          </label>
        )}
      </section>

      <fieldset disabled={busy}>
        <legend className="mb-3 font-display text-xl font-black">2. Voice</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {voices.map((v) => {
            const selected = voiceId === v.id;
            return (
              <label
                key={v.id}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-4 transition-all ${
                  selected
                    ? "border-blue bg-blue/10 shadow-[0_4px_0_var(--blue)]"
                    : "border-border bg-surface shadow-[0_4px_0_var(--border)] hover:bg-surface-2"
                }`}
              >
                <input
                  type="radio"
                  name="voice"
                  value={v.id}
                  checked={selected}
                  onChange={() => setVoiceId(v.id)}
                  className="sr-only"
                />
                <SubwayBullet line={v.line} size={38} />
                <span>
                  <span className="block font-extrabold">{v.label}</span>
                  <span className="block text-sm font-semibold text-muted">{v.blurb}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <button type="submit" disabled={busy} className={`${buttonClass("primary", "lg")} w-full`}>
          {busy ? "Gemini is writing captions…" : "Generate captions"}
        </button>
        {busy && (
          <p role="status" className="mt-3 text-center text-sm font-bold text-muted">
            This usually takes under 15 seconds.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-2xl border-2 border-danger/40 bg-danger/10 p-3 text-sm font-bold text-danger">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
