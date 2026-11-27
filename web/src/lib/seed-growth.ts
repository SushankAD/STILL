export const seedStages = [
  { number: 1, name: 'Seed Drop', roots: 0, copy: 'Quiet beginning. Roots forming.' },
  { number: 2, name: 'Rooted Drop', roots: 1000, copy: 'Your roots are becoming visible.' },
  { number: 3, name: 'First Leaves', roots: 1800, copy: 'New life is starting to show.' },
  { number: 4, name: 'Small Plant', roots: 2800, copy: 'The practice is growing into something real.' },
  { number: 5, name: 'Still Tree', roots: 5000, copy: 'Rooted, alive, and still becoming.' },
] as const

const [startingStage, ...laterStages] = seedStages
type SeedStage = typeof seedStages[number]
type SeedTarget = typeof laterStages[number]['roots']
export type SeedMilestones = Partial<Record<SeedTarget, number>>

export function updateSeedMilestones(previous: SeedMilestones, roots: number, earnedAt: number): SeedMilestones {
  const milestones = { ...previous }
  for (const { roots: target } of laterStages) {
    if (roots < target) delete milestones[target]
    else milestones[target] ??= earnedAt
  }
  return milestones
}

export type RootCredit = { roots: number; earnedAt: number }

export function seedMilestonesFromCredits(credits: readonly RootCredit[]): SeedMilestones {
  const milestones: SeedMilestones = {}
  const targets = laterStages.map(({ roots }) => roots)
  let total = 0
  let nextTarget = 0
  for (const credit of [...credits].sort((a, b) => a.earnedAt - b.earnedAt)) {
    total += credit.roots
    while (nextTarget < targets.length && total >= targets[nextTarget]) {
      milestones[targets[nextTarget++]] = credit.earnedAt
    }
    if (nextTarget === targets.length) break
  }
  return milestones
}

function afterCalendarMonth(enteredAt: number): number {
  const date = new Date(enteredAt)
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + 2, 0)
  date.setUTCDate(Math.min(day, date.getUTCDate()))
  return date.getTime()
}

export function getSeedGrowth(startedAt: number, milestones: SeedMilestones, now: number, seventhVisitAt: number | null) {
  let stage: SeedStage = startingStage
  let enteredAt = startedAt

  for (const next of laterStages) {
    const nextTimeAt = next.number === 2 ? enteredAt + 7 * 86_400_000 : afterCalendarMonth(enteredAt)
    const pointsAt = milestones[next.roots]
    const visitAt = next.number === 2 ? seventhVisitAt : enteredAt
    if (visitAt === null || visitAt > now || nextTimeAt > now || pointsAt === undefined || pointsAt > now) {
      return { stage, enteredAt, next, nextTimeAt }
    }
    stage = next
    enteredAt = Math.max(nextTimeAt, pointsAt, visitAt)
  }

  return { stage, enteredAt, next: null, nextTimeAt: null }
}

export function seedRootsProgress(roots: number, target: number) {
  const credited = Math.min(target, Math.max(0, roots))
  return { credited, percent: credited / target * 100, goalMet: credited === target }
}
