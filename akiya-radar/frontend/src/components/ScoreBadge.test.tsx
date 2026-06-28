import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScoreBadge } from "./ScoreBadge";

describe("ScoreBadge", () => {
  it("renders the score value and accessible label", () => {
    render(<ScoreBadge score={72} />);
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByLabelText("Score 72 sur 100")).toBeInTheDocument();
  });

  it("shows a question mark and 'non scoré' label when score is null", () => {
    render(<ScoreBadge score={null} />);
    expect(screen.getByText("?")).toBeInTheDocument();
    expect(screen.getByLabelText("Non scoré")).toBeInTheDocument();
  });

  it("renders confidence when provided", () => {
    render(<ScoreBadge score={50} confidence={60} />);
    expect(screen.getByText(/conf\. 60%/)).toBeInTheDocument();
  });

  it("omits confidence when not provided", () => {
    render(<ScoreBadge score={50} />);
    expect(screen.queryByText(/conf\./)).not.toBeInTheDocument();
  });
});
