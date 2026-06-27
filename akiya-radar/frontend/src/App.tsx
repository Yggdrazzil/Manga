import { Navigate, Route, Routes } from "react-router-dom";

import { Layout } from "@/components/Layout";
import { Dashboard } from "@/pages/Dashboard";
import { ImportUrl } from "@/pages/ImportUrl";
import { Listings } from "@/pages/Listings";
import { ListingDetailPage } from "@/pages/ListingDetail";
import { MapView } from "@/pages/MapView";
import { SavedSearches } from "@/pages/SavedSearches";
import { Settings } from "@/pages/Settings";
import { Sources } from "@/pages/Sources";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/listings/:id" element={<ListingDetailPage />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/import" element={<ImportUrl />} />
        <Route path="/sources" element={<Sources />} />
        <Route path="/saved-searches" element={<SavedSearches />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}
