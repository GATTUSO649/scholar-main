import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, FileText, Pencil, Plus, Save, X } from "lucide-react";
import { AdminGate } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { getAdminLegalDocumentsFn, saveLegalDocumentFn } from "@/lib/backend";

export const Route = createFileRoute("/_authenticated/admin/legal-documents")({
  head: () => ({ meta: [{ title: "Legal documents — ScholarDesk" }] }),
  component: LegalDocumentsRoute,
});

type LegalDocumentForm = {
  slug: string;
  title: string;
  content: string;
  published: boolean;
};

const emptyDocument: LegalDocumentForm = {
  slug: "",
  title: "",
  content: "",
  published: false,
};

function LegalDocumentsRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <LegalDocuments />
    </AdminGate>
  );
}

function LegalDocuments() {
  const queryClient = useQueryClient();
  const {
    data: documents = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-legal-documents"],
    queryFn: () => getAdminLegalDocumentsFn(),
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<LegalDocumentForm>(emptyDocument);
  const [saving, setSaving] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  function startNew(title = "", slug = "") {
    setEditingId(null);
    setDraft({ ...emptyDocument, title, slug });
  }

  function startEditing(document: (typeof documents)[number]) {
    setEditingId(document.id);
    setDraft({
      slug: document.slug,
      title: document.title,
      content: document.content,
      published: document.published,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDocument);
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.published && draft.content.trim().length < 20) {
      toast.error("Add at least 20 characters before publishing this document.");
      return;
    }
    setSaving(true);
    try {
      await saveLegalDocumentFn({ data: { ...draft, ...(editingId ? { id: editingId } : {}) } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-legal-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["public-legal-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["public-legal-document"] }),
      ]);
      setEditingId(null);
      setDraft(emptyDocument);
      toast.success(editingId ? "Legal document updated" : "Legal document added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this document.");
    } finally {
      setSaving(false);
    }
  }

  async function changePublished(document: (typeof documents)[number]) {
    setChangingId(document.id);
    try {
      await saveLegalDocumentFn({
        data: {
          id: document.id,
          slug: document.slug,
          title: document.title,
          content: document.content,
          published: !document.published,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-legal-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["public-legal-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["public-legal-document"] }),
      ]);
      toast.success(document.published ? "Document unpublished" : "Document published");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update publication status.");
    } finally {
      setChangingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="border-b border-[#dfe8e3] pb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b8177]">
          Public site <span className="px-1 text-[#bd8a48]">/</span> Legal
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#173c33]">Legal documents</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#677872]">
          Create and publish privacy, terms, and other legal pages. Published documents appear in
          site and portal footers and can be linked during registration.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => startNew("Privacy Policy", "privacy-policy")}
        >
          <Plus className="mr-2 h-4 w-4" /> Privacy Policy
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => startNew("Terms and Conditions", "terms-and-conditions")}
        >
          <Plus className="mr-2 h-4 w-4" /> Terms and Conditions
        </Button>
        <Button type="button" variant="outline" onClick={() => startNew()}>
          <Plus className="mr-2 h-4 w-4" /> Custom document
        </Button>
      </div>

      {draft !== emptyDocument && (
        <section className="rounded-xl border border-[#dfe8e3] bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e5f1eb] text-[#155b4c]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[#173c33]">
                {editingId ? "Edit document" : "New document"}
              </h2>
              <p className="text-sm text-[#71817a]">
                Content is plain text; line breaks are preserved.
              </p>
            </div>
          </div>
          <form onSubmit={saveDocument} className="grid gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <label
                className="grid gap-2 text-sm font-medium text-[#294a3f]"
                htmlFor="legal-title"
              >
                Document title
                <Input
                  id="legal-title"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  maxLength={160}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-[#294a3f]" htmlFor="legal-slug">
                Public URL slug
                <Input
                  id="legal-slug"
                  value={draft.slug}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      slug: event.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/^-|-$/g, ""),
                    })
                  }
                  maxLength={120}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="acceptable-use-policy"
                  required
                />
              </label>
            </div>
            <label
              className="grid gap-2 text-sm font-medium text-[#294a3f]"
              htmlFor="legal-content"
            >
              Document text
              <Textarea
                id="legal-content"
                value={draft.content}
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
                maxLength={100_000}
                rows={14}
                required
              />
              <span className="text-xs font-normal text-[#71817a]">
                {draft.content.length.toLocaleString()} / 100,000 characters
              </span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#e6ede8] pt-4">
              <div className="flex items-center gap-3">
                <Switch
                  id="legal-published"
                  checked={draft.published}
                  onCheckedChange={(published) => setDraft({ ...draft, published })}
                />
                <label htmlFor="legal-published" className="text-sm font-medium text-[#294a3f]">
                  Published publicly
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save document"}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEdit}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </div>
            </div>
          </form>
        </section>
      )}

      <section
        aria-labelledby="legal-list-title"
        className="rounded-xl border border-[#dfe8e3] bg-white p-5 sm:p-6"
      >
        <h2 id="legal-list-title" className="text-lg font-semibold text-[#173c33]">
          All documents
        </h2>
        {isLoading ? (
          <p className="py-6 text-sm text-[#71817a]">Loading legal documents…</p>
        ) : isError ? (
          <p className="py-6 text-sm text-destructive" role="alert">
            Could not load legal documents.
          </p>
        ) : documents.length ? (
          <ul className="mt-2 divide-y divide-[#e6ede8]">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-[#24473b]">{document.title}</h3>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${document.published ? "bg-emerald-50 text-emerald-800" : "bg-[#eef1ef] text-[#71817a]"}`}
                    >
                      {document.published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-[#71817a]">/legal/{document.slug}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEditing(document)}
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={changingId === document.id}
                    onClick={() => void changePublished(document)}
                  >
                    {document.published ? (
                      <EyeOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {document.published ? "Unpublish" : "Publish"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-sm text-[#71817a]">
            No legal documents yet. Start with a privacy policy or terms.
          </p>
        )}
      </section>
    </div>
  );
}
