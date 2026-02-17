"use client";

import {
  clearPendingSetupPayload,
  getPendingSetupPayloadForEmail,
  setupUser,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import React, { useEffect, useState } from "react";

const consumeHashSession = async () => {
  if (typeof window === "undefined") {
    return null;
  }

  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : "";

  if (!hash) {
    return null;
  }

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return null;
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error || !data.session) {
    throw new Error(error?.message || "Unable to restore auth session.");
  }

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, document.title, cleanUrl);

  return data.session;
};

const HomePage = () => {
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    const syncSetupUserAfterCallback = async () => {
      if (!isSupabaseConfigured) {
        return;
      }

      try {
        const callbackSession = await consumeHashSession();
        const session =
          callbackSession || (await supabase.auth.getSession()).data.session;

        if (!session?.access_token) {
          return;
        }

        const email = session.user?.email || "";
        const pendingPayload = email
          ? getPendingSetupPayloadForEmail(email)
          : null;

        if (!callbackSession && !pendingPayload) {
          return;
        }

        await setupUser(session.access_token, pendingPayload || {});
        clearPendingSetupPayload();
      } catch (error) {
        setSetupError(
          error instanceof Error
            ? error.message
            : "Unable to complete account setup.",
        );
      }
    };

    syncSetupUserAfterCallback();
  }, []);

  return (
    <div>
      HomePage
      {setupError && (
        <p className="mt-3 text-sm text-red-600">
          Account setup sync failed: {setupError}
        </p>
      )}
    </div>
  );
};

export default HomePage;
