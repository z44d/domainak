import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoadingScreen } from "../components/LoadingScreen";

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

  return <LoadingScreen label="Signing you in..." />;
}
