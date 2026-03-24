import { Route, Routes } from "react-router-dom";
import Admin from "./pages/Admin";
import Callback from "./pages/Callback";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/callback" element={<Callback />} />
    </Routes>
  );
}
