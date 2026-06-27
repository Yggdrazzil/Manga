import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ImportUrl } from "./ImportUrl";

function renderPage() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ImportUrl />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ImportUrl", () => {
  it("renders the URL input and import button", () => {
    renderPage();
    expect(screen.getByLabelText("URL source")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importer" })).toBeInTheDocument();
  });

  it("explains the never-fails import behaviour", () => {
    renderPage();
    expect(screen.getByText(/toujours créée/)).toBeInTheDocument();
  });
});
