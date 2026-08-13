import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogEntry } from "@/lib/types";

const catalogMock = vi.fn();
const prefecturesMock = vi.fn();
const addMock = vi.fn();

vi.mock("@/api/client", () => ({
  api: {
    catalog: (...args: unknown[]) => catalogMock(...args),
    catalogPrefectures: (...args: unknown[]) => prefecturesMock(...args),
    catalogAdd: (...args: unknown[]) => addMock(...args),
  },
}));

import { Catalogue } from "./Catalogue";

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  key: "athome-18202",
  name: "敦賀市 空き家バンク（アットホーム）",
  source_type: "athome_akiya_bank",
  url: "https://tsuruga-c18202.akiya-athome.jp/",
  prefecture: "福井県",
  municipality: "敦賀市",
  adapter: "athome_municipal",
  crawlable: true,
  scope: "municipal",
  notes_fr: null,
  requires_js: false,
  registered: false,
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Catalogue />
    </QueryClientProvider>,
  );
}

describe("Catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prefecturesMock.mockResolvedValue([
      { prefecture: "福井県", total: 37, structured: 14 },
      { prefecture: "北海道", total: 120, structured: 60 },
    ]);
    catalogMock.mockResolvedValue({ items: [entry()], total: 1, limit: 30, offset: 0 });
    addMock.mockResolvedValue({ added: [], skipped: [] });
  });

  it("announces how many real sources the catalogue covers", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("157")).toBeInTheDocument());
    expect(screen.getByText("74")).toBeInTheDocument();
  });

  it("marks structured sources so the user knows which ones yield full listings", async () => {
    renderPage();
    expect(await screen.findByText("structurée")).toBeInTheDocument();
  });

  it("does not offer to add a source that is already registered", async () => {
    catalogMock.mockResolvedValue({
      items: [entry({ registered: true })],
      total: 1,
      limit: 30,
      offset: 0,
    });
    renderPage();
    expect(await screen.findByText("déjà ajoutée")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Sélectionner/ })).toBeDisabled();
  });

  it("adds the selected sources without enabling crawling by default", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("checkbox", { name: /Sélectionner/ }));
    await user.click(screen.getByRole("button", { name: /Ajouter \(sans crawl\)/ }));
    await waitFor(() =>
      expect(addMock).toHaveBeenCalledWith(["athome-18202"], false),
    );
  });

  it("can add and enable collection in one action", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("checkbox", { name: /Sélectionner/ }));
    await user.click(screen.getByRole("button", { name: /activer la collecte/ }));
    await waitFor(() => expect(addMock).toHaveBeenCalledWith(["athome-18202"], true));
  });

  it("filters by prefecture", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("structurée");
    await user.selectOptions(screen.getByLabelText("Préfecture"), "北海道");
    await waitFor(() =>
      expect(catalogMock).toHaveBeenCalledWith(
        expect.objectContaining({ prefecture: "北海道" }),
      ),
    );
  });

  it("restricts to structured sources on demand", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("structurée");
    await user.click(screen.getByLabelText(/Sources structurées uniquement/));
    await waitFor(() =>
      expect(catalogMock).toHaveBeenCalledWith(
        expect.objectContaining({ adapter: "athome_municipal" }),
      ),
    );
  });
});
