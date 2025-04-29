// routes/snapshot.js
import express from 'express';
import axios   from 'axios';
import https   from 'https';
import sharp   from 'sharp';

const router = express.Router();
const agent  = new https.Agent({ rejectUnauthorized:false });

const USER = process.env.DEV_USER;
const PASS = process.env.DEV_PASS;

router.get('/snapshot', async (req, res) => {
  const { ch = 1 } = req.query;                       // 只要 ch
  const url = `https://192.168.201.250:8443/api/snapshot/jpeg/?ch=${ch}`;

  try {
    const { data } = await axios.get(url, {
      responseType: 'arraybuffer',
      httpsAgent  : agent,
      auth        : { username: USER, password: PASS }
    });

    // ← 若不想轉 PNG，直接 set jpeg & send(data)
    const png = await sharp(data).png().toBuffer();
    res.set('Content-Type','image/png').send(png);
  } catch (err) {
    console.error('snapshot', err.message);
    res.status(502).send('snapshot failed');
  }
});

export default router;
