import express from 'express';
import {
  InterestByZoneHourly,
  InterestByZoneRaw,
  HeatmapHourly,
  HeatmapRaw,
  PeopleCountingHourly,
  PeopleCountingRaw,
} from '../models.js';
import { DateTime } from 'luxon';

const router = express.Router();

// util: pick model based on dataset & gran
function pickModel(dataset, gran) {
  const map = {
    zone: { raw: InterestByZoneRaw, hourly: InterestByZoneHourly },
    heatmap: { raw: HeatmapRaw, hourly: HeatmapHourly },
    people: { raw: PeopleCountingRaw, hourly: PeopleCountingHourly },
  };
  return map[dataset]?.[gran];
}

router.get('/compare', async (req, res) => {
  const {
    dataset = 'zone',  // zone / heatmap / people
    startDate,         // yyyy-mm-dd
    endDate,
    from,              // HH:mm (local, Asia/Taipei)
    to,                // HH:mm
    ch = 3,
    gran = 'hourly',   // raw or hourly (5-min raw too大, 建議 hourly)
  } = req.query;

  if (!startDate || !endDate || !from || !to) {
    return res.status(400).send('missing params');
  }

  const Model = pickModel(dataset, gran);
  if (!Model) return res.status(400).send('invalid dataset/gran');

  const tz = 'Asia/Taipei';
  const dtStart = DateTime.fromISO(startDate, { zone: tz }).startOf('day');
  const dtEnd   = DateTime.fromISO(endDate,   { zone: tz }).endOf('day');

  // ISO for Mongo match (UTC)
  const matchStart = dtStart.toJSDate();
  const matchEnd   = dtEnd.toJSDate();

  // parse from/to hours
  const [fHour] = from.split(':').map(Number);
  const [tHour] = to.split(':').map(Number); // exclusive upper bound

  // pipeline differs raw/hourly
  const timeField = gran === 'raw' ? 'datetime' : 'dateHour';

  const pipe = [
    { $match: { ch: Number(ch), [timeField]: { $gte: matchStart, $lte: matchEnd } } },
    { $addFields: {
        taipeiHour: {
          $hour: { date: `$${timeField}`, timezone: tz }
        },
        dateStr: {
          $dateToString: { format: '%Y-%m-%d', date: `$${timeField}`, timezone: tz }
        }
    }},
    { $match: { taipeiHour: { $gte: fHour, $lt: tHour } } },
    { $project: { _id: 0, taipeiHour: 0 } },
    { $sort: { [timeField]: 1 } },
  ];

  const rows = await Model.aggregate(pipe);
  res.json({ rows, dataset, gran, from, to, ch });
});

export default router;
