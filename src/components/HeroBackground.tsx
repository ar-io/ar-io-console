import { memo } from "react";

/**
 * Hero background: the clouds photo composited into the brand kit's
 * `framed-dark-hero` treatment.
 *
 * The kit's hero pattern is a deep-dark (#0e0a1c) frame with white copy,
 * lavender emphasis, and — where there is art — "media" plus an optional media
 * gradient overlay and subtle radial purple glows. So the clouds are kept and
 * relit rather than dropped: deep-dark ground, the photo screened back over it,
 * then a gradient that weights the darkness toward the bottom where the
 * subheadline, CTAs and terminal sit.
 *
 * Layer order matters — each one sits on the previous:
 *   1. deep-dark ground (never transparent, so text contrast can't depend on the photo loading)
 *   2. clouds, dimmed and desaturated toward the brand's violet
 *   3. vertical gradient for legibility of the lower content
 *   4. two radial purple glows
 */
export const HeroBackground = memo(function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-deep-dark" aria-hidden="true">
      {/* Clouds. Deliberately NO mix-blend-mode: `luminosity` takes the photo's
          lightness but the BACKDROP's hue, which repainted the clouds solid
          purple and read as a flat wash rather than sky. Left in normal blend
          they keep their own tone; opacity alone does the sitting-back. */}
      <img
        src={`${import.meta.env.BASE_URL}cloud.webp`}
        alt=""
        aria-hidden="true"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />

      {/* Media gradient overlay: heavier at the top to keep white copy legible
          over bright cloud patches, heaviest at the bottom behind CTAs/terminal.
          0.55 at top ⇒ worst-case white-on-clouds ≈ 3.4:1 (large-bold AA). */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgb(14 10 28 / 0.55) 0%, rgb(14 10 28 / 0.58) 45%, rgb(14 10 28 / 0.85) 100%)',
        }}
      />

      {/* Radial purple glows — the kit's hero signature, kept low enough that
          they tint the sky rather than replace it. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 55% at 50% 0%, rgb(84 39 200 / 0.28), transparent 72%), radial-gradient(45% 45% at 85% 100%, rgb(212 198 255 / 0.12), transparent 70%)',
        }}
      />
    </div>
  );
});

export default HeroBackground;
