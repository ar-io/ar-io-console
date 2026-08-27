import { useCallback, useRef, useState } from 'react';

/**
 * Stable transient keys for a dynamic list of rows whose data carries no id
 * (e.g. social items, custom tags). Using the array index as a React key makes a
 * mid-list delete reuse the wrong row's DOM/focus/draft value; these keys move
 * with the row instead. Client-only — never persisted (no schema change).
 *
 * Keep keys in lockstep with the data by calling `append`/`removeAt` alongside the
 * list mutation. `keys` also self-reconciles if the length drifts from an external
 * reset/replace (append/truncate at the end).
 */
export function useListKeys(length: number): {
  keys: string[];
  append: () => void;
  removeAt: (index: number) => void;
} {
  const seqRef = useRef(0);
  const genId = () => `row-${seqRef.current++}`;
  const [keys, setKeys] = useState<string[]>(() => Array.from({ length }, genId));

  // Reconcile external length drift during render (supported derived-state pattern);
  // guarded so it converges (after the update keys.length === length).
  if (keys.length !== length) {
    setKeys((prev) =>
      prev.length < length
        ? [...prev, ...Array.from({ length: length - prev.length }, genId)]
        : prev.slice(0, length),
    );
  }

  const append = useCallback(() => setKeys((prev) => [...prev, genId()]), []);
  const removeAt = useCallback(
    (index: number) => setKeys((prev) => prev.filter((_, i) => i !== index)),
    [],
  );
  return { keys, append, removeAt };
}
