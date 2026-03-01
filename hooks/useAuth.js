"use client";

import { useEffect, useState } from "react";
import supabase from "../lib/supabase";

export default function useAuth() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const applyUser = (nextUser) => {
            setUser((currentUser) => {
                const currentId = currentUser?.id ?? null;
                const nextId = nextUser?.id ?? null;
                return currentId === nextId ? currentUser : nextUser;
            });
        };

        supabase.auth.getSession().then(({ data }) => {
            applyUser(data.session?.user ?? null);
        });

        const { data: listener } = supabase.auth.onAuthStateChange(
            (_, session) => {
                applyUser(session?.user ?? null);
            }
        );
        return () => listener.subscription.unsubscribe();
    }, []);
    return user;
}

