import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import csv from 'csvtojson';
import fs from 'fs';

import connectToMongoDB from './db.js';
import { InterestByZoneRaw, HeatmapRaw } from './models.js';
import './scheduler.js';

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

// ─── 解析檔名 ─────────────────────────────────────────────────────────
function parseFilename(filename) {
  // 範例：CH3HeatmapData... 或 CH4InterestByZone...
  const m = filename.match(/CH(\d+)(InterestByZone|HeatmapData)/i);
  return m ? { ch: Number(m[1]), type: m[2] } : null;
}


// ─── 上傳 API ─────────────────────────────────────────────────────────
app.post('/upload', upload.single('reports'), async (req, res) => {
  const now = new Date().toISOString();

  if (!req.file) {
    console.warn('[' + now + '] ⚠️  Upload WITHOUT file.');
    return res.status(400).json({ error: 'No file uploaded' });
  }
  console.log('[' + now + '] 📂 File received → ' + req.file.originalname + ' (' + req.file.size + ' bytes)');

  const meta = parseFilename(req.file.originalname);
  if (!meta) {
    console.warn('[' + now + '] ❌ Invalid filename, delete.');
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ error: 'Invalid filename' });
  }

  try {
    const rows = await csv({ trim: true }).fromFile(req.file.path);
    let docs = [];

    if (meta.type === 'InterestByZone') {
      docs = rows.map(r => ({
        timestamp: Number(r.timestamp),
        datetime : new Date(r.datetime),
        ch       : meta.ch,
        zone_name: r.zone_name,
        count    : Number(r.count),
      }));
      await InterestByZoneRaw.insertMany(docs);
      console.log('[' + new Date().toISOString() + '] ✅ IZ insert → ' + docs.length + ' docs (CH' + meta.ch + ')');
    } else {
      // HeatmapData
      docs = rows.map(r => ({
        timestamp: Number(r.timestamp),
        datetime : new Date(r.datetime),
        ch       : meta.ch,
        heatmap  : JSON.parse(r.heatmap_64x36),
      }));
      await HeatmapRaw.insertMany(docs);
      console.log('[' + new Date().toISOString() + '] ✅ Heatmap insert → ' + docs.length + ' docs (CH' + meta.ch + ')');
    }

    fs.unlinkSync(req.file.path);
    res.json({ success: true, inserted: docs.length, type: meta.type });
  } catch (err) {
    console.error('[' + new Date().toISOString() + '] 🛑 Mongo insert FAILED:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 啟動 ─────────────────────────────────────────────────────────────
connectToMongoDB().then(() => {
  app.listen(PORT, () => console.log('🚀 API running at http://localhost:' + PORT));
});