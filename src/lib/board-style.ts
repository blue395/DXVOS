// The deals board's look, shared by the team board and the members' round board.
// Brand-only colours: phases are told apart by tints of DXV green/yellow (and black for
// Declined), never by extra hues.
import type { StagePhase } from "./pipeline";

export const PHASE_STYLE: Record<StagePhase, { column: string; header: string; dot: string; label: string }> = {
  intake: { column: "bg-dxv-yellow/10 border-dxv-yellow/40", header: "border-dxv-yellow/40", dot: "bg-dxv-yellow ring-1 ring-dxv-green/30", label: "Intake" },
  review: { column: "bg-dxv-green/[0.03] border-dxv-green/15", header: "border-dxv-green/15", dot: "bg-dxv-green/40", label: "Review & pitch" },
  closing: { column: "bg-dxv-green/[0.07] border-dxv-green/20", header: "border-dxv-green/20", dot: "bg-dxv-green/70", label: "Closing" },
  invested: { column: "bg-dxv-green/[0.12] border-dxv-green/30", header: "border-dxv-green/30", dot: "bg-dxv-green", label: "Invested" },
  passed: { column: "bg-black/[0.03] border-black/15", header: "border-black/10", dot: "bg-black/60", label: "Kept for learning" },
};
