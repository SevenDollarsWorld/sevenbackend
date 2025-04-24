import express from 'express';
import {
  HeatmapRaw,
  HeatmapHourly,
  HeatmapDaily,
  HeatmapWeekly,
} from '../models.js';

const router = express.Router();
// GET /api/heatmap?start=ISO&end=ISO&ch=3&gran=auto
router.get('/heatmap', async (req, res) => {
  const { start, end, ch, gran = 'auto' } = req.query;
  if (!start || !end || !ch) return res.status(400).send('missing params');

  const s = new Date(start);
  const e = new Date(end);
  const diffH = (e - s) / 36e5; // 區間長度（小時）

  // 1. 決定要用哪張 collection
  let col;
  if (gran !== 'auto') col = gran;          // raw / hour / day / week
  else if (diffH <= 48)       col = 'hourly';
  else if (diffH <= 24 * 180) col = 'daily';
  else                        col = 'weekly';

  const Model = {
    raw   : HeatmapRaw,
    hourly: HeatmapHourly,
    daily : HeatmapDaily,
    weekly: HeatmapWeekly,
  }[col];

  // 2. 組查詢條件
  const match =
    col === 'raw'
      ? { ch, datetime: { $gte: s, $lte: e } }
      : col === 'hourly'
        ? { ch, dateHour: { $gte: s, $lte: e } }
        : col === 'daily'
          ? { ch, date: { $gte: s, $lte: e } }
          : { ch, weekStart: { $gte: s, $lte: e } };

  try {
    const docs = await Model.find(match).lean();
    res.json({ gran: col, rows: docs });
  } catch (err) {
    console.error(err);
    res.status(500).send('database error');
  }
});

export default router;