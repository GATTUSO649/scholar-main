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
import { uploadFiles } from "@/lib/requests";

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
const SERVICES_WITHOUT_UPLOADS = new Set(["Assignment Typing", "Practicum Report Writing"]);

type DetailField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number" | "select";
  options?: string[];
};

/** Extra questions asked per service. Matched by service name. */
const SERVICE_DETAILS: Record<string, { intro: string; fields: DetailField[] }> = {
  "Assignment Typing": {
    intro: "Tell us about the document you need typed.",
    fields: [
      {
        key: "source_format",
        label: "What format is your work in now?",
        type: "select",
        options: ["Handwritten notes", "Scanned pages / photos", "PDF", "Other"],
      },
      {
        key: "word_count",
        label: "Approximate word count",
        type: "number",
        placeholder: "e.g. 1500",
      },
      {
        key: "output_format",
        label: "Preferred output format",
        type: "select",
        options: ["Word (.docx)", "PDF", "Google Docs"],
      },
    ],
  },
  "Plagiarism Check & Removal": {
    intro: "Tell us about the draft you want checked.",
    fields: [
      { key: "similarity", label: "Current similarity score (if known)", placeholder: "e.g. 32%" },
      {
        key: "tool",
        label: "Which checker does your school use?",
        type: "select",
        options: ["Turnitin", "Grammarly", "Copyleaks", "Not sure", "Other"],
      },
      { key: "target", label: "Target similarity score", placeholder: "e.g. under 10%" },
    ],
  },
  "Project Task": {
    intro: "Tell us about the project you need help with.",
    fields: [
      {
        key: "project_type",
        label: "What kind of project is it?",
        type: "select",
        options: [
          "Individual project",
          "Group project",
          "Practical / field work",
          "Software or code",
          "Other",
        ],
      },
      {
        key: "deliverables",
        label: "What must be submitted?",
        placeholder: "e.g. report, slides, code, poster",
      },
      {
        key: "progress",
        label: "What have you done so far?",
        placeholder: "e.g. proposal approved, nothing yet",
      },
      { key: "group_size", label: "Group size (if any)", type: "number", placeholder: "e.g. 5" },
    ],
  },
  "Proofreading & Editing": {
    intro: "Tell us about the document to proofread.",
    fields: [
      {
        key: "doc_type",
        label: "Type of document",
        type: "select",
        options: ["Essay", "Report", "Thesis / dissertation", "Proposal", "Other"],
      },
      {
        key: "focus",
        label: "What should we focus on?",
        placeholder: "e.g. grammar, flow, clarity",
      },
    ],
  },
  "Research Guidance": {
    intro: "Tell us about your research.",
    fields: [
      {
        key: "topic",
        label: "Research topic or question",
        placeholder: "e.g. effect of mobile money on savings",
      },
      {
        key: "stage",
        label: "Where are you in the process?",
        type: "select",
        options: [
          "Choosing a topic",
          "Proposal",
          "Literature review",
          "Methodology",
          "Data analysis",
          "Writing up",
        ],
      },
    ],
  },
  "Assignment Review": {
    intro: "Tell us what you want reviewed.",
    fields: [
      {
        key: "focus",
        label: "What should we check?",
        placeholder: "e.g. structure, argument, calculations",
      },
      {
        key: "rubric",
        label: "Do you have a marking rubric?",
        type: "select",
        options: ["Yes — I will attach it", "No"],
      },
    ],
  },
  "Microsoft Word": {
    intro: "Tell us about the Word document or task you need support with.",
    fields: [
      {
        key: "word_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Formatting",
          "Styles and layout",
          "References",
          "Templates",
          "Accessibility",
          "Other",
        ],
      },
      { key: "word_pages", label: "Approximate number of pages", type: "number" },
    ],
  },
  "Microsoft Excel": {
    intro: "Tell us about the spreadsheet and what you want to accomplish.",
    fields: [
      {
        key: "excel_task",
        label: "What do you need help with?",
        type: "select",
        options: ["Formulas", "Charts", "Pivot tables", "Data cleanup", "Workbook setup", "Other"],
      },
      { key: "excel_rows", label: "Approximate number of rows", type: "number" },
    ],
  },
  "Microsoft PowerPoint": {
    intro: "Tell us about the presentation you are preparing.",
    fields: [
      { key: "slide_count", label: "Approximate number of slides", type: "number" },
      {
        key: "presentation_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Slide formatting",
          "Charts and diagrams",
          "Speaker notes",
          "Accessibility",
          "Other",
        ],
      },
    ],
  },
  "Microsoft Outlook": {
    intro: "Tell us about the Outlook setup or workflow you need help with.",
    fields: [
      {
        key: "outlook_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Email setup",
          "Calendar",
          "Rules and organization",
          "Contacts",
          "Troubleshooting",
          "Other",
        ],
      },
    ],
  },
  "Microsoft Teams": {
    intro: "Tell us about your Teams workspace or meeting setup.",
    fields: [
      {
        key: "teams_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Meetings",
          "Class or project team setup",
          "File sharing",
          "Channels",
          "Troubleshooting",
          "Other",
        ],
      },
      { key: "teams_members", label: "Approximate number of members", type: "number" },
    ],
  },
  "Microsoft OneDrive": {
    intro: "Tell us about your file storage, sync, or sharing needs.",
    fields: [
      {
        key: "onedrive_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Setup",
          "File sync",
          "Sharing and permissions",
          "Organization",
          "Troubleshooting",
          "Other",
        ],
      },
    ],
  },
  "Microsoft OneNote": {
    intro: "Tell us about your notes or notebook setup.",
    fields: [
      {
        key: "onenote_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Notebook setup",
          "Organization",
          "Templates",
          "Collaboration",
          "Sync troubleshooting",
          "Other",
        ],
      },
    ],
  },
  "Microsoft Forms": {
    intro: "Tell us about the form, survey, or quiz you want to create.",
    fields: [
      {
        key: "forms_task",
        label: "What are you creating?",
        type: "select",
        options: ["Survey", "Quiz", "Registration form", "Feedback form", "Other"],
      },
      { key: "forms_questions", label: "Approximate number of questions", type: "number" },
    ],
  },
  "Microsoft SharePoint": {
    intro: "Tell us about the SharePoint site, library, or collaboration setup.",
    fields: [
      {
        key: "sharepoint_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Site setup",
          "Document library",
          "Lists",
          "Access and permissions",
          "Troubleshooting",
          "Other",
        ],
      },
    ],
  },
  "Microsoft Access": {
    intro: "Tell us about the database task or issue.",
    fields: [
      {
        key: "access_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Database design",
          "Tables and relationships",
          "Queries",
          "Forms and reports",
          "Troubleshooting",
          "Other",
        ],
      },
    ],
  },
  "Microsoft Planner": {
    intro: "Tell us about the plan, tasks, or team workflow you want to organize.",
    fields: [
      {
        key: "planner_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Plan setup",
          "Task organization",
          "Group assignment workflow",
          "Progress tracking",
          "Other",
        ],
      },
      { key: "planner_tasks", label: "Approximate number of tasks", type: "number" },
    ],
  },
  "Microsoft Project": {
    intro: "Tell us about your project plan and what you want to track.",
    fields: [
      {
        key: "project_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Project plan setup",
          "Timeline and dependencies",
          "Resource planning",
          "Progress tracking",
          "Other",
        ],
      },
      { key: "project_tasks", label: "Approximate number of tasks", type: "number" },
    ],
  },
  "Microsoft Visio": {
    intro: "Tell us about the diagram or process map you need to create.",
    fields: [
      {
        key: "visio_type",
        label: "What type of diagram?",
        type: "select",
        options: ["Flowchart", "Process map", "Network diagram", "Organization chart", "Other"],
      },
      { key: "visio_pages", label: "Approximate number of pages", type: "number" },
    ],
  },
  "Microsoft Loop": {
    intro: "Tell us about the shared workspace or collaborative project.",
    fields: [
      {
        key: "loop_task",
        label: "What do you need help with?",
        type: "select",
        options: ["Workspace setup", "Project planning", "Shared notes", "Task tracking", "Other"],
      },
    ],
  },
  "Microsoft Sway": {
    intro: "Tell us about the interactive presentation or report you are preparing.",
    fields: [
      {
        key: "sway_type",
        label: "What are you creating?",
        type: "select",
        options: ["Presentation", "Report", "Story", "Portfolio", "Other"],
      },
    ],
  },
  "Microsoft 365 Setup & Support": {
    intro: "Tell us about your Microsoft 365 account, apps, or device setup.",
    fields: [
      {
        key: "m365_task",
        label: "What do you need help with?",
        type: "select",
        options: [
          "Installation",
          "Account setup",
          "App configuration",
          "Licensing guidance",
          "Troubleshooting",
          "Other",
        ],
      },
      { key: "m365_apps", label: "Which apps or devices are involved?" },
    ],
  },
};

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
  const details = selectedService ? SERVICE_DETAILS[selectedService.name] : undefined;
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
    setErrors({});
    setBusy(true);
    let description = p.data.description;
    if (details) {
      const extra = details.fields
        .map((f) => [f.label, raw[`detail_${f.key}`]] as const)
        .filter(([, v]) => typeof v === "string" && v.trim() !== "")
        .map(([l, v]) => `${l}: ${v}`);
      if (extra.length)
        description = `${description}\n\n--- ${selectedService!.name} details ---\n${extra.join("\n")}`;
    }
    try {
      const data = await createRequestFn({
        data: {
          title: p.data.title,
          service_id: p.data.service_id,
          description,
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

        {details && (
          <div className="grid gap-5 rounded-xl border border-accent/40 bg-accent/5 p-5 sm:col-span-2 sm:grid-cols-2">
            <p className="text-sm font-medium sm:col-span-2">{details.intro}</p>
            {details.fields.map((f) => (
              <div key={f.key}>
                <Label htmlFor={`detail_${f.key}`}>{f.label}</Label>
                {f.type === "select" ? (
                  <select
                    id={`detail_${f.key}`}
                    name={`detail_${f.key}`}
                    defaultValue=""
                    className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choose…</option>
                    {f.options!.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`detail_${f.key}`}
                    name={`detail_${f.key}`}
                    type={f.type ?? "text"}
                    min={f.type === "number" ? 0 : undefined}
                    placeholder={f.placeholder}
                    className="mt-1.5"
                  />
                )}
              </div>
            ))}
          </div>
        )}

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
            <Label>Files (PDF, Word, images — up to 20MB each)</Label>
            <label className="mt-1.5 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-muted">
              <Upload className="h-6 w-6" />
              <span className="mt-2">Tap to choose files</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) =>
                  setFiles(
                    [...files, ...Array.from(e.target.files ?? [])].filter(
                      (f) => f.size <= 20 * 1024 * 1024,
                    ),
                  )
                }
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
