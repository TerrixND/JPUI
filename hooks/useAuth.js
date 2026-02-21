"use client";

import { useEffect, useState } from "react";
import { supabaseBrowserClient } from "../lib/supabaseClient";

export default function useAuth() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        supabaseBrowserClient.auth.getSession().then(({ data }) => {
            setUser(data.session?.user ?? null);
        });

        const { data: listener } = supabaseBrowserClient.auth.onAuthStateChange(
            (_, session) => {
                setUser(session?.user ?? null);
            }
        );
        return () => listener.subscription.unsubscribe();
    }, []);
    return user;
}

