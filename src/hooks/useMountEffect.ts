import { useEffect } from "react";

/**
 * Run an effect exactly once after mount, with optional cleanup on unmount.
 * This is the ONLY acceptable way to call useEffect in this codebase.
 * Use it for subscribing to external systems (DOM events, observers, etc.).
 */
export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}
