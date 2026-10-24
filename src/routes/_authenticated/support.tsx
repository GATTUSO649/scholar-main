import { createFileRoute } from "@tanstack/react-router";
import { Mail, Phone, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Help & support — ScholarDesk" },
      { name: "description", content: "Get help with your account or requests." },
    ],
  }),
  component: Support,
});

function Support() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">Help & support</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Mail, t: "Email", d: "support@scholardesk.app" },
          { icon: Phone, t: "Phone / WhatsApp", d: "+254 700 000 000" },
          { icon: Clock, t: "Hours", d: "Mon–Sat, 8:00–20:00 EAT" },
        ].map((c) => (
          <div key={c.t} className="rounded-2xl border bg-card p-5 shadow-soft">
            <c.icon className="h-5 w-5 text-accent" />
            <p className="mt-3 text-sm text-muted-foreground">{c.t}</p>
            <p className="font-semibold">{c.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Please include your request reference (e.g. REQ-AB12CD) when contacting us.
      </p>
    </div>
  );
}
