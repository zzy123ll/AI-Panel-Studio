import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import SetupPage from "./pages/SetupPage";
import StudioPage from "./pages/StudioPage";
import { DiscussionProvider } from "./stores/discussionStore";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/setup/:id" element={<SetupPage />} />
        <Route
          path="/studio/:id"
          element={
            <DiscussionProvider>
              <StudioPage />
            </DiscussionProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
