"use client";

import { useEffect, useState } from "react";
import supabase from "../lib/supabase";

export default function useAuth() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setUser(data.session?.user ?? null);
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_, session) => {
                setUser(session?.user ?? null);
            }
        );
        return () => listener.subscription.unsubscribe();
    }, []);
    return user;
}

