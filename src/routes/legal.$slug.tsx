import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PublicPage, PublicPageHeading } from "@/components/PublicPage";
import { getPublicLegalDocumentFn } from "@/lib/backend";

export const Route = createFileRoute("/legal/$slug")({
  head: () => ({ meta: [{ title: "Legal information — ScholarDesk" }] }),
  component: LegalDocumentPage,
});

function LegalDocumentPage() {
  const { slug } = Route.useParams();
  const {
    data: document,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-legal-document", slug],
    queryFn: () => getPublicLegalDocumentFn({ data: { slug } }),
  });

  return (
    <PublicPage>
      <section className="px-5 py-14 sm:py-20">
        {isLoading ? (
          <p className="mx-auto max-w-3xl py-10 text-center text-sm text-muted-foreground">
            Loading document…
          </p>
        ) : isError || !document ? (
          <div className="mx-auto max-w-3xl py-10 text-center">
            <PublicPageHeading eyebrow="Legal" title="Document unavailable" />
            <p className="mt-5 text-muted-foreground">
              This document may have been unpublished or moved.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <PublicPageHeading eyebrow="Legal" title={document.title} />
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Updated {new Date(document.updatedAt).toLocaleDateString()}
            </p>
            <article className="mt-10 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-foreground">
              {document.content}
            </article>
          </div>
        )}
      </section>
    </PublicPage>
  );
}
