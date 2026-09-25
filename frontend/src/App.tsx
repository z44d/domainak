import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { LoadingScreen } from "./components/LoadingScreen";
import Landing from "./pages/Landing";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Admin = lazy(() => import("./pages/Admin"));
const Callback = lazy(() => import("./pages/Callback"));

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen label="Loading workspace..." />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/callback" element={<Callback />} />
      </Routes>
    </Suspense>
  );
}
