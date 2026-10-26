"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { CaptionError, generateCaptions } from "@/lib/gemini";
import { buildPrompt, getVoice } from "@/lib/voices";

export type ActionState = { error?: string; ok?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 2 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function validText(value: FormDataEntryValue | null): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length >= 1 && text.length <= 300 ? text : null;
}

function validId(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && UUID.test(value) ? value : null;
}

// CREATE: upload a photo and have Gemini write captions for it.
export async function createMedia(
  formData: FormData,
): Promise<{ id: string } | { error: string }> {
  const { supabase, user } = await requireAdmin();

  const photo = formData.get("photo");
  const voice = getVoice(String(formData.get("voice") ?? ""));
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Choose a photo first." };
  }
  if (!voice) return { error: "Pick a voice." };

  const extension = EXTENSIONS[photo.type];
  if (!extension) return { error: "Photos must be JPEG, PNG, or WebP." };
  if (photo.size > MAX_BYTES) return { error: "That photo is too large (2 MB max)." };

  const bytes = Buffer.from(await photo.arrayBuffer());
  const prompt = buildPrompt(voice);

  let result;
  try {
    result = await generateCaptions({ bytes, mimeType: photo.type, prompt });
  } catch (error) {
    if (error instanceof CaptionError && error.kind === "rate_limit") {
      return { error: "Gemini is busy right now. Try again in a minute." };
    }
    if (error instanceof CaptionError && error.kind === "not_configured") {
      return { error: "GEMINI_API_KEY isn't set for this app." };
    }
    return { error: "Couldn't generate captions. Try again." };
  }
  if (!result.safe || result.captions.length === 0) {
    return { error: "Gemini declined to caption that photo. Try another." };
  }

  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(storagePath, bytes, { contentType: photo.type });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: image, error: imageError } = await supabase
    .from("images")
    .insert({ user_id: user.id, storage_path: storagePath })
    .select("id")
    .single();
  if (imageError || !image) return { error: "Couldn't save the photo." };

  const { error: captionsError } = await supabase.from("captions").insert(
    result.captions.map((content) => ({
      image_id: image.id,
      created_by: user.id,
      content,
      style: voice.id,
      prompt,
      model: result.model,
    })),
  );
  if (captionsError) return { error: "Couldn't save the captions." };

  revalidatePath("/media");
  revalidatePath("/");
  return { id: image.id };
}

// UPDATE: swap the image file behind an existing photo. Captions and votes stay.
export async function replaceImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const id = validId(formData.get("id"));
  const photo = formData.get("photo");
  if (!id) return { error: "Invalid photo." };
  if (!(photo instanceof File) || photo.size === 0) return { error: "Choose a new photo first." };

  const extension = EXTENSIONS[photo.type];
  if (!extension) return { error: "Photos must be JPEG, PNG, or WebP." };
  if (photo.size > MAX_BYTES) return { error: "That photo is too large (2 MB max)." };

  const { data: image } = await supabase
    .from("images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!image) return { error: "That photo no longer exists." };

  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("photos")
    .upload(storagePath, Buffer.from(await photo.arrayBuffer()), { contentType: photo.type });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: updated, error } = await supabase
    .from("images")
    .update({ storage_path: storagePath })
    .eq("id", id)
    .select("id");
  if (error || !updated || updated.length === 0) {
    await supabase.storage.from("photos").remove([storagePath]);
    return { error: "Couldn't save the new photo." };
  }

  // The row points at the new file now; the old one is only clutter.
  const { data: removed, error: removeError } = await supabase.storage
    .from("photos")
    .remove([image.storage_path]);
  if (removeError || !removed || removed.length === 0) {
    console.error("Old photo file was not removed", image.storage_path, removeError);
  }

  revalidatePath(`/media/${id}`);
  revalidatePath("/media");
  return { ok: "Photo replaced" };
}

// CREATE: add a hand-written caption to an existing photo.
export async function addCaption(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, user } = await requireAdmin();
  const imageId = validId(formData.get("imageId"));
  const content = validText(formData.get("content"));
  if (!imageId) return { error: "Invalid photo." };
  if (!content) return { error: "Captions must be 1 to 300 characters." };

  const { error } = await supabase.from("captions").insert({
    image_id: imageId,
    created_by: user.id,
    content,
    style: "manual",
    prompt: "Written by hand in the admin panel",
    model: "manual",
  });
  if (error) return { error: "Couldn't add that caption." };

  revalidatePath(`/media/${imageId}`);
  revalidatePath("/media");
  return { ok: "Caption added" };
}

// UPDATE: edit a caption's text. Scores are derived from votes and can't be edited.
export async function updateCaption(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = validId(formData.get("id"));
  const content = validText(formData.get("content"));
  if (!id) return { error: "Invalid caption." };
  if (!content) return { error: "Captions must be 1 to 300 characters." };

  const { data, error } = await supabase
    .from("captions")
    .update({ content })
    .eq("id", id)
    .select("id, image_id");
  if (error || !data || data.length === 0) {
    return { error: "Couldn't save that change." };
  }

  revalidatePath(`/media/${data[0].image_id}`);
  revalidatePath("/media");
  return { ok: "Saved" };
}

// DELETE: remove one caption (and its votes).
export async function deleteCaption(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = validId(formData.get("id"));
  if (!id) return { error: "Invalid caption." };

  const { data, error } = await supabase
    .from("captions")
    .delete()
    .eq("id", id)
    .select("image_id");
  if (error || !data || data.length === 0) {
    return { error: "Couldn't delete that caption." };
  }

  revalidatePath(`/media/${data[0].image_id}`);
  revalidatePath("/media");
  return { ok: "Deleted" };
}

// DELETE: remove a whole photo, its captions, its votes, and the stored file.
export async function deleteImage(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = validId(formData.get("id"));
  if (!id) return { error: "Invalid photo." };

  const { data: image } = await supabase
    .from("images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!image) return { error: "That photo no longer exists." };

  const { data: removed, error } = await supabase
    .from("images")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || !removed || removed.length === 0) {
    return { error: "Couldn't delete that photo." };
  }

  // The row is already gone, so a leftover file is only clutter. But Storage
  // reports "nothing removed" as success, so check and log it rather than assume.
  const { data: removedFiles, error: removeError } = await supabase.storage
    .from("photos")
    .remove([image.storage_path]);
  if (removeError || !removedFiles || removedFiles.length === 0) {
    console.error("Photo file was not removed", image.storage_path, removeError);
  }

  revalidatePath("/media");
  revalidatePath("/");
  redirect("/media");
}
