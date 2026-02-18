"use client";

import AboutProduct from "@/components/ui/AboutProduct";
import Footer from "@/components/ui/Footer";
import Hero from "@/components/ui/Hero";
import Navbar from "@/components/ui/Navbar";
import OurCollection from "@/components/ui/OurCollection";
import {
  clearPendingSetupPayload,
  getPendingSetupPayloadForEmail,
  setupUser,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import React, { useEffect, useRef, useState } from "react";

const HomePage = () => {
  const [setupError, setSetupError] = useState("");
  const hasSyncedSetupRef = useRef(false);

  useEffect(() => {
    if (hasSyncedSetupRef.current) {
      return;
    }
    hasSyncedSetupRef.current = true;

    const syncSetupUserAfterCallback = async () => {
      if (!isSupabaseConfigured) {
        return;
      }

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
            await supabase.auth.signOut();
            return;
          }

          throw new Error(sessionError.message);
        }

        if (!session?.access_token) {
          return;
        }

        const email = session.user?.email || "";
        const pendingPayload = email
          ? getPendingSetupPayloadForEmail(email)
          : null;

        if (!pendingPayload) {
          return;
        }

        await setupUser(session.access_token, pendingPayload);
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
      <Navbar />
      <Hero />
      <AboutProduct />
      <OurCollection/>
      <Footer/>
      {setupError && (
        <p className="mt-3 text-sm text-red-600">
          Account setup sync failed: {setupError}
        </p>
      )}
    </div>
  );
};

export default HomePage;
