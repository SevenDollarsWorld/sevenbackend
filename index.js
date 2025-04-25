import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import csv from 'csvtojson';
import fs from 'fs';
import { DateTime } from 'luxon';

import zoneRouter from './routes/zone.js';
import heatmapRouter from './routes/heatmap.js';
import peopleRouter from './routes/people.js';


console.log('heatmapRouter =', heatmapRouter);
console.log('zoneRouter =', zoneRouter);

import connectToMongoDB from './db.js';
import { InterestByZoneRaw, HeatmapRaw, PeopleCountingRaw } from './models.js';
import './scheduler.js';

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import mongoose from 'mongoose';
mongoose.set('debug', true);


const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

app.use(express.static(path.resolve(__dirname, 'front')));



// ─── 解析檔名 ─────────────────────────────────────────────────────────
function parseFilename(filename) {
  // 範例：CH3HeatmapData... 或 CH4InterestByZone...
  const m = filename.match(/CH(\d+)(InterestByZone|HeatmapData|PeopleCounting)/i);
  return m ? { ch: Number(m[1]), type: m[2] } : null;
}



// ─── 上傳 API ─────────────────────────────────────────────────────────
app.post('/upload', upload.single('reports'), async (req, res) => {
  const now = new Date().toISOString();

  if (!req.file) {
    console.warn(`[${now}] ⚠️  Upload WITHOUT file.`);
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log(`[${now}] 📂 File received → ${req.file.originalname} (${req.file.size} bytes)`);

  const meta = parseFilename(req.file.originalname);
  if (!meta) {
    console.warn(`[${now}] ❌ Invalid filename, delete.`);
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    const rows = await csv({ trim: true }).fromFile(req.file.path);
    let docs = [];

    /* ── InterestByZone ─────────────────────────────── */
    if (meta.type === 'InterestByZone') {
      docs = rows.map(r => ({
        timestamp: Number(r.timestamp),
        datetime : DateTime.fromFormat(r.datetime, 'MM/dd/yyyy HH:mm:ss',
                                       { zone:'Asia/Taipei' }).toJSDate(),
        ch       : meta.ch,
        zone_name: r.zone_name,
        count    : Number(r.count),
      }));
      await InterestByZoneRaw.insertMany(docs);
      console.log(`[IZ] insert ${docs.length} docs (CH${meta.ch})`);

    /* ── HeatmapData ───────────────────────────────── */
    } else if (meta.type === 'HeatmapData') {
      docs = rows.map(r => ({
        timestamp: Number(r.timestamp),
        datetime : DateTime.fromFormat(r.datetime, 'MM/dd/yyyy HH:mm:ss',
                                       { zone:'Asia/Taipei' }).toJSDate(),
        ch       : meta.ch,
        heatmap  : JSON.parse(r.heatmap_64x36),
      }));
      await HeatmapRaw.insertMany(docs);
      console.log(`[Heatmap] insert ${docs.length} docs (CH${meta.ch})`);

    /* ── PeopleCounting ───────────────────────────── */
    } else if (meta.type === 'PeopleCounting') {
      docs = rows.map(r => {
        const zones = JSON.parse(r['Count by Zone']).map(z => ({
          a_name: z.a_name,
          b_name: z.b_name,
          a     : Number(z.a),
          b     : Number(z.b),
        }));
        return {
          timestamp  : Number(r.timestamp ?? r.TimeUnix ?? 0),
          datetime   : DateTime.fromFormat(r.Time, 'MM/dd/yyyy HH:mm:ss',
                                           { zone:'Asia/Taipei' }).toJSDate(),
          ch         : meta.ch,
          count      : Number(r.Count),
          cumulative : Number(r['Cumulative Count']),
          zones,
        };
      });
      await PeopleCountingRaw.insertMany(docs);
      console.log(`[PeopleCounting] insert ${docs.length} docs (CH${meta.ch})`);
    }

    fs.unlinkSync(req.file.path);          // 刪掉暫存檔
    res.json({ success:true, inserted:docs.length, type:meta.type });

  } catch (err) {
    console.error(`[${new Date().toISOString()}] 🛑 Mongo insert FAILED:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.use('/api', zoneRouter);
app.use('/api', heatmapRouter);
app.use('/api', peopleRouter);

if (app._router) {
  console.log('--- ROUTES ---');
  app._router.stack
    .filter(r => r.route)
    .forEach(r => console.log(r.route.path));
}


// ─── 啟動 ─────────────────────────────────────────────────────────────
connectToMongoDB().then(() => {
  app.listen(PORT, () => console.log('🚀 API running at http://localhost:' + PORT));
  console.log('Mongo DB =', mongoose.connection.name);
});