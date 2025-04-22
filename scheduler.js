import cron from 'node-cron';
import { DateTime } from 'luxon';
import {
  InterestByZoneRaw,
  InterestByZoneHourly,
  InterestByZoneDaily,
  InterestByZoneWeekly,
  HeatmapRaw,
  HeatmapHourly,
  HeatmapDaily,
  HeatmapWeekly,
} from './models.js';

/* ---------------- Interest‑By‑Zone Helpers ----------------------- */
async function aggregateZoneCounts(startISO, endISO, ch) {
  return InterestByZoneRaw.aggregate([
    { $match: { ch, datetime: { $gte: new Date(startISO), $lt: new Date(endISO) } } },
    { $group: { _id: '$zone_name', total: { $sum: '$count' } } },
    { $project: { _id: 0, zone_name: '$_id', count: '$total' } },
  ]);
}

/* ---------------- Heatmap Helpers ------------------------------- */
async function aggregateHeatmap(startISO, endISO, ch) {
  const docs = await HeatmapRaw.find({
    ch,
    datetime: { $gte: new Date(startISO), $lt: new Date(endISO) },
  }, { heatmap: 1 }).lean();

  if (!docs.length) return null;

  const len = docs[0].heatmap.length;
  const sum = Array(len).fill(0);

  for (const d of docs) {
    const arr = d.heatmap || [];
    if (arr.length !== len) continue;
    for (let i = 0; i < len; i++) sum[i] += arr[i];
  }
  return sum;
}

/* ---------------- Cron Jobs (Asia/Taipei) ------------------------ */
const CH_LIST = [3, 4]; // 若有更多路，擴充此陣列

// 每小時
cron.schedule('0 * * * *', async () => {
  const now = DateTime.now().setZone('Asia/Taipei');
  const start = now.minus({ hours: 1 }).startOf('hour');
  const end   = start.plus({ hours: 1 });

  for (const ch of CH_LIST) {
    // ---- IZ ----
    const zones = await aggregateZoneCounts(start.toISO(), end.toISO(), ch);
    if (zones.length) {
      await InterestByZoneHourly.updateOne(
        { dateHour: start.toJSDate(), ch },
        { $set: { zones } },
        { upsert: true },
      );
      console.log(`[Hourly IZ] ${start.toISO()} CH${ch}`);
    }

    // ---- Heatmap ----
    const heatmap = await aggregateHeatmap(start.toISO(), end.toISO(), ch);
    if (heatmap) {
      await HeatmapHourly.updateOne(
        { dateHour: start.toJSDate(), ch },
        { $set: { heatmap } },
        { upsert: true },
      );
      console.log(`[Hourly HM] ${start.toISO()} CH${ch}`);
    }
  }
}, { timezone: 'Asia/Taipei' });

// 每天 00:00
cron.schedule('0 0 * * *', async () => {
  const today = DateTime.now().setZone('Asia/Taipei').minus({ days: 1 });
  const start = today.startOf('day');
  const end   = start.plus({ days: 1 });

  for (const ch of CH_LIST) {
    const zones = await aggregateZoneCounts(start.toISO(), end.toISO(), ch);
    if (zones.length) {
      await InterestByZoneDaily.updateOne(
        { date: start.toJSDate(), ch },
        { $set: { zones } },
        { upsert: true },
      );
      console.log(`[Daily IZ] ${start.toISODate()} CH${ch}`);
    }

    const heatmap = await aggregateHeatmap(start.toISO(), end.toISO(), ch);
    if (heatmap) {
      await HeatmapDaily.updateOne(
        { date: start.toJSDate(), ch },
        { $set: { heatmap } },
        { upsert: true },
      );
      console.log(`[Daily HM] ${start.toISODate()} CH${ch}`);
    }
  }
}, { timezone: 'Asia/Taipei' });

// 每週一 00:00
cron.schedule('0 0 * * 1', async () => {
  const start = DateTime.now().setZone('Asia/Taipei').minus({ weeks: 1 }).startOf('week');
  const end   = start.plus({ weeks: 1 });

  for (const ch of CH_LIST) {
    const zones = await aggregateZoneCounts(start.toISO(), end.toISO(), ch);
    if (zones.length) {
      await InterestByZoneWeekly.updateOne(
        { weekStart: start.toJSDate(), ch },
        { $set: { zones } },
        { upsert: true },
      );
      console.log(`[Weekly IZ] ${start.toISODate()} CH${ch}`);
    }

    const heatmap = await aggregateHeatmap(start.toISO(), end.toISO(), ch);
    if (heatmap) {
      await HeatmapWeekly.updateOne(
        { weekStart: start.toJSDate(), ch },
        { $set: { heatmap } },
        { upsert: true },
      );
      console.log(`[Weekly HM] ${start.toISODate()} CH${ch}`);
    }
  }
}, { timezone: 'Asia/Taipei' }
);