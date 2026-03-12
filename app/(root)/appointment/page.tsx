"use client";

import useAuth from "@/hooks/useAuth";
import {
  ApiClientError,
  getCustomerAppointments,
  getPublicAppointmentAutofill,
  type CustomerAppointmentRecord,
} from "@/lib/apiClient";
import supabase from "@/lib/supabase";
import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "Pending";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const appointmentTone = (status: string | null | undefined) => {
  switch (String(status || "").toUpperCase()) {
    case "CONFIRMED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "COMPLETED":
      return "border-stone-200 bg-stone-100 text-stone-700";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
};

const fulfillmentTone = (status: string | null | undefined) => {
  switch (String(status || "").toUpperCase()) {
    case "FULFILLED":
    case "READY":
    case "RESERVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CANCELLED":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-stone-200 bg-white text-stone-600";
  }
};

const branchLabel = (
  branch:
    | {
        name?: string | null;
        code?: string | null;
        city?: string | null;
        address?: string | null;
      }
    | null
    | undefined,
) => {
  if (!branch) return "Private showroom";
  return [branch.name || branch.code || "Private showroom", branch.city, branch.address]
    .filter(Boolean)
    .join(" / ");
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

export default function AppointmentPage() {
  const authUser = useAuth() as { id?: string | null } | null;
  const [appointments, setAppointments] = useState<CustomerAppointmentRecord[]>([]);
  const [isCustomerSession, setIsCustomerSession] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async () => {
      setLoading(true);
      setErrorMessage("");

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        const token = session?.access_token ?? null;
        if (!token) {
          if (!cancelled) {
            setAppointments([]);
            setIsCustomerSession(false);
          }
          return;
        }

        const autofill = await getPublicAppointmentAutofill({
          accessToken: token,
        });
        if (!autofill.canAutofill) {
          if (!cancelled) {
            setAppointments([]);
            setIsCustomerSession(false);
          }
          return;
        }

        const rows = await getCustomerAppointments({ accessToken: token });
        if (cancelled) {
          return;
        }

        setAppointments(rows);
        setIsCustomerSession(true);
      } catch (error) {
        if (!cancelled) {
          setAppointments([]);
          setIsCustomerSession(false);
          setErrorMessage(getErrorMessage(error, "Failed to load appointment history."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadAppointments();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f5f5f4_0%,#ffffff_52%,#ecfdf5_100%)] text-stone-900">
      <section className="px-6 pb-8 pt-24 sm:px-12 lg:px-20">
        <div className="rounded-[2rem] border border-stone-200 bg-white/90 p-8 shadow-[0_24px_80px_-48px_rgba(28,25,23,0.48)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-700">
                Appointment
              </span>
              <h1 className="mt-5 max-w-3xl text-4xl font-light leading-tight sm:text-5xl">
                Review every request in one dedicated history page.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">
                Track confirmations, requested pieces, preferred contact methods, and branch
                updates without mixing history into the cart.
              </p>
            </div>
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 rounded-full border border-stone-900 px-5 py-2.5 text-sm font-medium text-stone-900 transition-colors hover:bg-stone-900 hover:text-white"
            >
              New Appointment Request
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {errorMessage ? (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
        </div>
      </section>

      <section className="px-6 pb-24 sm:px-12 lg:px-20">
        <div className="rounded-[1.75rem] border border-stone-200 bg-white p-6 shadow-[0_24px_80px_-56px_rgba(28,25,23,0.55)] sm:p-8">
          <div className="flex flex-col gap-3 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                Request History
              </p>
              <h2 className="mt-2 text-2xl font-light">Track your request status</h2>
            </div>
            {loading ? (
              <p className="inline-flex items-center gap-2 text-sm text-stone-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Loading appointments...
              </p>
            ) : isCustomerSession ? (
              <p className="text-sm text-stone-500">
                Showing {appointments.length} appointment{appointments.length === 1 ? "" : "s"}
              </p>
            ) : (
              <p className="text-sm text-stone-500">
                Login with a customer account to unlock appointment history.
              </p>
            )}
          </div>

          {!loading && !isCustomerSession ? (
            <div className="mt-6 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-6 text-sm leading-7 text-stone-600">
              <p>
                Appointment history is tied to customer accounts so branch responses and requested
                items stay attached to the right profile.
              </p>
              {!authUser ? (
                <Link
                  href="/login?returnTo=/appointment"
                  className="mt-4 inline-flex items-center gap-2 font-medium text-emerald-800 hover:text-emerald-900"
                >
                  Login to Continue
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}

          {!loading && isCustomerSession && appointments.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 px-5 py-10 text-center">
              <p className="text-lg font-light text-stone-900">No appointment requests yet</p>
              <p className="mt-2 text-sm leading-7 text-stone-600">
                Once you submit your first request, confirmation status and requested pieces will
                appear here.
              </p>
            </div>
          ) : null}

          {!loading && isCustomerSession && appointments.length > 0 ? (
            <div className="mt-6 space-y-5">
              {appointments.map((appointment) => (
                <article
                  key={appointment.id}
                  className="rounded-[1.5rem] border border-stone-200 bg-white p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${appointmentTone(appointment.status)}`}
                        >
                          {appointment.status || "REQUESTED"}
                        </span>
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-stone-600">
                          {appointment.branch?.name || "Private showroom"}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-light">
                        {formatDateTime(appointment.appointmentDate)}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-stone-600">
                        {branchLabel(appointment.branch)}
                      </p>
                    </div>

                    <div className="text-sm text-stone-500">
                      <p>Requested {formatDate(appointment.createdAt)}</p>
                      {appointment.preferredContact ? (
                        <p className="mt-1">Preferred contact: {appointment.preferredContact}</p>
                      ) : null}
                      {appointment.userEnteredCity ? (
                        <p className="mt-1">City: {appointment.userEnteredCity}</p>
                      ) : null}
                    </div>
                  </div>

                  {appointment.items.length > 0 ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {appointment.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[1.25rem] border border-stone-200 bg-stone-50 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-stone-900">
                                {item.product?.name || item.productId || "Requested piece"}
                              </p>
                              {item.product?.sku ? (
                                <p className="mt-1 text-xs uppercase tracking-[0.22em] text-stone-500">
                                  {item.product.sku}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em] ${fulfillmentTone(item.fulfillmentStatus)}`}
                            >
                              {item.fulfillmentStatus || "REQUESTED"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {appointment.notes ? (
                    <div className="mt-4 rounded-[1.25rem] border border-stone-200 bg-white px-4 py-4 text-sm leading-7 text-stone-600">
                      {appointment.notes}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
