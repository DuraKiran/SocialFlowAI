export interface SlotInput {
  videoCount: number;
  startDate: Date;
  perDay: number;
  timeSlots: string[]; // "HH:MM" in user's local time
  weekdaysOnly: boolean;
  mode: 'sequential' | 'daily' | 'smart';
}

export interface Slot {
  index: number;
  date: Date;
}

export function distributeSlots(input: SlotInput): Slot[] {
  const slots: Slot[] = [];
  const times = input.timeSlots.length ? input.timeSlots : ['10:00'];
  const perDay = Math.max(1, input.perDay);
  const dayMs = 24 * 60 * 60 * 1000;

  let day = new Date(input.startDate);
  let slotInDay = 0;
  let assigned = 0;

  while (assigned < input.videoCount && assigned < 200) {
    if (input.weekdaysOnly && (day.getDay() === 0 || day.getDay() === 6)) {
      day = new Date(day.getTime() + dayMs);
      slotInDay = 0;
      continue;
    }
    if (slotInDay >= Math.min(perDay, times.length * (input.mode === 'smart' ? 1 : 1))) {
      day = new Date(day.getTime() + dayMs);
      slotInDay = 0;
      continue;
    }
    const time = times[slotInDay % times.length];
    const [h, m] = time.split(':').map(Number);
    const date = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h || 10, m || 0, 0, 0);
    slots.push({ index: assigned, date });
    assigned++;
    slotInDay++;
    if (slotInDay >= perDay) {
      day = new Date(day.getTime() + dayMs);
      slotInDay = 0;
    }
  }
  return slots;
}

export function formatSlot(d: Date): string {
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
