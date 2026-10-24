import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/downloads")({
  beforeLoad: () => {
    throw redirect({ to: "/library", replace: true });
  },
});
