export type Q4 = "several" | "one" | "none" | "flopped";

export interface IdeaAnswers {
  idea: string;
  q1: 1 | 3 | 5;
  q2: number; // 1 to 10
  q3: 1 | 3 | 5;
  q4: Q4;
}

export interface IdeaResult {
  score: number;
  band: "Make it" | "Queue it" | "Rework the angle" | "Kill it";
  reach: number; // 0 to 100
  worth: number; // 0 to 100
  proofMultiplier: number;
  capped: boolean;
}

const PROOF: Record<Q4, number> = {
  several: 1.15,
  one: 1.0,
  none: 0.85,
  flopped: 0.6,
};

export function scoreIdea(a: IdeaAnswers): IdeaResult {
  const proofMultiplier = PROOF[a.q4];

  // Reach: the ceiling, discounted or lifted by whether it has been proven.
  const R = Math.min(1, (a.q1 / 5) * proofMultiplier);

  // Worth reaching: relevance is the anchor, distinctiveness swings it by plus or minus 40 percent.
  const V = (a.q2 / 10) * (0.6 + 0.4 * (a.q3 / 5));

  // Geometric mean. Both halves must be present. Virality cannot buy its way past irrelevance.
  let score = 100 * Math.sqrt(R * V);

  // Hard relevance cap: if it is not for the buyer, it cannot rank well however far it travels.
  const capped = a.q2 <= 4 && score > 40;
  if (capped) score = 40;

  const rounded = Math.round(score);

  return {
    score: rounded,
    band:
      rounded >= 80
        ? "Make it"
        : rounded >= 60
          ? "Queue it"
          : rounded >= 40
            ? "Rework the angle"
            : "Kill it",
    reach: Math.round(R * 100),
    worth: Math.round(V * 100),
    proofMultiplier,
    capped,
  };
}
