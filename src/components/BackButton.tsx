"use client";

import { useRouter, usePathname } from "next/navigation";

/**
 * A quiet back control. It appears on every screen except the home screen,
 * where there is nothing behind to return to.
 */
export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <button
      type="button"
      className="back-button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push("/");
        }
      }}
      aria-label="Go back"
    >
      <span aria-hidden="true">←</span> {label}
    </button>
  );
}
