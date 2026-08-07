import { Weekday } from '@prisma/client';

const JS_DAY_TO_WEEKDAY: Weekday[] = [
  Weekday.SUN,
  Weekday.MON,
  Weekday.TUE,
  Weekday.WED,
  Weekday.THU,
  Weekday.FRI,
  Weekday.SAT,
];

export function todayWeekday(): Weekday {
  return JS_DAY_TO_WEEKDAY[new Date().getDay()]!;
}
