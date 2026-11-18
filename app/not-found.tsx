import Link from "next/link";
import { Puffin } from "@/components/brand/Puffin";

export default function NotFound() {
  return (
    <div className="px-6 py-20 text-center lg:px-10">
      <Puffin size={72} mood="curious" className="mx-auto" />
      <h1 className="mt-4 font-display text-[24px] font-semibold text-ink">This page wandered off</h1>
      <p className="mt-1 text-[14px] text-ink-muted">That page isn&rsquo;t part of PaperPuffin.</p>
      <Link href="/home" className="mt-5 inline-block text-[14px] font-semibold text-accent hover:underline">
        ← Back to Home
      </Link>
    </div>
  );
}
