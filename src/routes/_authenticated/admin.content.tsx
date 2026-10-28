import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, FilePenLine, Pencil, Plus, Save, X } from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminSiteContentFn,
  saveFaqEntryFn,
  savePublicSiteContentFn,
  setFaqEntryActiveFn,
} from "@/lib/backend";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({ meta: [{ title: "Website content — ScholarDesk" }] }),
  component: WebsiteContentRoute,
});

type SiteContentForm = {
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  supportHours: string;
  footerMessage: string;
  faqTitle: string;
  faqIntro: string;
};

type FaqForm = {
  question: string;
  answer: string;
  active: boolean;
  sort: string;
};

const emptyFaq: FaqForm = { question: "", answer: "", active: true, sort: "0" };

function WebsiteContentRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <WebsiteContent />
    </AdminGate>
  );
}

function WebsiteContent() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-site-content"],
    queryFn: () => getAdminSiteContentFn(),
  });
  const [siteDraft, setSiteDraft] = useState<SiteContentForm | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);
  const [isFaqFormOpen, setIsFaqFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [faqDraft, setFaqDraft] = useState<FaqForm>(emptyFaq);
  const [faqSaving, setFaqSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  const siteForm: SiteContentForm = siteDraft ?? {
    contactEmail: data?.contactEmail ?? "support@scholardesk.app",
    contactPhone: data?.contactPhone ?? "+254 700 000 000",
    contactWhatsapp: data?.contactWhatsapp ?? "",
    supportHours: data?.supportHours ?? "Mon-Sat, 8:00-20:00 EAT",
    footerMessage:
      data?.footerMessage ?? "Thoughtful academic support, from first draft to final submission.",
    faqTitle: data?.faqTitle ?? "Frequently asked questions",
    faqIntro:
      data?.faqIntro ??
      "Answers to common questions about ScholarDesk services, payments and privacy.",
  };
  const faqs = data?.faqs ?? [];

  async function refreshContent() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-site-content"] }),
      queryClient.invalidateQueries({ queryKey: ["public-site-content"] }),
    ]);
  }

  async function saveSiteContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSiteSaving(true);
    try {
      await savePublicSiteContentFn({ data: siteForm });
      await refreshContent();
      setSiteDraft(null);
      toast.success("Public content updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save public content.");
    } finally {
      setSiteSaving(false);
    }
  }

  function startNewFaq() {
    setEditingId(null);
    setIsFaqFormOpen(true);
    setFaqDraft({
      ...emptyFaq,
      sort: String(Math.max(-1, ...faqs.map((entry) => entry.sort)) + 1),
    });
  }

  function startEditingFaq(entry: (typeof faqs)[number]) {
    setEditingId(entry.id);
    setIsFaqFormOpen(true);
    setFaqDraft({
      question: entry.question,
      answer: entry.answer,
      active: entry.active,
      sort: String(entry.sort),
    });
  }

  async function saveFaq(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFaqSaving(true);
    try {
      await saveFaqEntryFn({
        data: {
          ...(editingId ? { id: editingId } : {}),
          question: faqDraft.question,
          answer: faqDraft.answer,
          active: faqDraft.active,
          sort: Number(faqDraft.sort),
        },
      });
      await refreshContent();
      setEditingId(null);
      setIsFaqFormOpen(false);
      setFaqDraft(emptyFaq);
      toast.success(editingId ? "FAQ updated" : "FAQ added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this FAQ.");
    } finally {
      setFaqSaving(false);
    }
  }

  async function changeFaqState(id: string, active: boolean) {
    setChangingId(id);
    try {
      await setFaqEntryActiveFn({ data: { id, active } });
      await refreshContent();
      toast.success(active ? "FAQ published" : "FAQ hidden from the public page");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this FAQ.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="space-y-10">
      <header className="border-b border-[#dfe8e3] pb-6">
        <p className="text-[10px] font-bold uppercase text-[#6b8177]">Site controls</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173c33]">Website content</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#677872]">
          Keep support details, the public footer and FAQ page current. Changes appear across the
          public site and both portal views.
        </p>
      </header>

      {isLoading ? (
        <p className="py-8 text-sm text-muted-foreground">Loading website content…</p>
      ) : isError ? (
        <p className="py-8 text-sm text-destructive" role="alert">
          Could not load website content. Refresh to retry.
        </p>
      ) : (
        <>
          <section aria-labelledby="site-details-title">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e5f1eb] text-[#155b4c]">
                <FilePenLine className="h-5 w-5" />
              </span>
              <div>
                <h2 id="site-details-title" className="text-lg font-semibold text-[#173c33]">
                  Contact and page details
                </h2>
                <p className="text-sm text-[#71817a]">Shared across public and portal footers.</p>
              </div>
            </div>

            <form onSubmit={saveSiteContent} className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              <Field label="Support email" htmlFor="content-email">
                <Input
                  id="content-email"
                  type="email"
                  value={siteForm.contactEmail}
                  onChange={(event) =>
                    setSiteDraft({ ...siteForm, contactEmail: event.target.value })
                  }
                  maxLength={255}
                />
              </Field>
              <Field label="Support phone" htmlFor="content-phone">
                <Input
                  id="content-phone"
                  value={siteForm.contactPhone}
                  onChange={(event) =>
                    setSiteDraft({ ...siteForm, contactPhone: event.target.value })
                  }
                  maxLength={40}
                />
              </Field>
              <Field label="WhatsApp number" htmlFor="content-whatsapp">
                <Input
                  id="content-whatsapp"
                  value={siteForm.contactWhatsapp}
                  onChange={(event) =>
                    setSiteDraft({ ...siteForm, contactWhatsapp: event.target.value })
                  }
                  placeholder="Country code and number"
                  maxLength={40}
                />
              </Field>
              <Field label="Support hours" htmlFor="content-hours">
                <Input
                  id="content-hours"
                  value={siteForm.supportHours}
                  onChange={(event) =>
                    setSiteDraft({ ...siteForm, supportHours: event.target.value })
                  }
                  maxLength={120}
                  required
                />
              </Field>
              <Field label="Footer message" htmlFor="content-footer-message">
                <Textarea
                  id="content-footer-message"
                  value={siteForm.footerMessage}
                  onChange={(event) =>
                    setSiteDraft({ ...siteForm, footerMessage: event.target.value })
                  }
                  maxLength={255}
                  required
                  rows={3}
                />
              </Field>
              <Field label="FAQ page title" htmlFor="content-faq-title">
                <Input
                  id="content-faq-title"
                  value={siteForm.faqTitle}
                  onChange={(event) => setSiteDraft({ ...siteForm, faqTitle: event.target.value })}
                  maxLength={160}
                  required
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="FAQ introduction" htmlFor="content-faq-intro">
                  <Textarea
                    id="content-faq-intro"
                    value={siteForm.faqIntro}
                    onChange={(event) =>
                      setSiteDraft({ ...siteForm, faqIntro: event.target.value })
                    }
                    maxLength={500}
                    required
                    rows={3}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={siteSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {siteSaving ? "Saving…" : "Save site details"}
                </Button>
              </div>
            </form>
          </section>

          <section
            aria-labelledby="faq-management-title"
            className="border-t border-[#dfe8e3] pt-8"
          >
            <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#6b8177]">Public help</p>
                <h2 id="faq-management-title" className="mt-1 text-xl font-semibold text-[#173c33]">
                  Frequently asked questions
                </h2>
                <p className="mt-1 text-sm text-[#71817a]">
                  Edit answers, control their order and publish or hide entries.
                </p>
              </div>
              <Button type="button" onClick={startNewFaq}>
                <Plus className="mr-2 h-4 w-4" /> Add FAQ
              </Button>
            </header>

            {isFaqFormOpen && (
              <form onSubmit={saveFaq} className="mt-5 grid gap-4 border-y border-[#dfe8e3] py-5">
                <Field label="Question" htmlFor="faq-question">
                  <Input
                    id="faq-question"
                    value={faqDraft.question}
                    onChange={(event) => setFaqDraft({ ...faqDraft, question: event.target.value })}
                    maxLength={300}
                    required
                  />
                </Field>
                <Field label="Answer" htmlFor="faq-answer">
                  <Textarea
                    id="faq-answer"
                    value={faqDraft.answer}
                    onChange={(event) => setFaqDraft({ ...faqDraft, answer: event.target.value })}
                    maxLength={5000}
                    required
                    rows={4}
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-6">
                  <Field label="Display order" htmlFor="faq-sort">
                    <Input
                      id="faq-sort"
                      type="number"
                      min="0"
                      max="9999"
                      value={faqDraft.sort}
                      onChange={(event) => setFaqDraft({ ...faqDraft, sort: event.target.value })}
                      required
                      className="w-32"
                    />
                  </Field>
                  <div className="flex items-center gap-3 pt-6">
                    <Switch
                      id="faq-active"
                      checked={faqDraft.active}
                      onCheckedChange={(active) => setFaqDraft({ ...faqDraft, active })}
                      aria-label="Publish FAQ"
                    />
                    <label htmlFor="faq-active" className="text-sm font-medium">
                      Published publicly
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={faqSaving}>
                    <Save className="mr-2 h-4 w-4" />
                    {faqSaving ? "Saving…" : editingId ? "Save FAQ" : "Add FAQ"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setIsFaqFormOpen(false);
                      setFaqDraft(emptyFaq);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </Button>
                </div>
              </form>
            )}

            {faqs.length ? (
              <ul className="mt-2 divide-y divide-[#e6ede8]">
                {faqs.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-[#24473b]">{entry.question}</h3>
                        <span className="text-xs text-[#71817a]">#{entry.sort}</span>
                        <span
                          className={`text-xs font-medium ${entry.active ? "text-emerald-700" : "text-[#71817a]"}`}
                        >
                          {entry.active ? "Published" : "Hidden"}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-sm text-[#71817a]">
                        {entry.answer}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEditingFaq(entry)}
                      >
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={changingId === entry.id}
                        onClick={() => void changeFaqState(entry.id, !entry.active)}
                      >
                        {entry.active ? (
                          <EyeOff className="mr-2 h-4 w-4" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        {entry.active ? "Hide" : "Publish"}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-[#71817a]">No FAQ entries yet. Add the first one.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[#294a3f]">
        {label}
      </label>
      {children}
    </div>
  );
}
