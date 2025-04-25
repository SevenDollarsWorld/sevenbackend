import express from 'express';
import { PeopleCountingRaw } from '../models.js';

const router = express.Router();

router.get('/people', async (req, res) => {
  const { start, end, ch } = req.query;
  if (!start || !end || !ch) return res.status(400).send('missing params');

  const rows = await PeopleCountingRaw.find({
    ch,
    datetime: { $gte: new Date(start), $lte: new Date(end) },
  }).lean();

  res.json({ rows });
});

export default router;