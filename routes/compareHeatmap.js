// routes/compareHeatmap.js
import express from 'express';
import { DateTime } from 'luxon';
import {
  HeatmapHourly,
  HeatmapRaw,
} from '../models.js';

const router = express.Router();

// GET /api/compare_hm?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&from=HH:mm&to=HH:mm&ch=3
router.get('/compare_hm', async (req, res) => {
  const { startDate, endDate, from, to, ch = 3 } = req.query;
  if (!startDate || !endDate || !from || !to)
    return res.status(400).send('missing params');

  const tz = 'Asia/Taipei';
  const dayS = DateTime.fromISO(startDate, { zone: tz }).startOf('day');
  const dayE = DateTime.fromISO(endDate,   { zone: tz }).endOf('day');
  const [hFrom] = from.split(':').map(Number);
  const [hTo]   = to.split(':').map(Number);   // upper bound (exclusive)

  if (hTo <= hFrom)
    return res.status(400).send('`to` must be later than `from`');

  /* ─── ★ 這裡插入判斷 ★ ───────────────────────────── */
  if (DateTime.fromISO(`1970-01-01T${to}`) <=
      DateTime.fromISO(`1970-01-01T${from}`)) {
    return res.status(400).send('`to` must be later than `from`');
  }
  /* ──────────────────────────────────────────────── 
  /* ---- 共用部分：依 localHour 過濾 + 產生日字串 --------------------- */
  function basePipe(timeField){
    return [
      { $match:{ ch:Number(ch), [timeField]:{ $gte:dayS.toJSDate(), $lte:dayE.toJSDate() } } },
      { $addFields:{
          localH:{ $hour:{ date:`$${timeField}`, timezone:tz } },
          dateStr:{ $dateToString:{ date:`$${timeField}`, format:'%Y-%m-%d', timezone:tz } }
      }},
      { $match:{ localH:{ $gte:hFrom, $lt:hTo } } },
    ];
  }

  /* ---------- 1) 先查 hourly -------------------------------------- */
  const rowsHourly = await HeatmapHourly.aggregate([
    ...basePipe('dateHour'),
    { $project:{ _id:0, date:'$dateStr', heatmap:1 } },
    { $sort:{ date:1 } },
  ]);

  if (rowsHourly.length){
    return res.json({ rows: rowsHourly, source:'hourly' });
  }

  /* ---------- 2) fallback 查 raw ---------------------------------- */
  const rowsRaw = await HeatmapRaw.aggregate([
    ...basePipe('datetime'),
    { $group:{
        _id:'$dateStr',
        heatmap:{ $avg:'$heatmap' }         // 5-min → 每格平均
    }},
    { $project:{ _id:0, date:'$_id', heatmap:1 } },
    { $sort:{ date:1 } },
  ]);

  res.json({ rows: rowsRaw, source:'raw' });
});

export default router;
