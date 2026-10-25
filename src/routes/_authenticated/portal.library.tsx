import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  FileText,
  Search,
  Smartphone,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
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
import { getStudentLibraryResourcesFn } from "@/lib/backend";

type LibraryCategory = "all" | "novel" | "business_plan" | "article";
type StudentResource = {
  id: string;
  title: string;
  description: string;
  category: Exclude<LibraryCategory, "all">;
  name: string;
  size: number;
  price: number;
  currency: string;
  created_at: string;
  purchase_status: "free" | "available" | "pending" | "paid" | "failed";
};

const categories: { id: LibraryCategory; label: string }[] = [
  { id: "all", label: "All resources" },
  { id: "article", label: "Articles" },
  { id: "novel", label: "Novels" },
  { id: "business_plan", label: "Business plans" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const Route = createFileRoute("/_authenticated/portal/library")({
  head: () => ({
    meta: [
      { title: "Student Library — ScholarDesk" },
      { name: "description", content: "Browse and download resources in your student portal." },
    ],
  }),
  component: StudentLibraryPage,
});

function StudentLibraryPage() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<LibraryCategory>("all");
  const [search, setSearch] = useState("");
  const [purchaseResource, setPurchaseResource] = useState<StudentResource | null>(null);
  const [purchasePhone, setPurchasePhone] = useState("");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [checkingPurchaseId, setCheckingPurchaseId] = useState<string | null>(null);
  const {
    data: resources = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["library-resources"],
    queryFn: () => getStudentLibraryResourcesFn(),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const categoryMatches = category === "all" || resource.category === category;
      const searchMatches =
        !needle ||
        `${resource.title} ${resource.description} ${resource.name} ${resource.category}`
          .toLowerCase()
          .includes(needle);
      return categoryMatches && searchMatches;
    });
  }, [category, resources, search]);

  async function checkPurchase(purchaseId: string) {
    setCheckingPurchaseId(purchaseId);
    try {
      const response = await fetch("/api/library/purchase", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchaseId }),
      });
      const result = (await response.json().catch(() => null)) as {
        status?: "pending" | "paid" | "failed" | "not_found";
        error?: string;
      } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not check payment status.");
      await queryClient.invalidateQueries({ queryKey: ["library-resources"] });
      if (result?.status === "paid") toast.success("Payment confirmed. Your document is ready.");
      else if (result?.status === "failed")
        toast.error("Payment was not completed. You can try again.");
      else toast("Payment is still processing. Refresh this page in a moment.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not check payment status.");
    } finally {
      setCheckingPurchaseId(null);
    }
  }

  async function startPurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchaseResource) return;
    setPurchaseBusy(true);
    try {
      const phoneNumber = purchasePhone.replace(/[\s+()-]/g, "");
      const normalizedPhone = phoneNumber.startsWith("0")
        ? `254${phoneNumber.slice(1)}`
        : phoneNumber;
      const response = await fetch("/api/library/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resourceId: purchaseResource.id, phoneNumber: normalizedPhone }),
      });
      const result = (await response.json().catch(() => null)) as {
        purchaseId?: string;
        status?: string;
        message?: string;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not start payment.");
      setPurchaseResource(null);
      setPurchasePhone("");
      await queryClient.invalidateQueries({ queryKey: ["library-resources"] });
      if (result?.status === "paid") {
        toast.success("You already own this document.");
        return;
      }
      if (result?.purchaseId) {
        toast.success(result.message ?? "Payment prompt sent. Enter your M-Pesa PIN to continue.");
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const check = await fetch("/api/library/purchase", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ purchaseId: result.purchaseId }),
          });
          const state = (await check.json().catch(() => null)) as { status?: string } | null;
          await queryClient.invalidateQueries({ queryKey: ["library-resources"] });
          if (state?.status === "paid") {
            toast.success("Payment confirmed. Your document is ready to download.");
            return;
          }
          if (state?.status === "failed" || state?.status === "not_found") {
            toast.error("Payment was not completed. You can try again.");
            return;
          }
        }
        toast("Payment is still processing. Use Check payment on the document when ready.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start payment.");
    } finally {
      setPurchaseBusy(false);
    }
  }

  return (
    <section className="space-y-7">
      <header className="rounded-2xl bg-hero px-6 py-8 text-ink-foreground shadow-soft sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
          Student workspace
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Library</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-foreground/75">
          Browse and download novels, business plans, and articles from your student portal.
        </p>
      </header>

      <div className="rounded-2xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search titles, categories, or files"
              aria-label="Search student library"
              className="h-11 rounded-xl pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                aria-pressed={category === item.id}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  category === item.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent/30 hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isLoading
            ? "Loading your library…"
            : `${filtered.length} resource${filtered.length === 1 ? "" : "s"}`}
        </p>
        {isError && (
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Try again"}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading library">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border bg-card" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-card p-8 text-center">
          <h2 className="font-semibold">Your library couldn’t load</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Check your connection and retry. Your library is unchanged.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card px-6 py-14 text-center shadow-soft">
          <BookOpen className="mx-auto h-9 w-9 text-accent" />
          <h2 className="mt-4 text-lg font-semibold">
            {resources.length ? "No matching resources" : "The library is being stocked"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {resources.length
              ? "Try another search or select a different category."
              : "New articles, novels, and business plans will appear here when they are published."}
          </p>
          {resources.length > 0 && (search || category !== "all") && (
            <Button
              variant="outline"
              className="mt-5"
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((resource) => (
            <article
              key={resource.id}
              className="group flex min-h-64 flex-col rounded-2xl border bg-card p-6 shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/20 text-primary">
                  {resource.category === "novel" ? (
                    <BookOpen className="h-5 w-5" />
                  ) : resource.category === "business_plan" ? (
                    <BriefcaseBusiness className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </span>
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  {resource.category.replace("_", " ")}
                </span>
              </div>
              <h2 className="mt-5 text-xl font-semibold leading-snug">{resource.title}</h2>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
                {resource.description || "A resource shared by the ScholarDesk team."}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-4 text-xs text-muted-foreground">
                <span>{resource.name.split(".").pop()?.toUpperCase() ?? "FILE"}</span>
                <span aria-hidden="true">·</span>
                <span>{formatBytes(resource.size)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-foreground">
                  {resource.price > 0
                    ? `${resource.currency} ${resource.price.toLocaleString()}`
                    : "Free"}
                </span>
              </div>
              {resource.purchase_status === "free" || resource.purchase_status === "paid" ? (
                <Button asChild className="mt-5 w-full">
                  <a href={`/api/library?id=${encodeURIComponent(resource.id)}`}>
                    {resource.purchase_status === "paid" ? (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {resource.purchase_status === "paid"
                      ? "Owned · Download"
                      : "Download free resource"}
                  </a>
                </Button>
              ) : resource.purchase_status === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-5 w-full"
                  onClick={() => {
                    const pending = resources.find((candidate) => candidate.id === resource.id);
                    if (pending) void checkPurchase(pending.id);
                  }}
                  disabled={checkingPurchaseId === resource.id}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  {checkingPurchaseId === resource.id ? "Checking payment…" : "Check payment"}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="mt-5 w-full"
                  onClick={() => setPurchaseResource(resource)}
                >
                  <Smartphone className="mr-2 h-4 w-4" />
                  {resource.purchase_status === "failed" ? "Try payment again" : "Buy document"}
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!purchaseResource}
        onOpenChange={(open) => {
          if (!open && !purchaseBusy) setPurchaseResource(null);
        }}
      >
        {purchaseResource && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Buy this resource</DialogTitle>
              <DialogDescription>
                An M-Pesa prompt will be sent to your phone. The download unlocks after payment is
                confirmed.
              </DialogDescription>
            </DialogHeader>
            <div className="border-y py-3">
              <p className="font-semibold">{purchaseResource.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {purchaseResource.currency} {purchaseResource.price.toLocaleString()}
              </p>
            </div>
            <form id="library-purchase" onSubmit={startPurchase} className="space-y-2">
              <Label htmlFor="purchase-phone">Safaricom phone number</Label>
              <Input
                id="purchase-phone"
                type="tel"
                autoComplete="tel"
                placeholder="07XX XXX XXX or 2547XX XXX XXX"
                value={purchasePhone}
                onChange={(event) => setPurchasePhone(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Charges are made in whole KES using M-Pesa STK Push.
              </p>
            </form>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPurchaseResource(null)}
                disabled={purchaseBusy}
              >
                Cancel
              </Button>
              <Button type="submit" form="library-purchase" disabled={purchaseBusy}>
                {purchaseBusy ? "Sending prompt…" : "Pay with M-Pesa"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
