"use client";

import AboutProduct from "@/components/ui/AboutProduct";
import Footer from "@/components/ui/Footer";
import ScrollHero from "@/components/ui/ScrollHero";
import NewArrivals from "@/components/ui/NewArrivals";
import OurProcess from "@/components/ui/OurProcess";
import LatestInfo from "@/components/ui/LatestInfo";

import {
  completePendingSetupForSession,
  isAuthBlockedError,
} from "@/lib/setupUser";

import {
  forceLogoutToBlockedPage,
  getUserMe,
  isAccountAccessDeniedError,
  redirectToBlockedPage,
} from "@/lib/apiClient";

import supabase, { isSupabaseConfigured } from "@/lib/supabase";

import React, { useEffect, useRef, useState } from "react";

const HomePage = () => {
  const [setupError, setSetupError] = useState("");
  const hasSyncedSetupRef = useRef(false);

  useEffect(() => {
    if (hasSyncedSetupRef.current) return;
    hasSyncedSetupRef.current = true;

    const syncSetupUserAfterCallback = async () => {
      if (!isSupabaseConfigured) return;

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          if (
            sessionError.message
              .toLowerCase()
              .includes("invalid refresh token")
          ) {
            return;
          }

          throw new Error(sessionError.message);
        }

        if (!session?.access_token) return;

        const didCompletePendingSetup =
          await completePendingSetupForSession({
            accessToken: session.access_token,
            email: session.user?.email,
          });

        if (!didCompletePendingSetup) return;

        try {
          await getUserMe({
            accessToken: session.access_token,
          });
        } catch (accountError) {
          if (isAccountAccessDeniedError(accountError)) {
            await forceLogoutToBlockedPage(
              accountError.payload ?? {
                message: accountError.message,
                code: accountError.code,
              },
            );
            return;
          }

          throw accountError;
        }
      } catch (error) {
        if (isAuthBlockedError(error)) {
          await supabase.auth.signOut().catch(() => undefined);

          redirectToBlockedPage({
            message: error.message,
            code: error.code,
            details: error.details,
          });

          return;
        }

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
    <div className="bg-black">
      <main className="scroll-smooth">
        <ScrollHero />

        <AboutProduct />
        <NewArrivals />
        <OurProcess />
        <LatestInfo />
        <Footer />

        {setupError && (
          <p className="mt-3 text-sm text-red-600 text-center">
            Account setup sync failed: {setupError}
          </p>
        )}
      </main>
    </div>
  );
};

export default HomePage;
