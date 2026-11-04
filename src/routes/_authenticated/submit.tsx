import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRequestFn, getPublicDataFn } from "@/lib/backend";
import { SERVICES_WITHOUT_UPLOADS, uploadFiles, validateUploadFiles } from "@/lib/requests";

export const Route = createFileRoute("/_authenticated/submit")({
  validateSearch: (s: Record<string, unknown>): { service?: string } =>
    typeof s["service"] === "string" ? { service: s["service"] as string } : {},
  head: () => ({
    meta: [
      { title: "Submit a request — ScholarDesk" },
      { name: "description", content: "Submit a new academic support request." },
    ],
  }),
  component: Submit,
});

const schema = z.object({
  title: z.string().trim().min(3, "Add a title").max(200),
  service_id: z.string().uuid("Choose a type of support"),
  course_unit: z.string().trim().max(120).optional(),
  lecturer: z.string().trim().max(120).optional(),
  academic_level: z.string().trim().max(60).optional(),
  description: z.string().trim().min(10, "Describe what you need (10+ characters)").max(5000),
  num_questions: z.coerce.number().int().min(0).max(500).optional(),
  num_pages: z.coerce.number().int().min(0).max(1000).optional(),
  deadline: z.string().min(1, "Set a deadline"),
  preferred_date: z.string().optional(),
});

const LEVELS = ["Certificate", "Diploma", "Undergraduate", "Masters", "PhD"];
function Submit() {
  const { user } = Route.useRouteContext();
  const { service: preselected } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serviceId, setServiceId] = useState(preselected ?? "");
  const { data: services = [] } = useQuery({
    queryKey: ["services"],
    queryFn: async () => (await getPublicDataFn()).services,
  });

  const selectedService = services.find((s) => s.id === serviceId);
  const uploadsAllowed = !selectedService || !SERVICES_WITHOUT_UPLOADS.has(selectedService.name);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(
      Array.from(new FormData(e.currentTarget)).filter(([, v]) => v !== ""),
    );
    const p = schema.safeParse(raw);
    if (!p.success) {
      setErrors(Object.fromEntries(p.error.issues.map((i) => [i.path[0] as string, i.message])));
      return;
    }
    if (new Date(p.data.deadline) < new Date()) {
      setErrors({ deadline: "Deadline must be in the future" });
      return;
    }
    const requestService = services.find((service) => service.id === p.data.service_id);
    const requestAllowsUploads =
      !requestService || !SERVICES_WITHOUT_UPLOADS.has(requestService.name);
    const uploadError = requestAllowsUploads ? validateUploadFiles(files) : null;
    if (uploadError) {
      toast.error(uploadError);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const data = await createRequestFn({
        data: {
          title: p.data.title,
          service_id: p.data.service_id,
          description: p.data.description,
          course_unit: p.data.course_unit ?? null,
          lecturer: p.data.lecturer ?? null,
          academic_level: p.data.academic_level ?? null,
          num_questions: p.data.num_questions ?? null,
          num_pages: p.data.num_pages ?? null,
          deadline: new Date(p.data.deadline).toISOString(),
          preferred_date: p.data.preferred_date
            ? new Date(p.data.preferred_date).toISOString()
            : null,
        },
      });
      const filesUploaded =
        requestAllowsUploads && files.length
          ? await uploadFiles(data.id, files, "submission")
          : true;
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      toast[filesUploaded ? "success" : "error"](
        filesUploaded
          ? "Request submitted! We'll review it shortly."
          : "Request submitted, but the files could not be uploaded. Open the request and try again.",
      );
      navigate({ to: "/request/$id", params: { id: data.id } });
    } catch (error) {
      setBusy(false);
      toast.error(error instanceof Error ? error.message : "Could not submit request.");
    }
  }

  const err = (k: string) =>
    errors[k] && <p className="mt-1 text-xs text-destructive">{errors[k]}</p>;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Submit a request</h1>
      <p className="mt-2 text-muted-foreground">
        Tell us what you need. You'll get a quote before paying anything.
      </p>
      <form
        onSubmit={submit}
        noValidate
        className="mt-8 grid gap-5 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-2 sm:p-8"
      >
        <div className="sm:col-span-2">
          <Label htmlFor="title">Assignment title</Label>
          <Input id="title" name="title" className="mt-1.5" />
          {err("title")}
        </div>
        <div>
          <Label htmlFor="service_id">Type of academic support</Label>
          <select
            id="service_id"
            name="service_id"
            value={serviceId}
            onChange={(e) => {
              const nextServiceId = e.target.value;
              const nextService = services.find((service) => service.id === nextServiceId);
              setServiceId(nextServiceId);
              if (nextService && SERVICES_WITHOUT_UPLOADS.has(nextService.name)) {
                setFiles([]);
              }
            }}
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Choose…
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {err("service_id")}
        </div>
        <div>
          <Label htmlFor="academic_level">Academic level</Label>
          <select
            id="academic_level"
            name="academic_level"
            defaultValue=""
            className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Choose…</option>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="course_unit">Course / unit (optional)</Label>
          <Input id="course_unit" name="course_unit" className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="lecturer">Lecturer / tutor name (optional)</Label>
          <Input id="lecturer" name="lecturer" className="mt-1.5" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="description">Instructions — what exactly do you need done?</Label>
          <Textarea id="description" name="description" rows={6} className="mt-1.5" />
          {err("description")}
        </div>
        <div>
          <Label htmlFor="num_questions">Number of questions (optional)</Label>
          <Input id="num_questions" name="num_questions" type="number" min={0} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="num_pages">Number of pages (optional)</Label>
          <Input id="num_pages" name="num_pages" type="number" min={0} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" name="deadline" type="datetime-local" className="mt-1.5" />
          {err("deadline")}
        </div>
        <div>
          <Label htmlFor="preferred_date">Preferred completion date</Label>
          <Input
            id="preferred_date"
            name="preferred_date"
            type="datetime-local"
            className="mt-1.5"
          />
        </div>
        {uploadsAllowed && (
          <div className="sm:col-span-2">
            <Label>Documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT; up to 20 MB each)</Label>
            <label className="mt-1.5 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted">
              <Upload className="h-6 w-6" />
              <span className="mt-2">Tap to choose files</span>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                className="hidden"
                onChange={(e) => {
                  setFiles([...files, ...Array.from(e.target.files ?? [])]);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-muted px-3 py-1.5"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="sm:col-span-2">
          <Button size="lg" disabled={busy} className="w-full sm:w-auto">
            {busy ? "Submitting…" : "Submit request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
