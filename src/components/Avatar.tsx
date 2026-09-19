"use client";

import { avatarHue, initialsOf } from "@/lib/avatar";

/**
 * A person, shown as their picture if they have one and their initials if they
 * do not. Used wherever a name appears.
 */
export function Avatar({
  name,
  address,
  src,
  size = 32,
}: {
  name?: string;
  address?: string;
  src?: string | null;
  size?: number;
}) {
  const label = name?.trim() || address || "";
  const hue = avatarHue(label || "pinna");

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        width={size}
        height={size}
        style={{
          width: size,
          height: size,
          borderRadius: "999px",
          objectFit: "cover",
          border: "1px solid var(--hairline)",
          flex: "0 0 auto",
        }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "999px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: `hsl(${hue} 22% 26%)`,
        color: "var(--bone)",
        fontSize: size * 0.36,
        letterSpacing: "0.04em",
        border: "1px solid var(--hairline)",
        flex: "0 0 auto",
      }}
    >
      {initialsOf(label)}
    </span>
  );
}
