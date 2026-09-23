import { db } from '../src/lib/db.js';

// The compound's shared rooms. This is site reference data — the rooms exist
// whether or not anyone has booked them yet — so it is seeded rather than
// created through the app. Re-running only adds rooms that are missing.
const ROOMS = [
  {
    name: 'חדר דקל',
    building: 'A',
    floor: '2',
    capacity: 8,
    features: ['screen', 'whiteboard', 'video'],
    description: 'חדר ישיבות עם מסך ומערכת וידאו',
  },
  {
    name: 'חדר נגב',
    building: 'A',
    floor: '3',
    capacity: 6,
    features: ['screen', 'whiteboard'],
    description: 'חדר דיונים קטן',
  },
  {
    name: 'חדר ערבה',
    building: 'B',
    floor: '1',
    capacity: 4,
    features: ['screen'],
    description: 'חדר עבודה זוגי',
  },
  {
    name: 'חדר תמר',
    building: 'B',
    floor: '2',
    capacity: 12,
    features: ['screen', 'whiteboard', 'video'],
    description: 'חדר ישיבות מרכזי',
  },
  {
    name: 'חדר שיטה',
    building: 'B',
    floor: '3',
    capacity: 16,
    features: ['screen', 'video'],
    description: 'אולם הדרכה',
  },
  {
    name: 'חדר רותם',
    building: 'C',
    floor: '1',
    capacity: 10,
    features: ['whiteboard', 'video'],
    description: 'חדר סדנאות',
  },
];

async function main() {
  let created = 0;

  for (const room of ROOMS) {
    const existing = await db.room.findFirst({
      where: { name: room.name, building: room.building },
    });
    if (existing) continue;

    await db.room.create({ data: room });
    created += 1;
  }

  console.log(`Rooms seeded: ${created} created, ${ROOMS.length - created} already present`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
