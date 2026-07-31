import { Logo } from "./logo";

/**
 * Mobile top banner — design §5.
 * Below lg the branding panel collapses into this gradient strip.
 */
export function MobileBanner() {
  return (
    <div className="relative overflow-hidden bg-primary px-6 pb-7 pt-8 lg:hidden">
      <div className="bg-brand-radial absolute inset-0" aria-hidden="true" />
      <div
        className="bg-brand-dots absolute inset-0 opacity-[0.05]"
        aria-hidden="true"
      />
      <div className="relative z-10">
        <Logo variant="light" />
        <p className="mt-4 max-w-[320px] font-display text-[19px] font-bold leading-snug text-white">
          One Platform for{" "}
          <span className="text-accent-soft">Your Entire Institution</span>
        </p>
      </div>
    </div>
  );
}
