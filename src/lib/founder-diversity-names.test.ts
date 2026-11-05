import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FOUNDER_DIVERSITY_RENAMES, FOUNDER_DIVERSITY_THEMES, canonicalFounderTheme, canonicalFounderThemes, diversityBreakdown } from "./pipeline";
import { DIVERSITY_OPTIONS } from "./founder-intake";

describe("founder diversity: Kevin's wording (2026-11-05)", () => {
  it("offers Kevin's seven first, then the earlier themes with no match", () => {
    expect(FOUNDER_DIVERSITY_THEMES.slice(0, 7)).toEqual([
      "Female Founder",
      "Person of Colour Founder",
      "Neurodivergent Founder",
      "Disabled Founder",
      "Founder from socio-economic disadvantaged background",
      "LGBTQIA+ Founder",
      "First time founder over 50",
    ]);
    expect(FOUNDER_DIVERSITY_THEMES.slice(7)).toEqual(["Immigrant", "Not university educated", "Experienced homelessness", "Experienced Care"]);
    expect(DIVERSITY_OPTIONS).toContain("First time founder over 50");
  });
  it("renames the old names, keeping any detail in brackets, and leaves the rest alone", () => {
    expect(canonicalFounderTheme("Ethnic Minority")).toBe("Person of Colour Founder");
    expect(canonicalFounderTheme("global majority")).toBe("Person of Colour Founder");
    expect(canonicalFounderTheme("Neurodiversity (ADHD)")).toBe("Neurodivergent Founder (ADHD)");
    expect(canonicalFounderTheme(" LGBTQ+ ")).toBe("LGBTQIA+ Founder");
    expect(canonicalFounderTheme("Immigrant")).toBe("Immigrant");
    expect(canonicalFounderTheme("Veteran")).toBe("Veteran");
    expect(canonicalFounderThemes(["Ethnic Minority", "Global majority", "Disability", "Disabled Founder"])).toEqual([
      "Person of Colour Founder",
      "Disabled Founder",
    ]);
  });
  it("counts old and new names together in portfolio breakdowns", () => {
    const b = diversityBreakdown([
      { diversityThemes: ["Ethnic Minority"] },
      { diversityThemes: ["Person of Colour Founder"] },
      { diversityThemes: ["Global majority"] },
    ]);
    expect(b.themes).toEqual([{ label: "Person of Colour Founder", count: 3 }]);
  });
  it("matches the migration that renamed the stored data", () => {
    const sql = readFileSync("prisma/migrations/20261106090000_founder_diversity_names/migration.sql", "utf8");
    const pairs = Object.fromEntries([...sql.matchAll(/WHEN '([^']+)' THEN '([^']+)'/g)].map((m) => [m[1], m[2]]));
    expect(pairs).toEqual(FOUNDER_DIVERSITY_RENAMES);
  });
});
