import { LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { User } from "../lib/types";
import { getErrorMessage } from "../lib/utils";

export function Navbar({ user }: { user: User | null }) {
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLogoutError("");
    setIsLoggingOut(true);

    try {
      await api.post("/auth/logout");
    } catch (error: unknown) {
      setLogoutError(
        getErrorMessage(
          error,
          "We could not reach the server, but you can still leave this session.",
        ),
      );
    } finally {
      localStorage.removeItem("session_token");
      navigate("/");
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-nav__inner">
        <Link to="/dashboard" className="brand-link">
          <span className="brand-link__mark">Domainak</span>
          <span className="brand-link__meta">routing control</span>
        </Link>

        {user && (
          <div className="nav-actions">
            {user.isAdmin && (
              <Link to="/admin" className="button button-ghost">
                <Settings className="w-4 h-4" /> Admin
              </Link>
            )}

            <div className="nav-user">
              <div className="user-pill">
                <img
                  src={`https://avatars.githubusercontent.com/u/${user.githubId}?v=4`}
                  alt={user.name}
                  className="avatar"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <span className="user-pill__text">
                  <span
                    className="user-pill__label text-truncate"
                    dir="auto"
                    title={user.name}
                  >
                    {user.name}
                  </span>
                  <span
                    className="user-pill__meta text-truncate"
                    dir="auto"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                </span>
              </div>
              <button
                onClick={handleLogout}
                type="button"
                className="button button-ghost"
                aria-label="Log out"
                disabled={isLoggingOut}
              >
                <LogOut className="w-4 h-4" />
                {isLoggingOut ? "Leaving..." : "Log out"}
              </button>
            </div>
          </div>
        )}
      </div>
      {logoutError ? (
        <div className="site-nav__inner site-nav__feedback">
          <div
            className="status-banner status-banner--danger"
            role="alert"
          >
            <span>{logoutError}</span>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
