import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AdminGate } from "@/components/AdminGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getAdminLibraryResourcesFn } from "@/lib/backend";

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
  const { user } = Route.useRouteContext();
  return (
    <AdminGate userId={user.id}>
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
  } = useQuery({
    queryKey: ["admin-library-resources"],
    queryFn: () => getAdminLibraryResourcesFn(),
  });
  const [busy, setBusy] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        body,
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not upload the resource.");
      form.reset();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-library-resources"] }),
        queryClient.invalidateQueries({ queryKey: ["library-resources"] }),
      ]);
      toast.success("Download added to the public library.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the resource.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this download from the public library?")) return;
    try {
      const response = await fetch(`/api/library?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not remove the resource.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-library-resources"] }),
        queryClient.invalidateQueries({ queryKey: ["library-resources"] }),
      ]);
      toast.success("Download removed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the resource.");
    }
  }

  return (
    <div className="space-y-7">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#687b93]">
          Public content
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Library</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Upload novels, business plans, and articles for visitors to download.
        </p>
      </header>

      <form
        onSubmit={upload}
        className="grid gap-5 rounded-2xl border bg-white p-5 shadow-soft sm:grid-cols-2 sm:p-7"
      >
        <div>
          <Label htmlFor="title">Display title</Label>
          <Input
            id="title"
            name="title"
            required
            minLength={2}
            maxLength={200}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
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
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            name="description"
            maxLength={2000}
            rows={3}
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="file">File (PDF, EPUB, Word, or plain text — up to 25 MB)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.epub,.doc,.docx,.txt"
            required
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />
            {busy ? "Uploading…" : "Publish download"}
          </Button>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-soft">
        <div className="border-b px-5 py-4 sm:px-6">
          <h2 className="font-semibold">Published resources</h2>
        </div>
        {isLoading ? (
          <p className="p-5 text-sm text-muted-foreground">Loading resources…</p>
        ) : isError ? (
          <p className="p-5 text-sm text-destructive">
            Could not load resources. Refresh to retry.
          </p>
        ) : resources.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">No resources have been published yet.</p>
        ) : (
          <ul className="divide-y">
            {resources.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
              >
                <div className="min-w-0">
                  <p className="font-medium">{resource.title}</p>
                  <p className="mt-1 text-xs capitalize text-muted-foreground">
                    {resource.category.replace("_", " ")} · {resource.name}
                  </p>
                  {resource.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{resource.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/library?id=${encodeURIComponent(resource.id)}`}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => remove(resource.id)}
                    aria-label={`Remove ${resource.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
