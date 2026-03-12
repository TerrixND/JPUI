export type PhoneCountryOption = {
  isoCode: string;
  country: string;
  dialCode: string;
  aliases?: string[];
};

export const PHONE_COUNTRY_OPTIONS: PhoneCountryOption[] = [
  { isoCode: "TH", country: "Thailand", dialCode: "+66", aliases: ["TH"] },
  { isoCode: "MM", country: "Myanmar", dialCode: "+95", aliases: ["Burma", "MM"] },
  { isoCode: "CN", country: "China", dialCode: "+86", aliases: ["PRC", "CN"] },
  { isoCode: "HK", country: "Hong Kong", dialCode: "+852", aliases: ["HK"] },
  { isoCode: "TW", country: "Taiwan", dialCode: "+886", aliases: ["TW"] },
  { isoCode: "SG", country: "Singapore", dialCode: "+65", aliases: ["SG"] },
  { isoCode: "MY", country: "Malaysia", dialCode: "+60", aliases: ["MY"] },
  { isoCode: "VN", country: "Vietnam", dialCode: "+84", aliases: ["Viet Nam", "VN"] },
  { isoCode: "KH", country: "Cambodia", dialCode: "+855", aliases: ["KH"] },
  { isoCode: "LA", country: "Laos", dialCode: "+856", aliases: ["Lao PDR", "LA"] },
  { isoCode: "IN", country: "India", dialCode: "+91", aliases: ["IN"] },
  { isoCode: "JP", country: "Japan", dialCode: "+81", aliases: ["JP"] },
  { isoCode: "KR", country: "South Korea", dialCode: "+82", aliases: ["Korea", "Republic of Korea", "KR"] },
  { isoCode: "US", country: "United States", dialCode: "+1", aliases: ["USA", "US", "United States of America"] },
  { isoCode: "CA", country: "Canada", dialCode: "+1", aliases: ["CA"] },
  { isoCode: "GB", country: "United Kingdom", dialCode: "+44", aliases: ["UK", "Great Britain", "England", "GB"] },
  { isoCode: "AU", country: "Australia", dialCode: "+61", aliases: ["AU"] },
  { isoCode: "AE", country: "United Arab Emirates", dialCode: "+971", aliases: ["UAE", "AE"] },
];

const DEFAULT_PHONE_COUNTRY_ISO = "TH";

const TIMEZONE_TO_REGION: Record<string, string> = {
  "Asia/Bangkok": "TH",
  "Asia/Yangon": "MM",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Taipei": "TW",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Phnom_Penh": "KH",
  "Asia/Vientiane": "LA",
  "Asia/Kolkata": "IN",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Los_Angeles": "US",
  "America/Toronto": "CA",
  "Europe/London": "GB",
  "Australia/Sydney": "AU",
  "Asia/Dubai": "AE",
};

const normalizeToken = (value: string | null | undefined) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[().,]/g, "")
    .replace(/\s+/g, " ");

const findPhoneCountryOption = (
  predicate: (option: PhoneCountryOption) => boolean,
) => PHONE_COUNTRY_OPTIONS.find(predicate) || null;

export const getDefaultPhoneCountryOption = () =>
  findPhoneCountryOption((option) => option.isoCode === DEFAULT_PHONE_COUNTRY_ISO) ||
  PHONE_COUNTRY_OPTIONS[0];

export const getPhoneCountryOptionByIsoCode = (value: string | null | undefined) => {
  const token = normalizeToken(value);
  if (!token) {
    return null;
  }

  return findPhoneCountryOption((option) => normalizeToken(option.isoCode) === token);
};

export const getPhoneCountryOptionByCountryName = (value: string | null | undefined) => {
  const token = normalizeToken(value);
  if (!token) {
    return null;
  }

  return (
    findPhoneCountryOption(
      (option) =>
        normalizeToken(option.country) === token ||
        (option.aliases || []).some((alias) => normalizeToken(alias) === token),
    ) ||
    null
  );
};

export const getPhoneCountryOptionByDialCode = (value: string | null | undefined) => {
  const token = String(value || "").trim();
  if (!token) {
    return null;
  }

  return (
    [...PHONE_COUNTRY_OPTIONS]
      .sort((first, second) => second.dialCode.length - first.dialCode.length)
      .find((option) => token === option.dialCode || token.startsWith(option.dialCode)) || null
  );
};

export const guessPhoneCountryOption = ({
  countryName,
  locale,
  timezone,
}: {
  countryName?: string | null;
  locale?: string | null;
  timezone?: string | null;
} = {}) => {
  const byCountryName = getPhoneCountryOptionByCountryName(countryName);
  if (byCountryName) {
    return byCountryName;
  }

  const normalizedLocale = String(locale || "").trim();
  if (normalizedLocale) {
    const localeParts = normalizedLocale.split(/[-_]/);
    const regionCode = localeParts[localeParts.length - 1];
    const byLocale = getPhoneCountryOptionByIsoCode(regionCode);
    if (byLocale) {
      return byLocale;
    }
  }

  const byTimezone = getPhoneCountryOptionByIsoCode(
    TIMEZONE_TO_REGION[String(timezone || "").trim()] || "",
  );
  if (byTimezone) {
    return byTimezone;
  }

  return getDefaultPhoneCountryOption();
};

export const guessPhoneCountryOptionFromEnvironment = ({
  countryName,
  timezone,
}: {
  countryName?: string | null;
  timezone?: string | null;
} = {}) => {
  if (typeof window === "undefined") {
    return guessPhoneCountryOption({ countryName, timezone });
  }

  const browserLocale =
    window.navigator.languages?.find((value) => String(value || "").trim()) ||
    window.navigator.language ||
    null;

  const browserTimezone =
    timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    null;

  return guessPhoneCountryOption({
    countryName,
    locale: browserLocale,
    timezone: browserTimezone,
  });
};

export const sanitizePhoneLocalNumber = (value: string | null | undefined) =>
  String(value || "").replace(/\D/g, "");

export const buildPhoneNumberValue = ({
  dialCode,
  localNumber,
}: {
  dialCode?: string | null;
  localNumber?: string | null;
}) => {
  const normalizedLocalNumber = sanitizePhoneLocalNumber(localNumber);
  if (!normalizedLocalNumber) {
    return "";
  }

  const normalizedDialCode = String(dialCode || "").trim();
  if (!normalizedDialCode) {
    return normalizedLocalNumber;
  }

  return `${normalizedDialCode}${normalizedLocalNumber}`;
};

export const splitPhoneNumberValue = (value: string | null | undefined) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return {
      option: null,
      dialCode: "",
      localNumber: "",
    };
  }

  const compact = raw.replace(/[\s\-().]/g, "");
  const option = getPhoneCountryOptionByDialCode(compact);
  if (!option) {
    return {
      option: null,
      dialCode: "",
      localNumber: sanitizePhoneLocalNumber(compact),
    };
  }

  return {
    option,
    dialCode: option.dialCode,
    localNumber: sanitizePhoneLocalNumber(compact.slice(option.dialCode.length)),
  };
};
