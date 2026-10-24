import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";

export const BRAND = "ScholarDesk";

export function Logo({
  light = false,
  onClick,
}: {
  light?: boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground">
        <GraduationCap className="h-5 w-5" />
      </span>
      <span
        className={`font-display text-xl font-semibold ${
          light ? "text-ink-foreground" : "text-foreground"
        }`}
      >
        {BRAND}
      </span>
    </Link>
  );
}
