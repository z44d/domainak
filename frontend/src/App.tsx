import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Callback = lazy(() => import("./pages/Callback"));

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/callback" element={<Callback />} />
      </Routes>
    </Suspense>
  );
}

function RouteFallback() {
  return (
    <div className="loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-stack">
        <div className="spinner" aria-hidden="true" />
        <p>Loading workspace...</p>
      </div>
    </div>
  );
}
