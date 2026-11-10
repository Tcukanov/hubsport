import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">Page not found</h1>
      <p className="text-sm text-stone-600">That address does not exist. It may have been moved or deleted.</p>
      <Link href="/" className="rounded-full bg-teal-900 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800">
        Back to Home
      </Link>
    </div>
  );
}
