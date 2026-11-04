import { cn } from "@/lib/utils";

export function ScoreRing({ score, className }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  const tone = score >= 75 ? "text-emerald-500" : score >= 55 ? "text-amber-500" : "text-muted-foreground";
  return (
    <div className={cn("relative grid size-11 shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          className={cn("stroke-current transition-[stroke-dashoffset] duration-500", tone)}
        />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{score}</span>
    </div>
  );
}
