import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { makeListing } from "@/test/factory";

// Mock react-leaflet (Leaflet needs real DOM sizing that jsdom lacks) so we can
// test OUR marker/fallback logic rather than the mapping library itself.
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children, center }: { children: React.ReactNode; center: [number, number] }) => (
    <div data-testid="map" data-center={center.join(",")}>
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tiles" />,
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("leaflet", () => ({
  default: { divIcon: () => ({}) },
}));

import { ListingMap } from "./ListingMap";

const renderMap = (listings: ReturnType<typeof makeListing>[]) =>
  render(
    <MemoryRouter>
      <ListingMap listings={listings} />
    </MemoryRouter>,
  );

describe("ListingMap", () => {
  it("renders one marker per located listing", () => {
    renderMap([
      makeListing({ id: "1", lat: 35, lon: 139 }),
      makeListing({ id: "2", lat: 36, lon: 138 }),
    ]);
    expect(screen.getAllByTestId("marker")).toHaveLength(2);
  });

  it("falls back to Japan center and renders no markers when list is empty", () => {
    renderMap([]);
    expect(screen.queryAllByTestId("marker")).toHaveLength(0);
    expect(screen.getByTestId("map").getAttribute("data-center")).toBe("36.2,138.2");
  });

  it("warns when a marker position is not exact", () => {
    renderMap([makeListing({ id: "3", lat: 35, lon: 139, geocode_accuracy: "city" })]);
    expect(screen.getByText(/non exacte/)).toBeInTheDocument();
  });
});
