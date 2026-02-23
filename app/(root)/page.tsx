"use client";

import AboutProduct from "@/components/ui/AboutProduct";
import Footer from "@/components/ui/Footer";
import ScrollHero from "@/components/ui/ScrollHero";
import NewArrivals from "@/components/ui/NewArrivals";
import OurProcess from "@/components/ui/OurProcess";

import {
  bootstrapAdmin,
  clearPendingSetupPayload,
  getPendingSetupProfileForEmail,
  setupUser,
} from "@/lib/setupUser";

import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import React, { useEffect, useRef, useState } from "react";
import LatestInfo from "@/components/ui/LatestInfo";

const HomePage = () => {
  const [setupError, setSetupError] = useState("");
  const hasSyncedSetupRef = useRef(false);
  const nextSectionRef = useRef<HTMLDivElement>(null);

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
          if (sessionError.message.toLowerCase().includes("invalid refresh token")) {
            return;
          }

          throw new Error(sessionError.message);
        }

        if (!session?.access_token) return;

        const email = session.user?.email || "";
        const pendingSetupProfile = email
          ? getPendingSetupProfileForEmail(email)
          : null;

        if (!pendingSetupProfile) return;

        if (pendingSetupProfile.onboardingMode === "bootstrap-admin") {
          await bootstrapAdmin(session.access_token, pendingSetupProfile.payload);
        } else {
          await setupUser(session.access_token, pendingSetupProfile.payload);
        }

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
    <div className="bg-black">
      
      <main className="scroll-smooth">
        <ScrollHero hideAtRef={nextSectionRef} />

        {/* This section will hide nav dots when visible */}
        <div
          ref={nextSectionRef}
          className="scroll-mt-14"
          style={{ scrollSnapAlign: "start" }}
        >
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
        </div>
      </main>
    </div>
  );
};

export default HomePage;
