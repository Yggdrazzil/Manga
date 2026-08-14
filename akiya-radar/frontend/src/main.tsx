import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";

import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

// Hash routing whenever no server can rewrite unknown paths to index.html:
// the self-contained preview (opened straight from a file) and the serverless
// build (GitHub Pages, which answers 404 on a deep link or a refresh).
// The Docker deployment runs behind Vite/Caddy, which do rewrite, so it keeps
// clean URLs.
const IS_SERVERLESS =
  import.meta.env.VITE_MOCK === "1" || import.meta.env.VITE_DATA_MODE === "static";
const Router = IS_SERVERLESS ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
