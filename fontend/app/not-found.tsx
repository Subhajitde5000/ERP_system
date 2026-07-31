import Link from "next/link";
import { Logo } from "@/components/auth/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-[420px] text-center">
        <Logo className="mb-8 justify-center" />

        <div className="rounded-card border border-[#E2E8F0] bg-white p-8 shadow-card">
          <p className="font-display text-[40px] font-bold leading-none text-accent">
            404
          </p>
          <h1 className="mt-3 font-display text-[20px] font-bold text-[#0F172A]">
            Page not found
          </h1>
          <p className="mt-2 text-[13px] text-[#64748B]">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-field bg-accent px-5 text-[14px] font-semibold text-white shadow-accent transition-colors hover:bg-accent-hover"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
