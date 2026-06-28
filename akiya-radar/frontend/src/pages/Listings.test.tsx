import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeListing } from "@/test/factory";

const listingsMock = vi.fn();
const setFavoriteMock = vi.fn();

vi.mock("@/api/client", () => ({
  api: {
    listings: (...args: unknown[]) => listingsMock(...args),
    setFavorite: (...args: unknown[]) => setFavoriteMock(...args),
  },
}));

import { Listings } from "./Listings";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Listings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Listings filters", () => {
  beforeEach(() => {
    listingsMock.mockReset();
    listingsMock.mockResolvedValue({
      items: [makeListing()],
      total: 1,
      limit: 12,
      offset: 0,
    });
  });

  it("renders listings returned by the API", async () => {
    renderPage();
    expect(await screen.findByText("敦賀 古民家")).toBeInTheDocument();
    expect(screen.getByText(/Annonces/)).toBeInTheDocument();
  });

  it("passes the max price filter to the API query", async () => {
    renderPage();
    await screen.findByText("敦賀 古民家");
    await userEvent.type(screen.getByLabelText("Prix max (¥)"), "5000000");
    await waitFor(() => {
      expect(
        listingsMock.mock.calls.some(
          ([f]) => (f as { max_price_yen?: number })?.max_price_yen === 5000000,
        ),
      ).toBe(true);
    });
  });

  it("passes the exclude-critical-flags filter", async () => {
    renderPage();
    await screen.findByText("敦賀 古民家");
    await userEvent.click(screen.getByLabelText("Exclure red flags critiques"));
    await waitFor(() => {
      expect(
        listingsMock.mock.calls.some(
          ([f]) => (f as { exclude_critical_flags?: boolean })?.exclude_critical_flags === true,
        ),
      ).toBe(true);
    });
  });
});
