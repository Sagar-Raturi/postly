"use client";

import * as React from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { parseApiErrors } from "@/lib/form-errors";
import { initials } from "@/lib/initials";
import { requestBlogRefresh } from "@/lib/request-blog-refresh";
import {
  ACCEPTED_AVATAR_TYPES,
  MAX_AVATAR_BYTES,
  removeAvatar,
  uploadAvatar,
} from "@/lib/api";

/**
 * The writer's picture, as shown on their public blog.
 *
 * It saves on its own rather than through the Save button next to it. A
 * file picker has no draft state — the moment a file is chosen there is
 * nothing left to decide, and leaving the change pending behind a button
 * would mean holding the bytes in memory to be sent later, then explaining
 * why the preview and the saved value disagree.
 *
 * Both endpoints answer with the whole account, so `applyUser` updates the
 * header avatar at the same time as this one.
 */
export function AvatarField() {
  const { user, applyUser } = useAuth();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState<"upload" | "remove" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!user) return null;

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    // Clearing the input is what makes picking the *same* file twice fire
    // a change event again — after a failed upload, that is exactly what
    // someone retrying will do.
    event.target.value = "";

    if (!file || busy) return;

    if (file.size > MAX_AVATAR_BYTES) {
      setError(
        `That image is ${megabytes(file.size)}MB. The limit is ${
          MAX_AVATAR_BYTES / (1024 * 1024)
        }MB.`,
      );
      return;
    }

    setBusy("upload");
    setError(null);
    try {
      applyUser(await uploadAvatar(file));
      requestBlogRefresh();
    } catch (err) {
      setError(message(err, "Could not upload that image."));
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (busy) return;

    setBusy("remove");
    setError(null);
    try {
      applyUser(await removeAvatar());
      requestBlogRefresh();
    } catch (err) {
      setError(message(err, "Could not remove your photo."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[0.85rem] font-medium">Photo</p>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          {user.avatar ? (
            <AvatarImage src={user.avatar} alt="" />
          ) : null}
          <AvatarFallback className="bg-brand/12 text-[1rem] font-medium text-brand">
            {initials(user.display_name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-full px-4"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            {busy === "upload" ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Upload aria-hidden className="size-3.5" />
            )}
            {user.avatar ? "Replace photo" : "Upload a photo"}
          </Button>

          {user.avatar ? (
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-full px-4 text-muted-foreground hover:text-destructive"
              disabled={busy !== null}
              onClick={handleRemove}
            >
              {busy === "remove" ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Trash2 aria-hidden className="size-3.5" />
              )}
              Remove
            </Button>
          ) : null}

          {/* Driven by the buttons above: a bare file input cannot be
              styled, and its "No file chosen" label is not the state this
              form is trying to show. */}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_AVATAR_TYPES}
            onChange={handleFile}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
          />
        </div>
      </div>

      <p className="text-[0.8rem] text-muted-foreground">
        JPEG, PNG or WebP, up to {MAX_AVATAR_BYTES / (1024 * 1024)}MB. Cropped
        to a square and resized for the web — readers never download the
        original.
      </p>

      {error ? (
        <p aria-live="polite" className="text-[0.8rem] font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * The one line to show under the buttons.
 *
 * `ApiError.detail` would prefix it with the field name — "avatar: That
 * file is not..." — which is the right shape for a form with several
 * inputs and wrong for a control that only has one.
 */
function message(error: unknown, fallback: string): string {
  const { fields, form } = parseApiErrors(error, fallback);
  return fields.avatar ?? form ?? fallback;
}
