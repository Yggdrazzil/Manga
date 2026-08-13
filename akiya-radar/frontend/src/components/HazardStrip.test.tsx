import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HazardStrip } from "./HazardStrip";
import type { HazardScore } from "@/lib/types";

const hazard = (over: Partial<HazardScore> = {}): HazardScore => ({
  id: "h1",
  flood_risk: "none",
  tsunami_risk: "none",
  landslide_risk: "none",
  storm_surge_risk: "none",
  earthquake_risk: "low",
  source_name: "J-SHIS + 重ねるハザードマップ",
  raw_json: null,
  created_at: new Date().toISOString(),
  ...over,
});

describe("HazardStrip", () => {
  it("shows nothing on a card when hazards were never checked", () => {
    const { container } = render(<HazardStrip hazard={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("tells the user hazards are unverified in the full view", () => {
    render(<HazardStrip hazard={undefined} variant="full" />);
    expect(screen.getByText(/non encore vérifiés/i)).toBeInTheDocument();
  });

  it("surfaces the worst mapped zone on a card", () => {
    render(<HazardStrip hazard={hazard({ tsunami_risk: "high", flood_risk: "low" })} />);
    expect(screen.getByText(/Tsunami · Élevé/)).toBeInTheDocument();
  });

  it("confirms when every layer is mapped and clear", () => {
    render(<HazardStrip hazard={hazard()} />);
    expect(screen.getByText(/Hors zone d'aléa/)).toBeInTheDocument();
  });

  it("never reports an unverified layer as clear", () => {
    render(<HazardStrip hazard={hazard({ flood_risk: "unknown" })} variant="full" />);
    expect(screen.getByText("Non vérifié")).toBeInTheDocument();
    // "Hors zone" must not be claimed for the layer we could not read.
    expect(screen.getAllByText("Hors zone")).toHaveLength(3);
  });

  it("flags a high seismic risk on the card", () => {
    render(<HazardStrip hazard={hazard({ earthquake_risk: "high" })} />);
    expect(screen.getByText("Séisme élevé")).toBeInTheDocument();
  });

  it("lists every layer with its source in the full view", () => {
    render(<HazardStrip hazard={hazard({ landslide_risk: "medium" })} variant="full" />);
    expect(screen.getByText("Inondation")).toBeInTheDocument();
    expect(screen.getByText("Glissement de terrain")).toBeInTheDocument();
    expect(screen.getByText("Modéré")).toBeInTheDocument();
    expect(screen.getByText(/J-SHIS/)).toBeInTheDocument();
  });
});
