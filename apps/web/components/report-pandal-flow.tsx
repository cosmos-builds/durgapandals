"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, useToast } from "@durgapandals/ui";
import {
  sendVerificationCode,
  verifyCode,
  submitPandal,
  uploadPhoto,
  deletePhoto,
  type UploadedPhoto,
} from "@/lib/api";
import { MobileHeader } from "./mobile-header";

const REQUIRE_VERIFICATION = process.env.NEXT_PUBLIC_REQUIRE_CONTRIBUTOR_VERIFICATION === "true";

const MAX_PHOTOS = 3;
const MAX_PHOTO_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const CATEGORY_OPTIONS = [
  { value: "OUTDATED_INFO", label: "Info is outdated (theme, timings, contact…)" },
  { value: "WRONG_LOCATION", label: "The pin/address is wrong" },
  { value: "PERMANENTLY_CLOSED", label: "This pandal no longer exists" },
  { value: "DUPLICATE", label: "This is a duplicate of another listing" },
  { value: "INAPPROPRIATE", label: "Inappropriate content or photos" },
  { value: "OTHER", label: "Something else" },
] as const;

export interface ReportPandalFlowProps {
  citySlug: string;
  cityName: string;
  cityId: string;
  activeFestivalYear: number;
  pandalId: string;
  pandalName: string;
}

// Replaces the old "It's mine" claim flow from Add Pandal (any anonymous
// visitor could claim any pandal and submit a bare category label with no
// real content — see add-pandal-flow.tsx's removed UPDATE_OPTIONS/It's-mine
// path). This is the one place a visitor can flag something about an
// *existing* pandal, and it actually captures what they mean — a category
// plus a real description an admin can act on — instead of a vague note.
// Reuses the same PandalSubmission review queue (type "REPORT") rather than
// a parallel schema/admin page, so it inherits rate-limiting, contributor
// blocking, and the existing admin review UI for free.
export function ReportPandalFlow({ citySlug, cityName, cityId, activeFestivalYear, pandalId, pandalName }: ReportPandalFlowProps) {
  const router = useRouter();
  const toast = useToast();
  const [category, setCategory] = useState<(typeof CATEGORY_OPTIONS)[number]["value"]>("OUTDATED_INFO");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — real visitors never see or fill this
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setPhotoError(null);

    for (const file of files) {
      if (photos.length >= MAX_PHOTOS) {
        setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`);
        break;
      }
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        setPhotoError("Only JPEG, PNG, or WebP images are supported.");
        continue;
      }
      if (file.size > MAX_PHOTO_SIZE_BYTES) {
        setPhotoError(`"${file.name}" is larger than ${MAX_PHOTO_SIZE_BYTES / 1024 / 1024}MB.`);
        continue;
      }

      setUploadingPhoto(true);
      const result = await uploadPhoto(file);
      setUploadingPhoto(false);
      if (result.ok && result.photo) {
        setPhotos((prev) => [...prev, result.photo!]);
      } else {
        const message = result.error ?? "Could not upload photo.";
        setPhotoError(message);
        toast.error(message);
      }
    }
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p.url !== url));
    void deletePhoto(url);
  }

  async function doSubmit() {
    const result = await submitPandal({
      cityId,
      type: "REPORT",
      possiblePandalId: pandalId,
      submittedData: { category, description, photos: photos.map((p) => ({ url: p.url })) },
      contributorContact: email,
      website: website || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      const message = result.error ?? "Could not submit";
      setError(message);
      toast.error(message);
      return;
    }
    setDone(true);
    toast.success("Thanks — we'll take a look.");
  }

  async function handleSubmitRequest() {
    setSubmitting(true);
    setError(null);
    await doSubmit();
  }

  async function handleSendCode() {
    setSending(true);
    setError(null);
    const result = await sendVerificationCode(email);
    setSending(false);
    if (!result.ok) return setError(result.error ?? "Could not send code");
    setCodeSent(true);
  }

  async function handleVerifyAndSubmit() {
    setSubmitting(true);
    setError(null);
    const verified = await verifyCode(email, code);
    if (!verified.ok) {
      setSubmitting(false);
      return setError(verified.error ?? "Incorrect code");
    }
    await doSubmit();
  }

  const formStepClass =
    "flex flex-col gap-4 px-4 pt-6 md:mx-auto md:mt-6 md:max-w-xl md:rounded-3xl md:border md:border-border md:bg-panel md:p-8 md:pt-8";

  if (done) {
    return (
      <div className="relative min-h-dvh bg-ground pb-24">
        <div className="flex flex-col items-center gap-5 px-6 pt-20 text-center md:mx-auto md:max-w-md md:rounded-3xl md:border md:border-border md:bg-panel md:pb-10 md:pt-16">
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-brand">
            <span className="material-symbols-rounded text-5xl text-brand-ink" style={{ fontVariationSettings: "'FILL' 1" }}>
              check
            </span>
          </span>
          <h2 className="font-display text-[22px] md:text-[26px] font-extrabold">Thanks for the heads up.</h2>
          <p className="font-body text-ink-dim">
            Our team will look into this for {pandalName}. We'll email you only if we have questions.
          </p>
          <div className="mt-4 w-full">
            <Button uiSize="sm" onClick={() => router.push(`/${citySlug}`)}>
              Back to map
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-ground pb-24">
      <div className="flex flex-col gap-3 px-4 pb-3 pt-4 md:mx-auto md:max-w-xl">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-card md:hidden"
          >
            <span className="material-symbols-rounded">arrow_back</span>
          </button>
          <MobileHeader citySlug={citySlug} cityName={cityName} year={activeFestivalYear} className="md:hidden" />
          <span className="hidden font-body text-sm font-bold md:inline">Suggest an edit</span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!REQUIRE_VERIFICATION) handleSubmitRequest();
          else if (!codeSent) handleSendCode();
        }}
        className={formStepClass}
      >
        <h2 className="font-display text-[20px] md:text-[22px] font-extrabold">Suggest an edit for {pandalName}</h2>
        <p className="font-body text-sm text-ink-muted">
          Spotted something wrong, outdated, or worth flagging? Let us know and our team will review it — this
          doesn't change the listing directly.
        </p>

        <Field label="What's the issue?">
          <Select uiSize="sm" value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Details">
          <Textarea
            uiSize="sm"
            required
            placeholder="What should we know or fix?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-3 rounded-3xl border border-border bg-panel p-3.5 md:bg-card/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-chip">
              <span className="material-symbols-rounded text-brand">photo_camera</span>
            </span>
            <span className="font-display text-[15px] font-bold">Photos</span>
            <span className="ml-auto font-body text-xs text-ink-muted">optional · up to {MAX_PHOTOS}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {photos.map((photo) => (
              <div key={photo.url} className="relative h-20 w-20 flex-none overflow-hidden rounded-xl bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(photo.url)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ground/80"
                >
                  <span className="material-symbols-rounded text-xs">close</span>
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex h-20 w-20 flex-none cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border text-ink-muted">
                {uploadingPhoto ? (
                  <span className="material-symbols-rounded animate-spin text-xl">progress_activity</span>
                ) : (
                  <>
                    <span className="material-symbols-rounded text-xl">add_photo_alternate</span>
                    <span className="font-body text-[10px] font-semibold">Add</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={uploadingPhoto}
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>
          {photoError && <p className="font-body text-xs text-brand">{photoError}</p>}
        </div>

        <Field label="Your email (in case we have questions)">
          <Input
            uiSize="sm"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            disabled={REQUIRE_VERIFICATION && codeSent}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {/* Honeypot — hidden from real visitors via CSS, off the tab order,
            and skipped by screen readers; a script that fills every field
            it finds trips this instead of a real one. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute -left-[9999px] h-0 w-0 opacity-0"
        />

        {!REQUIRE_VERIFICATION && (
          <Button uiSize="sm" type="submit" disabled={submitting || !email || !description}>
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        )}

        {REQUIRE_VERIFICATION && !codeSent && (
          <Button uiSize="sm" type="submit" disabled={sending || !email || !description}>
            {sending ? "Sending…" : "Send code"}
          </Button>
        )}

        {REQUIRE_VERIFICATION && codeSent && (
          <>
            <label className="flex flex-col gap-2">
              <span className="font-body text-xs font-semibold text-ink-muted">Enter the 6-digit code we sent</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-11 md:h-12 rounded-2xl bg-ink text-center font-mono text-base md:text-lg text-ground tracking-[0.4em]"
                placeholder="000000"
              />
            </label>
            <Button uiSize="sm" onClick={handleVerifyAndSubmit} disabled={submitting || code.length !== 6}>
              {submitting ? "Submitting…" : "Verify & submit"}
            </Button>
          </>
        )}

        {error && <p className="font-body text-sm text-brand">{error}</p>}
      </form>
    </div>
  );
}
