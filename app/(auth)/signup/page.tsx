"use client";

import InputBox from "@/components/ui/InputBox";
import {
  clearPendingSetupPayload,
  setupUser,
  storePendingSetupPayload,
} from "@/lib/setupUser";
import supabase, { isSupabaseConfigured } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const languages = [
  {
    code: "en",
    label: "English",
  },
  {
    code: "ch",
    label: "China",
  },
  {
    code: "th",
    label: "Thailand",
  },
  {
    code: "mm",
    label: "Myanmar",
  },
];

const SignupPage = () => {
  const router = useRouter();

  const [fullName, setFullName] = useState<string>("");
  const [city, setCity] = useState<string>("");
  const [phNo, setPhNo] = useState<string>("");
  const [lineID, setLineID] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(languages[0]);

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_PROJECT_URL and NEXT_PUBLIC_SUPABASE_PUB_KEY.",
        );
      }

      const normalizedEmail = email.trim();

      if (!normalizedEmail || !password) {
        throw new Error("Email and password are required.");
      }

      const profilePayload = {
        displayName: fullName.trim() || undefined,
        phone: phNo.trim() || undefined,
        lineId: lineID.trim() || undefined,
        preferredLanguage: selected.code || undefined,
        city: city.trim() || undefined,
      };

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: profilePayload,
        },
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (data.session?.access_token) {
        await setupUser(data.session.access_token, profilePayload);
        clearPendingSetupPayload();
        router.replace("/");
        router.refresh();
        return;
      }

      storePendingSetupPayload(normalizedEmail, profilePayload);
      setMessage(
        "Sign up successful. Verify your email, then login to finish account setup.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lg:w-[100%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
      <div className="flex justify-between items-center flex-wrap mb-6 gap-4">
        <div className="">
          <h3 className="text-base font-semibold text-black">
            Create an account
          </h3>
          <p className="text-xs text-slate-700 mt-[5px]">
            Create your account and get started.
          </p>
        </div>
        <select
          value={selected.code}
          onChange={(e) =>
            setSelected(languages.find((l) => l.code === e.target.value)!)
          }
          className="
    w-22 h-10
    text-sm
    bg-white
    border border-gray-200
    shadow-sm
    text-center
    focus:outline-none
   
    
    cursor-pointer
    transition
  "
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <form onSubmit={handleSignUp}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InputBox
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            label="Full Name"
            placeholder="John Snow"
            type="text"
          />
          <InputBox
            value={city}
            onChange={(e) => setCity(e.target.value)}
            label="City"
            placeholder="Bangkok"
            type="text"
          />
          <InputBox
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            label="Email Address"
            placeholder="john@gmail.com"
            type="text"
          />
          <InputBox
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            label="Password"
            placeholder="Minimum 8 characters"
            type="password"
          />
          <InputBox
            value={phNo}
            onChange={(e) => setPhNo(e.target.value)}
            label="Phone Number"
            placeholder="+95 #### ####"
            type="text"
          />
          <InputBox
            value={lineID}
            onChange={(e) => setLineID(e.target.value)}
            label="Line ID"
            placeholder="#### ####"
            type="text"
          />
          {/* <div className="col-span-2">
            <InputBox
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              label="Password"
              placeholder="Minimum 8 characters"
              type="password"
            />
          </div> */}
        </div>

        {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}
        {message && <p className="text-emerald-700 text-xs pb-2.5">{message}</p>}
        <button
          type="submit"
          disabled={loading}
          className={`cursor-pointer mt-3 w-full py-3 text-white rounded ${
            loading ? "bg-emerald-500" : "bg-emerald-700"
          }`}
        >
          {loading ? "Signing Up..." : "SIGN UP"}
        </button>
        <p className="text-[13px] text-slate-800 mt-3">
          Already have an account?{" "}
          <Link
            href={"/login"}
            className="font-medium text-emerald-600 underline"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SignupPage;
