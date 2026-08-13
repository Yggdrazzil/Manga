import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeListing } from "@/test/factory";

import { ListingCard } from "./ListingCard";

const renderCard = (props: Parameters<typeof ListingCard>[0]) =>
  render(
    <MemoryRouter>
      <ListingCard {...props} />
    </MemoryRouter>,
  );

describe("ListingCard", () => {
  beforeEach(() => {
    localStorage.clear();
    // Prices are converted at display time now, so the card needs a rate.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ date: "2026-08-13", rates: { EUR: 0.005, USD: 0.0064 } }),
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("renders title, area, and the price in yen", () => {
    renderCard({ listing: makeListing() });
    expect(screen.getByText("敦賀 古民家")).toBeInTheDocument();
    expect(screen.getByText(/3\s?800\s?000\s?¥/)).toBeInTheDocument();
    expect(screen.getByText("220 m²")).toBeInTheDocument();
  });

  it("converts the yen price at today's rate rather than a stored one", async () => {
    // The listing carries a stale price_eur of 22 800; at 0.005 the live
    // figure is 19 000, and that is what must be shown.
    renderCard({ listing: makeListing({ price_eur: 22_800 }) });
    await waitFor(() => expect(screen.getByText(/19\s?000/)).toBeInTheDocument());
    expect(screen.queryByText(/22\s?800/)).not.toBeInTheDocument();
  });

  it("shows the score badge", () => {
    renderCard({ listing: makeListing() });
    expect(screen.getByLabelText("Score 72 sur 100")).toBeInTheDocument();
  });

  it("renders red flag badges", () => {
    renderCard({ listing: makeListing() });
    expect(screen.getByText(/Reconstruction/)).toBeInTheDocument();
  });

  it("fires favorite toggle", async () => {
    const onToggle = vi.fn();
    renderCard({ listing: makeListing(), onToggleFavorite: onToggle });
    await userEvent.click(screen.getByLabelText("Ajouter aux favoris"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("handles missing price gracefully", () => {
    renderCard({ listing: makeListing({ price_yen: null, price_eur: null }) });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
