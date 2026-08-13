import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CompletenessMeter } from "./CompletenessMeter";

describe("CompletenessMeter", () => {
  it("labels a well-filled listing as complete", () => {
    render(<CompletenessMeter value={94} variant="bar" />);
    expect(screen.getByText("Fiche complète")).toBeInTheDocument();
    expect(screen.getByText("94%")).toBeInTheDocument();
  });

  it("warns when most of the core is missing", () => {
    render(<CompletenessMeter value={22} variant="bar" />);
    expect(screen.getByText("Fiche très incomplète")).toBeInTheDocument();
  });

  it("does not claim completeness when it is unknown", () => {
    render(<CompletenessMeter value={null} variant="bar" />);
    expect(screen.getByText("Complétude inconnue")).toBeInTheDocument();
  });

  it("exposes the progress to assistive technology", () => {
    render(<CompletenessMeter value={60} variant="bar" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("stays readable inline on a card", () => {
    render(<CompletenessMeter value={75} />);
    expect(screen.getByTitle(/75% des informations clés/)).toBeInTheDocument();
  });
});
