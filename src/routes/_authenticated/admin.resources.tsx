import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  BriefcaseBusiness,
  Download,
  FileText,
  HardDrive,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdminLibraryResourcesFn } from "@/lib/backend";

type LibraryCategory = "novel" | "business_plan" | "article";
type CategoryFilter = "all" | LibraryCategory;
type LibraryResource = {
  id: string;
  title: string;
  description: string;
  category: LibraryCategory;
  name: string;
  size: number;
  created_at: string;
};

const categories: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All resources" },
  { id: "article", label: "Articles" },
  { id: "novel", label: "Novels" },
  { id: "business_plan", label: "Business plans" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(category: LibraryCategory) {
  return categories.find((item) => item.id === category)?.label.replace(/s$/, "") ?? category;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export const Route = createFileRoute("/_authenticated/admin/resources")({
  head: () => ({
    meta: [
      { title: "Library management — ScholarDesk" },
      { name: "description", content: "Manage public novels, business plans, and articles." },
    ],
  }),
  component: AdminResourcesRoute,
});

function AdminResourcesRoute() {
  const { isAdmin } = Route.useRouteContext();
  return (
    <AdminGate isAdmin={isAdmin}>
      <AdminResources />
    </AdminGate>
  );
}

function AdminResources() {
  const queryClient = useQueryClient();
  const {
    data: resources = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-library-resources"],
    queryFn: () => getAdminLibraryResourcesFn(),
  });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [editingResource, setEditingResource] = useState<LibraryResource | null>(null);

  const categoryCounts: Record<CategoryFilter, number> = {
    all: resources.length,
    article: resources.filter((resource) => resource.category === "article").length,
    novel: resources.filter((resource) => resource.category === "novel").length,
    business_plan: resources.filter((resource) => resource.category === "business_plan").length,
  };
  const needle = search.trim().toLowerCase();
  const filteredResources = resources.filter((resource) => {
    const matchesCategory = category === "all" || resource.category === category;
    const matchesSearch =
      !needle ||
      `${resource.title} ${resource.description} ${resource.name} ${resource.category}`
        .toLowerCase()
        .includes(needle);
    return matchesCategory && matchesSearch;
  });
  const totalStorage = resources.reduce((total, resource) => total + resource.size, 0);

  async function refreshLibrary() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-library-resources"] }),
      queryClient.invalidateQueries({ queryKey: ["library-resources"] }),
    ]);
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/library", { method: "POST", body });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not upload the resource.");
      form.reset();
      await refreshLibrary();
      toast.success("Resource published to the public library.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the resource.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingResource) return;
    const formData = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const response = await fetch("/api/library", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingResource.id,
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          category: String(formData.get("category") ?? ""),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not update this resource.");
      setEditingResource(null);
      await refreshLibrary();
      toast.success("Resource details updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this resource.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(resource: LibraryResource) {
    if (
      !window.confirm(
        `Remove "${resource.title}" from the public library? This also deletes its file.`,
      )
    )
      return;
    setDeletingId(resource.id);
    try {
      const response = await fetch(`/api/library?id=${encodeURIComponent(resource.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not remove the resource.");
      await refreshLibrary();
      toast.success("Resource and stored file removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the resource.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#687b93]">
            Public content
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Library</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Publish and maintain downloadable resources shown on the public library page.
          </p>
        </div>
        <a
          href="/library"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
        >
          <BookOpen className="h-4 w-4" /> Preview public library
        </a>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Library summary">
        <SummaryMetric label="Published resources" value={resources.length} icon={BookOpen} />
        <SummaryMetric label="Articles" value={categoryCounts.article} icon={FileText} />
        <SummaryMetric
          label="Novels and plans"
          value={categoryCounts.novel + categoryCounts.business_plan}
          icon={BriefcaseBusiness}
        />
        <SummaryMetric label="Stored files" value={formatBytes(totalStorage)} icon={HardDrive} />
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="font-semibold">Add a resource</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a PDF, EPUB, Word document, or text file up to 25 MB. Publishing makes it
            immediately downloadable by visitors.
          </p>
        </div>
        <form onSubmit={upload} className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <div>
            <Label htmlFor="resource-title">Display title</Label>
            <Input
              id="resource-title"
              name="title"
              required
              minLength={2}
              maxLength={200}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="resource-category">Category</Label>
            <select
              id="resource-category"
              name="category"
              required
              defaultValue="article"
              className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="article">Article</option>
              <option value="novel">Novel</option>
              <option value="business_plan">Business plan</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="resource-description">Description</Label>
            <Textarea
              id="resource-description"
              name="description"
              maxLength={2000}
              rows={2}
              placeholder="Add a short summary visitors will see before downloading."
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="resource-file">File</Label>
            <Input
              id="resource-file"
              name="file"
              type="file"
              accept=".pdf,.epub,.doc,.docx,.txt"
              required
              className="mt-1.5 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-semibold"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              <Upload className="mr-2 h-4 w-4" />
              {busy ? "Uploading…" : "Publish resource"}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-soft">
        <div className="border-b px-5 py-4 sm:px-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-semibold">Resource collection</h2>
              <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
                {isLoading
                  ? "Loading resources…"
                  : `${filteredResources.length} of ${resources.length} resources`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, description, or file"
                  aria-label="Search library resources"
                  className="h-10 pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void refetch()}
                disabled={isFetching}
                aria-label="Refresh resources"
                title="Refresh resources"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div
            className="mt-4 flex gap-2 overflow-x-auto pb-1"
            role="group"
            aria-label="Filter resources by category"
          >
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  category === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                }`}
              >
                {item.label}
                <span className="text-xs opacity-75">{categoryCounts[item.id]}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading the collection…</p>
        ) : isError ? (
          <div className="p-6">
            <p className="text-sm text-destructive">Could not load resources.</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">
              {resources.length ? "No resources match these filters" : "The library is empty"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {resources.length
                ? "Try another search or category."
                : "Published resources will appear here and on the public library page."}
            </p>
            {(search || category !== "all") && (
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {filteredResources.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#eef2f8] text-[#334b6b]">
                    {resource.category === "novel" ? (
                      <BookOpen className="h-5 w-5" />
                    ) : resource.category === "business_plan" ? (
                      <BriefcaseBusiness className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{resource.title}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {resource.name} · {formatBytes(resource.size)} · Added{" "}
                      {formatDate(resource.created_at)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#687b93]">
                      {categoryLabel(resource.category)}
                    </p>
                    {resource.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {resource.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/library?id=${encodeURIComponent(resource.id)}`}>
                      <Download className="mr-2 h-4 w-4" /> Download
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setEditingResource(resource)}
                    aria-label={`Edit ${resource.title}`}
                    title="Edit resource details"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => void remove(resource)}
                    disabled={deletingId === resource.id}
                    aria-label={`Delete ${resource.title}`}
                    title="Delete resource and file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={!!editingResource}
        onOpenChange={(open) => {
          if (!open && !saving) setEditingResource(null);
        }}
      >
        {editingResource && (
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit resource details</DialogTitle>
              <DialogDescription>
                Update the title, category, or description visitors see. The uploaded file stays
                unchanged.
              </DialogDescription>
            </DialogHeader>
            <form id="edit-library-resource" onSubmit={saveMetadata} className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Display title</Label>
                <Input
                  id="edit-title"
                  name="title"
                  required
                  minLength={2}
                  maxLength={200}
                  defaultValue={editingResource.title}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <select
                  id="edit-category"
                  name="category"
                  required
                  defaultValue={editingResource.category}
                  className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="article">Article</option>
                  <option value="novel">Novel</option>
                  <option value="business_plan">Business plan</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  maxLength={2000}
                  rows={4}
                  defaultValue={editingResource.description}
                  className="mt-1.5"
                />
              </div>
            </form>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingResource(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" form="edit-library-resource" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof BookOpen;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-white px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#eef2f8] text-[#334b6b]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-lg font-semibold">{value}</p>
      </div>
    </div>
  );
}
