"use client";

import { useEffect, useState } from "react";
import {
  getAdminCustomers,
  type AdminCustomerListItem,
} from "@/lib/apiClient";

type AdminCustomerPickerProps = {
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  getAccessToken: () => Promise<string>;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  emptyStateLabel?: string;
};

const DEFAULT_HELPER =
  "Search customers by name, email, or phone, then add them to the targeted visibility list.";

const getCustomerLabel = (customer: AdminCustomerListItem) =>
  customer.displayName || customer.email || customer.phone || customer.id;

export default function AdminCustomerPicker({
  selectedIds,
  onChange,
  getAccessToken,
  disabled = false,
  label = "Target Customers",
  helperText = DEFAULT_HELPER,
  emptyStateLabel = "No matching customers found.",
}: AdminCustomerPickerProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AdminCustomerListItem[]>([]);
  const [knownCustomers, setKnownCustomers] = useState<Record<string, AdminCustomerListItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (disabled) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      const loadCustomers = async () => {
        setLoading(true);
        setError("");

        try {
          const accessToken = await getAccessToken();
          const response = await getAdminCustomers({
            accessToken,
            search: search.trim() || undefined,
            limit: 8,
          });

          if (!active) {
            return;
          }

          setResults(response.items);
          setKnownCustomers((current) => {
            const next = { ...current };
            for (const customer of response.items) {
              next[customer.id] = customer;
            }
            return next;
          });
        } catch (caughtError) {
          if (!active) {
            return;
          }

          setResults([]);
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Failed to load customers.",
          );
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

      void loadCustomers();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [disabled, getAccessToken, search]);

  const toggleCustomer = (customerId: string) => {
    if (selectedIds.includes(customerId)) {
      onChange(selectedIds.filter((id) => id !== customerId));
      return;
    }

    onChange([...selectedIds, customerId]);
  };

  const removeCustomer = (customerId: string) => {
    onChange(selectedIds.filter((id) => id !== customerId));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[13px] text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by customer name, email, or phone"
          disabled={disabled}
          className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/60 rounded-lg outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helperText}</p>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((customerId) => {
            const customer = knownCustomers[customerId];

            return (
              <span
                key={customerId}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 text-xs text-emerald-700 dark:text-emerald-300"
              >
                <span className="font-medium">
                  {customer ? getCustomerLabel(customer) : customerId}
                </span>
                <button
                  type="button"
                  onClick={() => removeCustomer(customerId)}
                  disabled={disabled}
                  className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
            Loading customers...
          </div>
        ) : error ? (
          <div className="px-4 py-4 text-sm text-red-600 dark:text-red-300">{error}</div>
        ) : results.length === 0 ? (
          <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
            {emptyStateLabel}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {results.map((customer) => {
              const selected = selectedIds.includes(customer.id);

              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => toggleCustomer(customer.id)}
                  disabled={disabled}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    selected
                      ? "bg-emerald-50 dark:bg-emerald-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {getCustomerLabel(customer)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {[customer.email, customer.phone, customer.customerTier]
                          .filter(Boolean)
                          .join(" • ") || customer.id}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        selected
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {selected ? "Selected" : "Add"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
