import { useEffect, type MutableRefObject } from "react";

/**
 * Keep a ref in sync with the latest prop/state value, after each render.
 * Use when a long-lived closure (a mount-bound event handler, an observer
 * callback, etc.) needs to read the current value without re-binding.
 *
 * Why not just `ref.current = value` inline in the component body?
 * — `react-hooks/refs` forbids ref writes during render, because under
 *   React Compiler memoization a skipped render means the write never
 *   happens and downstream closures see a stale value.
 *
 * No-deps `useEffect` runs after every commit, so we always converge.
 */
export function useSyncRef<T>(ref: MutableRefObject<T>, value: T) {
  useEffect(() => {
    ref.current = value;
  });
}
