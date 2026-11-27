export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calendarMonthBounds(month: Date) {
  return {
    start: new Date(month.getFullYear(), month.getMonth(), 1).toISOString(),
    end: new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString(),
  }
}

export function calendarMonthDays(month: Date): (Date | null)[] {
  const year = month.getFullYear()
  const index = month.getMonth()
  const offset = new Date(year, index, 1).getDay()
  const last = new Date(year, index + 1, 0).getDate()
  return Array.from({ length: Math.ceil((offset + last) / 7) * 7 }, (_, cell) => {
    const day = cell - offset + 1
    return day > 0 && day <= last ? new Date(year, index, day) : null
  })
}
