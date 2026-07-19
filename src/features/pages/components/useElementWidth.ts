import { useEffect, useRef, useState } from 'react';

/**
 * Track an element's rendered width via ResizeObserver. Used to scale live
 * `<iframe>` previews to whatever width their card/column happens to be, so the
 * gallery thumbnails and editor preview stay crisp and responsive.
 */
export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}
