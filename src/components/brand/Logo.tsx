import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  compact?: boolean;
  href?: string;
  className?: string;
}

export function Logo({ compact = false, href = "/", className }: LogoProps) {
  const content = (
    <span className={cn("inline-flex items-center gap-2.5 group", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-lg bg-[#4F46E5] text-white shadow-xs transition-transform group-hover:scale-[1.03]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Parametric CAD arc + crosshair compass emblem */}
          <path d="M5 19 A 14 14 0 0 1 19 5" />
          <path d="M9 19 A 10 10 0 0 1 19 9" strokeDasharray="2.5 2" />
          <path d="M5 19 L 19 19 L 19 5" strokeOpacity="0.45" />
          <circle cx="19" cy="19" r="1.5" fill="currentColor" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight text-[#0F172A]">
            PatternCAD
          </span>
          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-[#4F46E5] border border-indigo-200/80">
            PRO
          </span>
        </span>
        {!compact && (
          <span className="mt-0.5 text-[10px] font-medium text-slate-500">
            Parametric Garment CAD
          </span>
        )}
      </span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center focus:outline-none">
      {content}
    </Link>
  );
}
