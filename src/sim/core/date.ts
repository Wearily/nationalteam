/** Dates are integer day numbers (days since 1970-01-01 UTC). */
export type Day = number
const MS = 86400000

export const toDay = (y: number, m: number, d: number): Day => Math.floor(Date.UTC(y, m - 1, d) / MS)
export const parseDay = (iso: string): Day => {
  const [y, m, d] = iso.split('-').map(Number)
  return toDay(y, m || 7, d || 1)
}
export const ymd = (day: Day) => {
  const dt = new Date(day * MS)
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() }
}
export const iso = (day: Day) => new Date(day * MS).toISOString().slice(0, 10)
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const fmtDay = (day: Day, withYear = true) => {
  const { y, m, d } = ymd(day)
  return `${d} ${MON[m - 1]}${withYear ? ' ' + y : ''}`
}
export const fmtDow = (day: Day) => DOW[ymd(day).dow]
export const monthName = (m: number) => MON[m - 1]
export const ageOn = (dob: Day, on: Day) => {
  const a = ymd(dob)
  const b = ymd(on)
  let age = b.y - a.y
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) age--
  return age
}
/** Next occurrence of weekday `dow` (0=Sun) on or after `day`. */
export const nextDow = (day: Day, dow: number) => day + ((dow - ymd(day).dow + 7) % 7)
