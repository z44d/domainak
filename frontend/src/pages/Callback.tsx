import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Callback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("session_token", token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/?error=no_token", { replace: true });
    }
  }, [navigate, searchParams]);

  return (
    <div className="loading-screen" aria-live="polite" aria-busy="true">
      <div className="loading-stack">
        <div className="spinner" aria-hidden="true" />
        <p>Signing you in...</p>
      </div>
    </div>
  );
}
