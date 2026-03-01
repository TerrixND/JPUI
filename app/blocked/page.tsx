"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  clearBlockedAccountSnapshot,
  readBlockedAccountSnapshot,
  type BlockedAccountSnapshot,
} from "@/lib/apiClient";

const formatRemainingTime = (remainingMs: number | null) => {
  if (remainingMs === null || remainingMs <= 0) {
    return "Until access is restored";
  }

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  }

  return `${seconds}s remaining`;
};

const getTitle = (snapshot: BlockedAccountSnapshot | null) => {
  switch (snapshot?.accountAccess?.code || snapshot?.code) {
    case "ACCOUNT_BANNED":
      return "Your account is banned.";
    case "ACCOUNT_SUSPENDED":
      return "Your account is suspended.";
    case "ACCOUNT_TERMINATED":
      return "Your account has been terminated.";
    case "CONTACT_BLOCKED":
      return "This contact is blocked.";
    default:
      return "Your account is currently restricted.";
  }
};

const getDescription = (snapshot: BlockedAccountSnapshot | null) => {
  if (snapshot?.message) {
    return snapshot.message;
  }

  switch (snapshot?.accountAccess?.code || snapshot?.code) {
    case "ACCOUNT_BANNED":
      return "A main admin has banned this account from continuing through normal sign-in flows.";
    case "ACCOUNT_SUSPENDED":
      return "This account is suspended and cannot continue until the suspension window ends or an admin restores access.";
    case "ACCOUNT_TERMINATED":
      return "This account has been permanently terminated and cannot continue into the app.";
    case "CONTACT_BLOCKED":
      return "This email or phone number is blocked from creating or using an account.";
    default:
      return "Contact a main admin for account recovery or wait until the restriction window ends.";
  }
};

export default function BlockedAccountPage() {
  const snapshot = useSyncExternalStore(
    () => () => undefined,
    () => readBlockedAccountSnapshot(),
    () => null,
  );
  const [elapsedMs, setElapsedMs] = useState(0);
  const remainingMs = snapshot?.accountAccess?.remainingMs ?? null;
  const displayedRemainingMs =
    remainingMs === null ? null : Math.max(0, remainingMs - elapsedMs);

  useEffect(() => {
    if (displayedRemainingMs === null || displayedRemainingMs <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setElapsedMs((current) => current + 1000);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [displayedRemainingMs]);

  const accessCode = useMemo(
    () => snapshot?.accountAccess?.code || snapshot?.code || "ACCOUNT_RESTRICTED",
    [snapshot],
  );
  const isBanState = accessCode === "ACCOUNT_BANNED";
  const isSuspendedState = accessCode === "ACCOUNT_SUSPENDED";
  const noticeToneClass = isBanState
    ? "border-red-200 bg-red-50 text-red-800"
    : isSuspendedState
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-blue-200 bg-blue-50 text-blue-800";
  const noticeTitle = isBanState
    ? "Ban Notice"
    : isSuspendedState
      ? "Suspension Notice"
      : "Access Notice";
  const noticeText = isBanState
    ? "New sign-in is disabled while this ban remains active. Existing sessions should also be revoked by backend policy."
    : isSuspendedState
      ? "This account cannot continue while the suspension is active. Access may resume automatically when the window ends."
      : "This account currently has a restricted access window. Some flows may still allow authentication, but protected areas remain blocked.";

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-rose-50/40 px-6 py-12 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-3xl border border-amber-200 bg-white/95 shadow-xl shadow-amber-100/60 backdrop-blur">
        <div className="border-b border-amber-100 px-8 py-7">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-700 font-semibold">
            Account Access Blocked
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">
            {getTitle(snapshot)}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-gray-600">
            {getDescription(snapshot)}
          </p>
        </div>

        <div className="grid gap-4 px-8 py-7 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Status Code
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {accessCode}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Block Scope
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {snapshot?.accountAccess?.blockedScope || "AUTHENTICATION"}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
              Access Window
            </p>
            <p className="mt-2 text-sm font-semibold text-gray-900">
              {formatRemainingTime(displayedRemainingMs)}
            </p>
          </div>
        </div>

        <div className="px-8 pb-2">
          <div className={`rounded-2xl border px-4 py-4 ${noticeToneClass}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">
              {noticeTitle}
            </p>
            <p className="mt-2 text-sm font-medium">
              {noticeText}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 px-8 py-6 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            onClick={() => clearBlockedAccountSnapshot()}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Back to Login
          </Link>
          <Link
            href="/"
            onClick={() => clearBlockedAccountSnapshot()}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
