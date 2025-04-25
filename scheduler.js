import cron from 'node-cron';
import { DateTime } from 'luxon';
import {
  // IZ
  InterestByZoneRaw,
  InterestByZoneHourly, InterestByZoneDaily, InterestByZoneWeekly,
  // Heatmap
  HeatmapRaw, HeatmapHourly, HeatmapDaily, HeatmapWeekly,
  // People Counting
  PeopleCountingRaw, PeopleCountingHourly, PeopleCountingDaily, PeopleCountingWeekly,
} from './models.js';

/* ---------- Interest‑By‑Zone Helper ---------- */
async function aggregateZoneCounts(startISO, endISO, ch) {
  return InterestByZoneRaw.aggregate([
    { $match: { ch, datetime:{ $gte:new Date(startISO), $lt:new Date(endISO) } } },
    { $group: { _id:'$zone_name', total:{ $sum:'$count' } } },
    { $project:{ _id:0, zone_name:'$_id', count:'$total' } },
  ]);
}

/* ---------- Heatmap Helper ---------- */
async function aggregateHeatmap(startISO, endISO, ch) {
  const docs = await HeatmapRaw.find({ ch, datetime:{ $gte:new Date(startISO), $lt:new Date(endISO) } },{ heatmap:1}).lean();
  if (!docs.length) return null;
  const len = docs[0].heatmap.length;
  const sum = Array(len).fill(0);
  for (const d of docs) {
    const arr = d.heatmap || [];
    if (arr.length!==len) continue;
    for(let i=0;i<len;i++) sum[i]+=arr[i];
  }
  return sum;
}

/* ---------- People Counting Helper ---------- */
async function aggregatePeople(startISO, endISO, ch) {
  return PeopleCountingRaw.aggregate([
    { $match:{ ch, datetime:{ $gte:new Date(startISO), $lt:new Date(endISO) } } },
    { $unwind:'$zones' },
    { $group:{
        _id:{ a_name:'$zones.a_name', b_name:'$zones.b_name' },
        a:{ $sum:'$zones.a' },
        b:{ $sum:'$zones.b' }
    }},
    { $project:{ _id:0, a_name:'$_id.a_name', b_name:'$_id.b_name', a:1, b:1 } }
  ]);
}

/* ---------- Cron Jobs (Asia/Taipei) ---------- */
const CH_LIST = [3,4,1]; // 再加 PeopleCounting CH1

function scheduleAggregation(cronExp, range) {
  cron.schedule(cronExp, async () => {
    const base = DateTime.now().setZone('Asia/Taipei').minus(range.offset);
    const start = base.startOf(range.unit);
    const end   = start.plus({ [range.unit+'s']:1 });

    for (const ch of CH_LIST) {
      /* IZ */
      const zones = await aggregateZoneCounts(start.toISO(), end.toISO(), ch);
      if (zones.length) {
        const Model = range.target.iz;
        await Model.updateOne({ [range.field]: start.toJSDate(), ch }, { $set:{ zones } }, { upsert:true });
      }
      /* Heatmap */
      const hm = await aggregateHeatmap(start.toISO(), end.toISO(), ch);
      if (hm) {
        const Model = range.target.hm;
        await Model.updateOne({ [range.field]: start.toJSDate(), ch }, { $set:{ heatmap: hm } }, { upsert:true });
      }
      /* People Counting */
      const pcs = await aggregatePeople(start.toISO(), end.toISO(), ch);
      if (pcs.length) {
        const Model = range.target.pc;
        await Model.updateOne({ [range.field]: start.toJSDate(), ch }, { $set:{ zones: pcs } }, { upsert:true });
      }
    }
  }, { timezone:'Asia/Taipei' });
}

scheduleAggregation('0 * * * *', { offset:{ hours:1 }, unit:'hour', field:'dateHour', target:{
  iz: InterestByZoneHourly,
  hm: HeatmapHourly,
  pc: PeopleCountingHourly,
}});

scheduleAggregation('0 0 * * *', { offset:{ days:1 }, unit:'day', field:'date', target:{
  iz: InterestByZoneDaily,
  hm: HeatmapDaily,
  pc: PeopleCountingDaily,
}});

scheduleAggregation('0 0 * * 1', { offset:{ weeks:1 }, unit:'week', field:'weekStart', target:{
  iz: InterestByZoneWeekly,
  hm: HeatmapWeekly,
  pc: PeopleCountingWeekly,
}});