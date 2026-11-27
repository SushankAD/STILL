import { deepEqual, equal } from 'node:assert/strict'
import { test } from 'node:test'
import { calendarMonthBounds, calendarMonthDays, localDateString } from '../src/lib/calendar.ts'

test('the complete month grid includes leap days, Sunday starts, and six-row months', () => {
  const november = calendarMonthDays(new Date(2026, 10, 1))
  equal(november.length, 35)
  equal(november[0]?.getDate(), 1)
  equal(november[29]?.getDate(), 30)
  equal(november[30], null)
  equal(calendarMonthDays(new Date(2024, 1, 1)).filter(Boolean).length, 29)
  equal(calendarMonthDays(new Date(2026, 4, 1)).length, 42)
  equal(calendarMonthDays(new Date(2027, 0, 1)).filter(Boolean).length, 31)
})

test('month bounds and photo dates use local time, including DST and year rollover', () => {
  const previous = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    deepEqual(calendarMonthBounds(new Date(2026, 10, 15)), {
      start: '2026-11-01T04:00:00.000Z', end: '2026-12-01T05:00:00.000Z',
    })
    deepEqual(calendarMonthBounds(new Date(2026, 11, 1)), {
      start: '2026-12-01T05:00:00.000Z', end: '2027-01-01T05:00:00.000Z',
    })
    equal(localDateString(new Date('2026-11-26T02:00:00Z')), '2026-11-25')
    equal(localDateString(new Date('2026-11-26T05:00:00Z')), '2026-11-26')
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})
