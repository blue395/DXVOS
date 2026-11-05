// Migration 20261106090000_founder_diversity_names, against a fresh database: the Assessment
// Playbook version it adds is valid (the AI would otherwise fall back to version 0) and
// carries Kevin's founder diversity wording.
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { currentPlaybook } from "./playbook/current";

afterAll(async () => {
  await db.$disconnect();
});

describe("founder diversity names migration", () => {
  it("adds a valid Assessment Playbook version with the new themes first", async () => {
    const p = await currentPlaybook("ASSESSMENT");
    expect(p.version).toBeGreaterThanOrEqual(1);
    expect(p.content.diversityThemes.slice(0, 7)).toEqual([
      "Female Founder",
      "Person of Colour Founder",
      "Neurodivergent Founder (name the specific condition where stated, e.g. ADHD, autism)",
      "Disabled Founder",
      "Founder from socio-economic disadvantaged background",
      "LGBTQIA+ Founder",
      "First time founder over 50",
    ]);
    expect(p.content.diversityThemes).toEqual(expect.arrayContaining(["Immigrant", "Not university educated", "Experienced homelessness"]));
    expect(p.content.diversityThemes.join("|")).not.toMatch(/Ethnic Minority|Global majority|LGBTQ\+(?!IA)|^Disability|Low socio-economic/);
  });
});
