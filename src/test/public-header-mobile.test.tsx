import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SiteHeader } from "@/components/SiteHeader";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={typeof to === "string" ? to : to?.pathname ?? "/"} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  broadcastAuthSessionChange: vi.fn(),
  subscribeToAuthSessionChanges: () => () => {},
  useIsAdmin: () => ({ data: false, isLoading: false, isError: false }),
  useUser: () => ({ user: null }),
}));

describe("public header mobile actions", () => {
  it("keeps the student login action visible on small screens", () => {
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <SiteHeader overlay={false} />
      </QueryClientProvider>,
    );

    const login = screen.getByRole("link", { name: /student login/i });
    expect(login).not.toHaveClass("hidden");
  });
});
