import express from 'express';
import {
  InterestByZoneRaw,
  InterestByZoneHourly,
  InterestByZoneDaily,
  InterestByZoneWeekly,
} from '../models.js';

const router = express.Router();

router.get('/zone', async (req, res) => {
  const { start, end, ch, gran = 'auto' } = req.query;
  if (!start || !end || !ch) return res.status(400).send('missing params');

  const s = new Date(start);
  const e = new Date(end);
  const diffH = (e - s) / 36e5;          // 區間長度（小時）

  // ─── 選擇資料表 (collection) ─────────────────────
  let col;
  if (gran !== 'auto') col = gran;       // raw / hour / day / week
  else if (diffH <= 48)       col = 'hourly';
  else if (diffH <= 24 * 180) col = 'daily';
  else                        col = 'weekly';

  const Model = {
    raw   : InterestByZoneRaw,
    hourly: InterestByZoneHourly,
    daily : InterestByZoneDaily,
    weekly: InterestByZoneWeekly,
  }[col];

  // ─── 建查詢條件 ─────────────────────────────────
  const match =
    col === 'raw'
      ? { ch, datetime: { $gte: s, $lte: e } }
      : col === 'hourly'
        ? { ch, dateHour: { $gte: s, $lte: e } }
        : col === 'daily'
          ? { ch, date: { $gte: s, $lte: e } }
          : { ch, weekStart: { $gte: s, $lte: e } };

  const docs = await Model.find(match).lean();
  res.json({ gran: col, rows: docs });
});

export default router;
