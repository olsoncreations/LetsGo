import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

export function autolink(text: string | null | undefined): React.ReactNode {
  if (!text) return text ?? null;

  const parts = text.split(URL_REGEX);

  return parts.map((part, i) => {
    // Captured URL groups land at odd indices (split with capturing group).
    if (i % 2 === 0) return part;

    const trailing = part.match(TRAILING_PUNCTUATION)?.[0] ?? "";
    const url = trailing ? part.slice(0, -trailing.length) : part;

    return (
      <React.Fragment key={i}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#00d4ff", textDecoration: "underline" }}
        >
          {url}
        </a>
        {trailing}
      </React.Fragment>
    );
  });
}
