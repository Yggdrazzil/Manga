import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const translateMock = vi.fn();
vi.mock("@/api/client", () => ({ api: { translateText: (t: string) => translateMock(t) } }));

import { TranslatableText } from "./TranslatableText";

function renderText(text: string | null) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TranslatableText text={text} />
    </QueryClientProvider>,
  );
}

describe("TranslatableText", () => {
  beforeEach(() => translateMock.mockReset());

  it("shows the Japanese text and a translate button", () => {
    renderText("再建築不可の物件");
    expect(screen.getByText("再建築不可の物件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Traduire en français/ })).toBeInTheDocument();
  });

  it("fetches and reveals the translation on demand, then toggles", async () => {
    translateMock.mockResolvedValue({ translated: "Bien reconstruction impossible", provider: "demo" });
    renderText("再建築不可の物件");

    await userEvent.click(screen.getByRole("button", { name: /Traduire en français/ }));
    await waitFor(() => expect(screen.getByText("Bien reconstruction impossible")).toBeInTheDocument());
    expect(translateMock).toHaveBeenCalledWith("再建築不可の物件");

    // Toggling hides without re-fetching.
    await userEvent.click(screen.getByRole("button", { name: /Masquer la traduction/ }));
    expect(screen.queryByText("Bien reconstruction impossible")).not.toBeInTheDocument();
    expect(translateMock).toHaveBeenCalledTimes(1);
  });

  it("renders a dash when there is no text", () => {
    renderText(null);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
