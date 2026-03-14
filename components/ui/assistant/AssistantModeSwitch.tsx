"use client";

import {
  ASSISTANT_MODE_OPTIONS,
  type AssistantActionMode,
} from "@/lib/assistant/assistantActionConfig";

export default function AssistantModeSwitch({
  value,
  onChange,
}: {
  value: AssistantActionMode;
  onChange: (value: AssistantActionMode) => void;
}) {
  const activeOption =
    ASSISTANT_MODE_OPTIONS.find((option) => option.value === value) ||
    ASSISTANT_MODE_OPTIONS[0];

  return (
    <div className="mt-3 rounded-2xl border border-stone-200/80 bg-white/85 p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-stone-500">
            Assistant Mode
          </p>
          <p className="mt-1 text-[11px] leading-5 text-stone-500">
            {activeOption.description}
          </p>
        </div>
      </div>

      <div className="mt-2 inline-flex w-full rounded-full bg-stone-100 p-1">
        {ASSISTANT_MODE_OPTIONS.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-black text-white shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
              key={option.value}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
