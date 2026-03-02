"use client";

import { useEffect, useState } from "react";
import { type CustomerTier } from "@/lib/apiClient";
import {
  getManagerCustomers,
  type ManagerCustomerListItem,
} from "@/lib/managerApi";

type ManagerCustomerPickerProps = {
  branchId: string;
  productId: string;
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
  getAccessToken: () => Promise<string>;
  disabled?: boolean;
  label?: string;
  helperText?: string;
  emptyStateLabel?: string;
  annotateProductTargeting?: boolean;
};

const getCustomerLabel = (customer: ManagerCustomerListItem) =>
  customer.displayName || customer.email || customer.userId;

export default function ManagerCustomerPicker({
  branchId,
  productId,
  selectedIds,
  onChange,
  getAccessToken,
  disabled = false,
  label = "Target Customers",
  helperText = "Search customers in manager branch scope, then add them to this access list.",
  emptyStateLabel = "No matching customers found for this branch scope.",
  annotateProductTargeting = true,
}: ManagerCustomerPickerProps) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"" | CustomerTier>("");
  const [results, setResults] = useState<ManagerCustomerListItem[]>([]);
  const [knownCustomers, setKnownCustomers] = useState<Record<string, ManagerCustomerListItem>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (disabled || !branchId || !productId) {
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
          const response = await getManagerCustomers({
            accessToken,
            branchId,
            productId,
            search: search.trim() || undefined,
            tier: tierFilter || undefined,
            limit: 12,
          });

          if (!active) {
            return;
          }

          setResults(response.records);
          setKnownCustomers((current) => {
            const next = { ...current };
            for (const customer of response.records) {
              next[customer.userId] = customer;
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
  }, [branchId, disabled, getAccessToken, productId, search, tierFilter]);

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div>
          <label className="mb-1.5 block text-[13px] text-gray-700 dark:text-gray-300">
            {label}
          </label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by customer name, email, phone, city, or user ID"
            disabled={disabled}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700/60 dark:bg-gray-800/50"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] text-gray-700 dark:text-gray-300">
            Tier Filter
          </label>
          <select
            value={tierFilter}
            onChange={(event) => setTierFilter(event.target.value as "" | CustomerTier)}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700/60 dark:bg-gray-800/50"
          >
            <option value="">All tiers</option>
            <option value="REGULAR">REGULAR</option>
            <option value="VIP">VIP</option>
            <option value="ULTRA_VIP">ULTRA_VIP</option>
          </select>
        </div>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((customerId) => {
            const customer = knownCustomers[customerId];

            return (
              <span
                key={customerId}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <span className="font-medium">
                  {customer ? getCustomerLabel(customer) : customerId}
                </span>
                <button
                  type="button"
                  onClick={() => removeCustomer(customerId)}
                  disabled={disabled}
                  className="hover:text-emerald-900 disabled:cursor-not-allowed dark:hover:text-emerald-100"
                >
                  Remove
                </button>
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700/60 dark:bg-gray-900">
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
              const selected = selectedIds.includes(customer.userId);

              return (
                <button
                  key={customer.userId}
                  type="button"
                  onClick={() => toggleCustomer(customer.userId)}
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
                        {[customer.email, customer.tier, customer.status]
                          .filter(Boolean)
                          .join(" • ") || customer.userId}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        selected
                          ? "bg-emerald-600 text-white"
                          : annotateProductTargeting && customer.isTargetedForProduct
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {selected
                        ? "Selected"
                        : annotateProductTargeting && customer.isTargetedForProduct
                          ? "Currently targeted"
                          : "Add"}
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
