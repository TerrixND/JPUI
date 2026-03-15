"use client";

import {
  buildPhoneNumberValue,
  getPhoneCountryOptionByCountryName,
  getPhoneCountryOptionByIsoCode,
  guessPhoneCountryOptionFromEnvironment,
  PHONE_COUNTRY_OPTIONS,
  sanitizePhoneLocalNumber,
  splitPhoneNumberValue,
} from "@/lib/phoneCountryCodes";
import { Info } from "lucide-react";
import { useState } from "react";

type PhoneNumberFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  countryHint?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  helperText?: string;
  placeholder?: string;
  variant?: "filled" | "outline" | "underline";
  wrapperClassName?: string;
  labelClassName?: string;
  helperClassName?: string;
  selectAriaLabel?: string;
};

const getVariantStyles = (variant: PhoneNumberFieldProps["variant"]) => {
  switch (variant) {
    case "underline":
      return {
        label:
          "mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-400",
        wrapper:
          "mt-2 flex items-center gap-3 border-b border-neutral-200 pb-3",
        select:
          "min-w-[8.5rem] bg-transparent text-[15px] text-neutral-800 outline-none disabled:cursor-not-allowed disabled:text-neutral-400",
        input:
          "w-full bg-transparent text-[15px] text-neutral-800 outline-none placeholder:text-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-400",
      };

    case "outline":
      return {
        label:
          "text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500",
        wrapper:
          "mt-2 flex items-center gap-3 rounded-2xl border border-stone-200 px-4 py-3",
        select:
          "min-w-[8.5rem] bg-transparent text-sm text-stone-700 outline-none disabled:cursor-not-allowed disabled:text-stone-400",
        input:
          "w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400 disabled:cursor-not-allowed disabled:text-stone-400",
      };

    default:
      return {
        label: "text-[13px] text-slate-800",
        wrapper:
          "mb-4 mt-3 flex items-center gap-3 rounded border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-black",
        select:
          "min-w-[8.5rem] bg-transparent text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400",
        input:
          "w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400",
      };
  }
};

export default function PhoneNumberField({
  label,
  value,
  onChange,
  countryHint = null,
  disabled = false,
  readOnly = false,
  placeholder = "Local phone number",
  variant = "filled",
  wrapperClassName = "",
  labelClassName = "",
  selectAriaLabel = "Country code",
}: PhoneNumberFieldProps) {
  const styles = getVariantStyles(variant);

  const [showInfo, setShowInfo] = useState(false);

  const [manualCountryIsoCode, setManualCountryIsoCode] = useState(
    () =>
      guessPhoneCountryOptionFromEnvironment({ countryName: countryHint })
        .isoCode,
  );

  const parsedValue = splitPhoneNumberValue(value);

  const hintedCountry =
    getPhoneCountryOptionByCountryName(countryHint) ||
    guessPhoneCountryOptionFromEnvironment({ countryName: countryHint });

  const manuallySelectedCountry =
    getPhoneCountryOptionByIsoCode(manualCountryIsoCode) || hintedCountry;

  const selectedCountry =
    parsedValue.option ||
    manuallySelectedCountry ||
    guessPhoneCountryOptionFromEnvironment({ countryName: countryHint });

  const localNumber = parsedValue.localNumber;

  const emitPhoneValue = ({
    nextDialCode,
    nextLocalNumber,
  }: {
    nextDialCode?: string;
    nextLocalNumber?: string;
  }) => {
    onChange(
      buildPhoneNumberValue({
        dialCode: nextDialCode ?? selectedCountry.dialCode,
        localNumber: nextLocalNumber ?? localNumber,
      }),
    );
  };

  return (
    <div className={wrapperClassName}>
      {/* Label + Info */}
      <div className="flex items-center gap-2 relative">
        <label className={labelClassName || styles.label}>{label}</label>

        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          className="text-slate-400 hover:text-slate-600 transition"
        >
          <Info className="h-3.5 w-3.5" />
        </button>

        {showInfo && (
          <div className="absolute top-6 left-0 z-10 w-65 text-xs text-slate-600 bg-white border border-slate-200 rounded shadow-md p-3">
            We will suggest the country code from your selected city, and you
            can change it if needed.
          </div>
        )}
      </div>

      {/* Input */}
      <div className={styles.wrapper}>
        <select
          value={selectedCountry.isoCode}
          onChange={(event) => {
            const nextCountryIsoCode = event.target.value;

            const nextCountry =
              PHONE_COUNTRY_OPTIONS.find(
                (option) => option.isoCode === nextCountryIsoCode,
              ) || selectedCountry;

            setManualCountryIsoCode(nextCountry.isoCode);

            emitPhoneValue({ nextDialCode: nextCountry.dialCode });
          }}
          disabled={disabled || readOnly}
          aria-label={selectAriaLabel}
          className={styles.select}
        >
          {PHONE_COUNTRY_OPTIONS.map((option) => (
            <option
              key={`${option.isoCode}-${option.dialCode}`}
              value={option.isoCode}
            >
              {option.country} ({option.dialCode})
            </option>
          ))}
        </select>

        <input
          type="tel"
          value={localNumber}
          onChange={(event) => {
            const nextLocalNumber = sanitizePhoneLocalNumber(
              event.target.value,
            );
            emitPhoneValue({ nextLocalNumber });
          }}
          placeholder={placeholder}
          disabled={disabled}
          readOnly={readOnly}
          className={styles.input}
        />
      </div>
    </div>
  );
}
