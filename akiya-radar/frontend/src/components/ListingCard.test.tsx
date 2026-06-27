import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { makeListing } from "@/test/factory";

import { ListingCard } from "./ListingCard";

const renderCard = (props: Parameters<typeof ListingCard>[0]) =>
  render(
    <MemoryRouter>
      <ListingCard {...props} />
    </MemoryRouter>,
  );

describe("ListingCard", () => {
  it("renders title, price in yen and euro, and area", () => {
    renderCard({ listing: makeListing() });
    expect(screen.getByText("敦賀 古民家")).toBeInTheDocument();
    expect(screen.getByText(/3\s?800\s?000\s?¥/)).toBeInTheDocument();
    expect(screen.getByText(/22\s?800/)).toBeInTheDocument();
    expect(screen.getByText("220 m²")).toBeInTheDocument();
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
