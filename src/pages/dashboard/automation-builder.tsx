import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  MessageCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import {
  AutomationInputSchema,
  MAX_LINK_LABEL_LENGTH,
  MAX_REPLY_LENGTH,
  MAX_REPLY_VARIANTS,
  triggerSummary,
  type AutomationDto,
} from "../../../shared/automation"
import { DM_MAX_LENGTH, composeDmText, type MediaItem } from "../../../shared/instagram"
import type { TriggerType } from "../../../shared/keywords"
import { ApiError, api } from "@/dashboard/api"
import type { ConnectedAccount } from "@/dashboard/automations/account-card"
import { ActivityLog } from "@/dashboard/automations/activity-log"
import { KeywordInput } from "@/dashboard/automations/keyword-input"
import { MediaPicker } from "@/dashboard/automations/media-picker"
import { PhonePreview } from "@/dashboard/automations/phone-preview"
import { Toggle } from "@/dashboard/automations/toggle"
import { useToast } from "@/dashboard/toast"

interface FormState {
  name: string
  media: MediaItem | null
  triggerType: TriggerType
  keywords: string[]
  publicReplyEnabled: boolean
  publicReplies: string[]
  dmMessage: string
  dmLinkUrl: string
  dmLinkLabel: string
}

const EMPTY: FormState = {
  name: "",
  media: null,
  triggerType: "keywords",
  keywords: [],
  publicReplyEnabled: false,
  publicReplies: [""],
  dmMessage: "",
  dmLinkUrl: "",
  dmLinkLabel: "",
}

const STEPS = ["Reel", "Trigger", "Public reply", "DM", "Review"] as const
type Field =
  | "mediaId"
  | "keywords"
  | "publicReplies"
  | "dmMessage"
  | "dmLinkUrl"
  | "name"
/** Which fields each step owns, so errors land on the right step. */
const STEP_FIELDS: Field[][] = [
  ["mediaId"],
  ["keywords"],
  ["publicReplies"],
  ["dmMessage", "dmLinkUrl"],
  ["name"],
]

function fromDto(a: AutomationDto): FormState {
  return {
    name: a.name,
    media: {
      id: a.mediaId,
      caption: a.mediaCaption,
      mediaType: a.mediaType ?? "UNKNOWN",
      productType: a.mediaType,
      thumbnailUrl: a.mediaThumbnailUrl,
      permalink: a.mediaPermalink,
      timestamp: null,
    },
    triggerType: a.triggerType,
    keywords: a.keywords,
    publicReplyEnabled: a.publicReplyEnabled,
    publicReplies: a.publicReplies.length ? a.publicReplies : [""],
    dmMessage: a.dmMessage,
    dmLinkUrl: a.dmLinkUrl ?? "",
    dmLinkLabel: a.dmLinkLabel ?? "",
  }
}

function toInput(s: FormState, isActive: boolean) {
  return {
    name: s.name,
    mediaId: s.media?.id ?? "",
    triggerType: s.triggerType,
    keywords: s.triggerType === "keywords" ? s.keywords : [],
    publicReplyEnabled: s.publicReplyEnabled,
    publicReplies: s.publicReplyEnabled ? s.publicReplies : [],
    dmMessage: s.dmMessage,
    dmLinkUrl: s.dmLinkUrl,
    dmLinkLabel: s.dmLinkLabel,
    isActive,
  }
}

function validate(s: FormState): Partial<Record<Field, string>> {
  const parsed = AutomationInputSchema.safeParse(toInput(s, false))
  if (parsed.success) return {}
  const out: Partial<Record<Field, string>> = {}
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as Field | undefined
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

function defaultName(media: MediaItem | null): string {
  const caption = media?.caption?.split("\n")[0]?.trim()
  if (!caption) return "New automation"
  return caption.length > 40 ? `${caption.slice(0, 40).trimEnd()}...` : caption
}

export default function AutomationBuilderPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [step, setStep] = useState(0)
  const [tab, setTab] = useState<"settings" | "activity">("settings")
  const [account, setAccount] = useState<ConnectedAccount | null>(null)
  const [original, setOriginal] = useState<AutomationDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState<"active" | "paused" | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const acc = await api<{ account: ConnectedAccount | null }>("/api/instagram/account")
        if (cancelled) return
        setAccount(acc.account)
        if (id) {
          const res = await api<{ automation: AutomationDto }>(`/api/automations/${id}`)
          if (cancelled) return
          setOriginal(res.automation)
          setForm(fromDto(res.automation))
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof ApiError ? err.message : "Could not load this automation.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const errors = useMemo(() => validate(form), [form])
  const stepErrors = (i: number) => (STEP_FIELDS[i] ?? []).filter((f) => errors[f])
  const stepValid = (i: number) => stepErrors(i).length === 0
  const showErrors = (i: number) => touched.has(i)

  const update = (patch: Partial<FormState>) => {
    setServerError(null)
    setForm((f) => ({ ...f, ...patch }))
  }

  function next() {
    setTouched((t) => new Set(t).add(step))
    if (!stepValid(step)) return
    if (step === 0 && !form.name) update({ name: defaultName(form.media) })
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function save(active: boolean) {
    setTouched(new Set(STEPS.map((_, i) => i)))
    const firstBad = STEPS.findIndex((_, i) => !stepValid(i))
    if (firstBad !== -1) {
      setStep(firstBad)
      return
    }
    setSaving(active ? "active" : "paused")
    setServerError(null)
    try {
      const body = toInput(form, active)
      if (isEdit && id) {
        await api(`/api/automations/${id}`, { method: "PUT", body })
      } else {
        await api("/api/automations", { method: "POST", body })
      }
      toast("success", active ? "Automation is live." : "Automation saved as paused.")
      navigate("/dashboard/automations")
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save the automation.")
    } finally {
      setSaving(null)
    }
  }

  async function remove() {
    if (!id) return
    setDeleting(true)
    try {
      await api(`/api/automations/${id}`, { method: "DELETE" })
      toast("success", "Automation deleted.")
      navigate("/dashboard/automations")
    } catch (err) {
      toast("error", err instanceof ApiError ? err.message : "Could not delete the automation.")
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-gold-light" />
        <span className="sr-only">Loading</span>
      </div>
    )
  }

  if (loadError || !account || account.status !== "active") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-[15px] text-fg">
          {loadError ??
            (account?.status === "expired"
              ? "Reconnect Instagram before editing automations."
              : "Connect Instagram before creating automations.")}
        </p>
        <Link
          to="/dashboard/automations"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5")}
        >
          Back to automations
        </Link>
      </div>
    )
  }

  const previewReply =
    form.publicReplyEnabled ? form.publicReplies.find((r) => r.trim()) ?? null : null
  const sampleComment =
    form.triggerType === "keywords" && form.keywords[0]
      ? `Can I get the ${form.keywords[0]}?`
      : "This is so helpful!"
  const dmLength = composeDmText(form.dmMessage, form.dmLinkUrl, form.dmLinkLabel).length

  return (
    <>
      <Link
        to="/dashboard/automations"
        className="inline-flex items-center gap-1.5 rounded-lg text-[13px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Automations
      </Link>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-fg">
            {isEdit ? original?.name ?? "Automation" : "New automation"}
          </h1>
          {isEdit && original && (
            <p className="mt-1.5 text-[14px] text-fg-muted">
              {original.isActive ? "Live" : "Paused"} · {triggerSummary(original)}
            </p>
          )}
        </div>
        {isEdit && (
          <div className="inline-flex self-start rounded-full border border-white/10 bg-ink-card p-1" role="tablist">
            {(["settings", "activity"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-[13px] font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                  tab === t ? "bg-white/10 text-fg" : "text-fg-muted hover:text-fg",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === "activity" && id ? (
        <div className="mt-8">
          <ActivityLog automationId={id} />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {/* Stepper */}
            <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Steps">
              {STEPS.map((label, i) => {
                const done = i < step && stepValid(i)
                return (
                  <li key={label} className="flex-1">
                    <button
                      type="button"
                      onClick={() => i <= step && setStep(i)}
                      disabled={i > step}
                      aria-current={i === step ? "step" : undefined}
                      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "block h-1 rounded-full transition-colors",
                          i <= step ? "bg-gold" : "bg-white/10",
                        )}
                      />
                      <span
                        className={cn(
                          "mt-2 flex items-center gap-1 whitespace-nowrap text-[12px]",
                          i === step ? "text-fg" : "text-fg-muted",
                        )}
                      >
                        {done && <Check className="h-3 w-3 text-gold-light" />}
                        {label}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>

            <div className="mt-6 rounded-3xl border border-white/[0.08] bg-ink-card/80 p-5 sm:p-7">
              {step === 0 && (
                <Section title="Pick a reel" hint="Reels appear first. You can also pick any post.">
                  <MediaPicker
                    selectedId={form.media?.id ?? null}
                    onSelect={(media) => update({ media })}
                  />
                  <FieldError show={showErrors(0)} message={errors.mediaId} />
                </Section>
              )}

              {step === 1 && (
                <Section title="Trigger" hint="Which comments should get a DM?">
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Trigger">
                    {(
                      [
                        ["any_comment", "Any comment", "Everyone who comments gets the DM."],
                        ["keywords", "Comments containing keywords", "Only comments with a keyword you choose."],
                      ] as const
                    ).map(([value, label, hint]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={form.triggerType === value}
                        onClick={() => update({ triggerType: value })}
                        className={cn(
                          "rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60",
                          form.triggerType === value
                            ? "border-gold/50 bg-gold/[0.08]"
                            : "border-white/10 hover:border-white/20",
                        )}
                      >
                        <p className="text-[15px] font-medium text-fg">{label}</p>
                        <p className="mt-1 text-[13px] text-fg-muted">{hint}</p>
                      </button>
                    ))}
                  </div>
                  {form.triggerType === "keywords" && (
                    <div className="mt-5">
                      <KeywordInput
                        value={form.keywords}
                        onChange={(keywords) => update({ keywords })}
                        invalid={showErrors(1) && Boolean(errors.keywords)}
                      />
                      <FieldError show={showErrors(1)} message={errors.keywords} />
                    </div>
                  )}
                </Section>
              )}

              {step === 2 && (
                <Section
                  title="Public reply"
                  hint="Optional. A short reply under their comment. One variant is picked at random each time, so replies do not look robotic."
                >
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 p-4">
                    <p className="text-[14px] text-fg">Reply publicly to the comment</p>
                    <Toggle
                      checked={form.publicReplyEnabled}
                      label="Reply publicly to the comment"
                      onChange={(v) => update({ publicReplyEnabled: v })}
                    />
                  </div>
                  {form.publicReplyEnabled && (
                    <div className="mt-4 space-y-2.5">
                      {form.publicReplies.map((reply, i) => (
                        <div key={i} className="flex gap-2">
                          <input
                            value={reply}
                            maxLength={MAX_REPLY_LENGTH}
                            onChange={(e) => {
                              const list = [...form.publicReplies]
                              list[i] = e.target.value
                              update({ publicReplies: list })
                            }}
                            placeholder={["Sent it to your DMs!", "Check your inbox", "Just sent it over"][i % 3]}
                            aria-label={`Reply variant ${i + 1}`}
                            className={inputClass(false)}
                          />
                          {form.publicReplies.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove variant ${i + 1}`}
                              onClick={() =>
                                update({ publicReplies: form.publicReplies.filter((_, j) => j !== i) })
                              }
                              className="shrink-0 rounded-xl border border-white/10 px-3 text-fg-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      {form.publicReplies.length < MAX_REPLY_VARIANTS && (
                        <button
                          type="button"
                          onClick={() => update({ publicReplies: [...form.publicReplies, ""] })}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          <Plus />
                          Add a variant
                        </button>
                      )}
                      <FieldError show={showErrors(2)} message={errors.publicReplies} />
                    </div>
                  )}
                </Section>
              )}

              {step === 3 && (
                <Section title="The DM" hint="Sent privately to everyone whose comment matches.">
                  <label htmlFor="dm" className="text-[13px] font-medium text-fg">
                    Message
                  </label>
                  <textarea
                    id="dm"
                    rows={5}
                    value={form.dmMessage}
                    onChange={(e) => update({ dmMessage: e.target.value })}
                    placeholder="Hey! Here is the guide you asked for. Let me know what you think."
                    className={cn(inputClass(showErrors(3) && Boolean(errors.dmMessage)), "mt-2 resize-y py-3")}
                  />
                  <div className="mt-1.5 flex justify-between">
                    <FieldError show={showErrors(3)} message={errors.dmMessage} />
                    <span
                      className={cn(
                        "ml-auto text-[12px] tabular-nums",
                        dmLength > DM_MAX_LENGTH ? "text-red-300" : "text-fg-muted",
                      )}
                    >
                      {dmLength}/{DM_MAX_LENGTH}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
                    <div>
                      <label htmlFor="link" className="text-[13px] font-medium text-fg">
                        Link <span className="font-normal text-fg-muted">(optional)</span>
                      </label>
                      <input
                        id="link"
                        type="url"
                        inputMode="url"
                        value={form.dmLinkUrl}
                        onChange={(e) => update({ dmLinkUrl: e.target.value })}
                        placeholder="https://yoursite.com/guide"
                        className={cn(inputClass(showErrors(3) && Boolean(errors.dmLinkUrl)), "mt-2")}
                      />
                    </div>
                    <div>
                      <label htmlFor="label" className="text-[13px] font-medium text-fg">
                        Link label
                      </label>
                      <input
                        id="label"
                        value={form.dmLinkLabel}
                        maxLength={MAX_LINK_LABEL_LENGTH}
                        onChange={(e) => update({ dmLinkLabel: e.target.value })}
                        placeholder="Get the guide"
                        className={cn(inputClass(false), "mt-2")}
                      />
                    </div>
                  </div>
                  <FieldError show={showErrors(3)} message={errors.dmLinkUrl} />
                  <p className="mt-2 text-[12px] text-fg-muted">
                    Instagram delivers links in DMs as text, so the label appears before the link.
                  </p>
                </Section>
              )}

              {step === 4 && (
                <Section title="Review and activate" hint="Check everything, then go live.">
                  <label htmlFor="name" className="text-[13px] font-medium text-fg">
                    Automation name
                  </label>
                  <input
                    id="name"
                    value={form.name}
                    maxLength={80}
                    onChange={(e) => update({ name: e.target.value })}
                    className={cn(inputClass(showErrors(4) && Boolean(errors.name)), "mt-2")}
                  />
                  <FieldError show={showErrors(4)} message={errors.name} />

                  <dl className="mt-6 divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08]">
                    <ReviewRow label="Post">
                      {form.media?.caption ? form.media.caption.slice(0, 80) : "Selected post"}
                    </ReviewRow>
                    <ReviewRow label="Trigger">{triggerSummary(form)}</ReviewRow>
                    <ReviewRow label="Public reply">
                      {form.publicReplyEnabled
                        ? `${form.publicReplies.filter((r) => r.trim()).length} variant(s)`
                        : "Off"}
                    </ReviewRow>
                    <ReviewRow label="DM">
                      <span className="line-clamp-2">{form.dmMessage || "Not written yet"}</span>
                    </ReviewRow>
                  </dl>

                  {serverError && (
                    <p role="alert" className="mt-5 rounded-2xl border border-red-400/25 bg-red-400/[0.06] p-4 text-[14px] text-red-200">
                      {serverError}
                    </p>
                  )}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void save(true)}
                      disabled={saving !== null}
                      className={cn(buttonVariants({ variant: "gold", size: "lg" }), "w-full sm:w-auto sm:flex-1")}
                    >
                      {saving === "active" ? <Loader2 className="animate-spin" /> : <Check />}
                      {isEdit && original?.isActive ? "Save and keep live" : "Activate automation"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void save(false)}
                      disabled={saving !== null}
                      className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
                    >
                      {saving === "paused" && <Loader2 className="animate-spin" />}
                      Save as paused
                    </button>
                  </div>
                </Section>
              )}

              {step < STEPS.length - 1 && (
                <div className="mt-7 flex justify-between border-t border-white/[0.06] pt-5">
                  <button
                    type="button"
                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                    disabled={step === 0}
                    className={cn(buttonVariants({ variant: "ghost" }), "disabled:invisible")}
                  >
                    <ArrowLeft />
                    Back
                  </button>
                  <button type="button" onClick={next} className={buttonVariants({ variant: "gold" })}>
                    Continue
                    <ArrowRight />
                  </button>
                </div>
              )}
            </div>

            {isEdit && (
              <div className="mt-6 flex justify-end">
                {confirmDelete ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <p className="text-[13px] text-fg-muted">
                      Delete this automation and its activity log?
                    </p>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove()}
                      disabled={deleting}
                      className={cn(buttonVariants({ size: "sm" }), "bg-red-500/90 text-white hover:bg-red-500")}
                    >
                      {deleting && <Loader2 className="animate-spin" />}
                      Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-fg-muted transition-colors hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete automation
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Live preview */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.16em] text-fg-muted">
              <MessageCircle className="h-3.5 w-3.5" />
              Live preview
            </p>
            <PhonePreview
              username={account.username}
              avatarUrl={account.profilePictureUrl}
              media={form.media}
              sampleComment={sampleComment}
              publicReply={previewReply}
              dmMessage={form.dmMessage}
              dmLinkUrl={form.dmLinkUrl}
              dmLinkLabel={form.dmLinkLabel}
            />
          </aside>
        </div>
      )}
    </>
  )
}

function inputClass(invalid: boolean) {
  return cn(
    "w-full rounded-2xl border bg-ink-raised/60 px-4 py-2.5 text-[14px] text-fg placeholder:text-fg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
    invalid ? "border-red-400/50" : "border-white/10 hover:border-white/20",
  )
}

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-fg">{title}</h2>
      <p className="mt-1 text-[14px] text-fg-muted">{hint}</p>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function FieldError({ show, message }: { show: boolean; message?: string }) {
  if (!show || !message) return null
  return (
    <p role="alert" className="mt-2 text-[13px] text-red-300">
      {message}
    </p>
  )
}

function ReviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-[14px]">
      <dt className="w-28 shrink-0 text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-fg">{children}</dd>
    </div>
  )
}
