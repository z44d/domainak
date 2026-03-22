"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function CallbackHandler() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("session_token", token);
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/?error=no_token";
    }
  }, [searchParams]);

  return (
    <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
  );
}

export default function Callback() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <Suspense
        fallback={
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
        }
      >
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
