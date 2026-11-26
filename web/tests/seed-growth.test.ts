import { deepEqual, equal } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { getSeedGrowth, seedMilestonesFromCredits, seedRootsProgress, seedStages, updateSeedMilestones } from '../src/lib/seed-growth.ts'

const time = (day: string) => Date.parse(day + 'T12:00:00Z')
const started = time('2026-11-25')

test('1,000 roots earned on day four leave Stage 2 locked for the full week', () => {
  const milestones = { 1000: time('2026-11-29') }
  const before = getSeedGrowth(started, milestones, time('2026-12-02') - 1)
  equal(before.stage.number, 1)
  equal(before.nextTimeAt, time('2026-12-02'))
  const after = getSeedGrowth(started, milestones, time('2026-12-02'))
  equal(after.stage.number, 2)
  equal(after.enteredAt, time('2026-12-02'))
  equal(after.nextTimeAt, time('2027-01-02'))
})

test('late roots start the next stage clock on the actual unlock date', () => {
  const milestones = { 1000: time('2026-12-12'), 1800: time('2026-12-14') }
  equal(getSeedGrowth(started, milestones, time('2026-12-10')).stage.number, 1)
  const before = getSeedGrowth(started, milestones, time('2027-01-12') - 1)
  equal(before.stage.number, 2)
  equal(before.enteredAt, time('2026-12-12'))
  equal(before.nextTimeAt, time('2027-01-12'))
  equal(getSeedGrowth(started, milestones, time('2027-01-12')).stage.number, 3)
})

test('meeting a time milestone cannot replace the points gate', () => {
  const milestones = { 1000: time('2026-11-29'), 1800: time('2027-01-16') }
  equal(getSeedGrowth(started, milestones, time('2027-01-15')).stage.number, 2)
  const stageThree = getSeedGrowth(started, milestones, time('2027-01-16'))
  equal(stageThree.stage.number, 3)
  equal(stageThree.enteredAt, time('2027-01-16'))
  equal(stageThree.nextTimeAt, time('2027-02-16'))
})

test('5,000 roots cannot skip stages and the earliest Stage 5 is a week plus three months', () => {
  const allEarned = seedMilestonesFromCredits([{ roots: 5000, earnedAt: time('2026-11-30') }])
  for (const [day, number] of [
    ['2026-12-01', 1], ['2026-12-02', 2], ['2027-01-02', 3], ['2027-02-02', 4], ['2027-03-02', 5],
  ] as const) equal(getSeedGrowth(started, allEarned, time(day)).stage.number, number)
  equal(getSeedGrowth(started, allEarned, time('2027-03-02')).next, null)
})

test('calendar months clamp to the last actual day of the next month', () => {
  const milestones = { 1000: time('2027-01-31'), 1800: time('2027-02-01') }
  const stageTwo = getSeedGrowth(started, milestones, time('2027-02-27'))
  equal(stageTwo.nextTimeAt, time('2027-02-28'))
  equal(getSeedGrowth(started, milestones, time('2027-02-28')).stage.number, 3)
})

test('out-of-order credits and browser-local updates retain the first points crossing', () => {
  const first = time('2026-12-01')
  const second = time('2026-12-02')
  deepEqual(seedMilestonesFromCredits([
    { roots: 1000, earnedAt: second }, { roots: 1000, earnedAt: first },
  ]), { 1000: first, 1800: second })
  const saved = updateSeedMilestones({}, 1000, first)
  deepEqual(updateSeedMilestones(saved, 1800, second), { 1000: first, 1800: second })
  deepEqual(updateSeedMilestones(saved, 999, second), {})
})

test('every seed stage has a PNG in the app asset directory', () => {
  for (const stage of seedStages) {
    const art = readFileSync(new URL(`../public/assets/still-logo-stage-${stage.number}.png`, import.meta.url))
    equal(art.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  }
})


test('the Seed Drop bar grows with roots and is full only at the target', () => {
  deepEqual(seedRootsProgress(16, 1000), { credited: 16, percent: 1.6, goalMet: false })
  deepEqual(seedRootsProgress(999, 1000), { credited: 999, percent: 99.9, goalMet: false })
  deepEqual(seedRootsProgress(1000, 1000), { credited: 1000, percent: 100, goalMet: true })
  deepEqual(seedRootsProgress(1200, 1000), { credited: 1000, percent: 100, goalMet: true })
  for (let roots = 1; roots <= 1000; roots++) {
    equal(seedRootsProgress(roots, 1000).percent > seedRootsProgress(roots - 1, 1000).percent, true)
  }
})
