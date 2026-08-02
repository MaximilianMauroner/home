import type { ReactNode } from "react";

import "./stretching-shell.css";

export type StretchingShellVariant = "discovery" | "wide" | "focus";

interface StretchingShellProps {
  children: ReactNode;
  className?: string;
  variant: StretchingShellVariant;
}

export function StretchingShell({
  children,
  className = "",
  variant,
}: StretchingShellProps) {
  return (
    <div
      className={`stretching-shell stretching-shell--${variant} ${className}`.trim()}
      data-stretching-shell={variant}
    >
      {children}
    </div>
  );
}
