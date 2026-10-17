"use client";

import { Check, X } from "lucide-react";
import { getPasswordRequirements } from "@/src/lib/auth/passwordPolicy";

export default function PasswordRequirements({ password, recentLogin }) {
  const requirements = getPasswordRequirements(password);

  if (recentLogin !== undefined) {
    requirements.push({
      label: "Signed in within the last 24 hours",
      met: recentLogin,
    });
  }

  return (
    <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2" aria-live="polite">
      {requirements.map(({ label, met }) => {
        const Icon = met ? Check : X;

        return (
          <li
            key={label}
            className={`flex items-center gap-2 ${met ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={2.5} />
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
