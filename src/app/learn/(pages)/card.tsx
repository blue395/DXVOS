/** A course page's card (light and dark). */
export function LearnCard({ children }: { children: React.ReactNode }) {
  return <div className="space-y-5 rounded-xl border border-[#d6dfda] bg-white p-5 sm:p-8 dark:border-[#274540] dark:bg-[#132a25]">{children}</div>;
}

export const learnHeading = "text-2xl font-semibold text-[#1a3c35] dark:text-[#fbe45b]";
export const learnMuted = "text-[#52665f] dark:text-[#a3b6af]";
export const learnLink = "font-medium text-[#5c3d68] underline dark:text-[#d3b1e2]";
