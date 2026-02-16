"use client";

import InputBox from "@/components/ui/InputBox";
import Link from "next/link";
import React, { useState } from "react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  return (
    <div className="lg:w-[70%] h-auto md:h-full mt-10 md:mt-0 flex flex-col justify-center">
      <h3 className="text-base font-semibold text-black">Welcome Back</h3>
      <p className="text-xs text-slate-700 mt-1.25 mb-6">
        Enter your information to proceed.
      </p>
      <form>
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
        {error && <p className="text-red-500 text-xs pb-2.5">{error}</p>}

        <button
          type="submit"
          className="w-full bg-green-700 py-3 text-white rounded cursor-pointer mt-3"
        >
          LOGIN
        </button>

        <div className="w-full flex gap-3 mt-5 flex-wrap">
          <Link
            href={"/auth/signup"}
            className="
      flex-1 min-w-[160px]
      group
      flex items-center justify-center gap-3
      px-4 py-3.5
      bg-white
      border border-gray-200
      rounded-lg
      shadow-sm
      hover:shadow-md hover:border-gray-300
      transition-all duration-200
      cursor-pointer
    "
          >
            <img
              src="/Google.png"
              alt="Google logo"
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
              Continue with Google
            </span>
          </Link>

          <Link
            href={"/auth/signup"}
            className="
      flex-1 min-w-[160px]
      group
      flex items-center justify-center gap-3
      px-4 py-3.5
      bg-white
      border border-gray-200
      rounded-lg
      shadow-sm
      hover:shadow-md hover:border-gray-300
      transition-all duration-200
      cursor-pointer
    "
          >
            <img
              src="/Line.png"
              alt="Line logo"
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
              Continue with Line
            </span>
          </Link>

          <Link
            href={"/auth/signup"}
            className="
      flex-1 min-w-[160px]
      group
      flex items-center justify-center gap-3
      px-4 py-3.5
      bg-white
      border border-gray-200
      rounded-lg
      shadow-sm
      hover:shadow-md hover:border-gray-300
      transition-all duration-200
      cursor-pointer
    "
          >
            <img
              src="/facebook.png"
              alt="Facebook logo"
              className="w-5 h-5 object-contain"
            />
            <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">
              Continue with Facebook
            </span>
          </Link>
        </div>

        <div className="flex justify-between  mt-5 ">
          <p className="text-[13px] text-slate-800">
            Forgot{" "}
            <Link
              href={"/auth/signup"}
              className="font-medium text-green-600 underline"
            >
              Password?
            </Link>
          </p>

          <p className="text-[13px] text-slate-800">
            Don't have an account?{" "}
            <Link
              href={"/signup"}
              className="font-medium text-green-600 underline"
            >
              SignUp
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginPage;
