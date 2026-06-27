import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Flag } from "@/lib/types";

import { FlagBadge } from "./FlagBadge";

const flag: Flag = {
  id: "f1",
  flag_code: "rebuild_forbidden",
  label_fr: "Reconstruction impossible",
  severity: "critical",
  explanation_fr: "Pas de reconstruction possible.",
  recommended_action_fr: "Vérifier l'accès.",
};

describe("FlagBadge", () => {
  it("shows full label when full prop is set", () => {
    render(<FlagBadge flag={flag} full />);
    expect(screen.getByText("Reconstruction impossible")).toBeInTheDocument();
  });

  it("exposes the explanation as a title for tooltips", () => {
    render(<FlagBadge flag={flag} full />);
    expect(screen.getByTitle("Pas de reconstruction possible.")).toBeInTheDocument();
  });
});
