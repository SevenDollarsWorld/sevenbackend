// report-upload-server/index.js

const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');

const app = express();
const PORT = 3000;

const cors = require('cors');
app.use(cors());


// 連線 MongoDB
const MONGO_URI = 'mongodb+srv://heyricky81:YcpBNR0t3bbGqpJ5@cluster0.fkxd9x2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function connectToMongoDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB 連線成功');
  } catch (error) {
    console.error('❌ MongoDB 連線失敗:', error);
    process.exit(1);
  }
}

connectToMongoDB();

// 定義資料模型
const ReportSchema = new mongoose.Schema({
  zone_name: String,
  datetime: String,
  count: Number
});
const Report = mongoose.model('Report', ReportSchema);



// 建立 uploads 資料夾（如果不存在）
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// 設定 multer 儲存位置與檔名
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${timestamp}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// ⬇️ 上傳 API：CSV 上傳後立即解析並寫入 MongoDB
app.post('/upload', upload.single('reports'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const rawData = await parseCsvFile(filePath);

    const filtered = rawData
      .filter(row => row.file_name?.includes('CH3InterestByZone'))
      .map(row => ({
        zone_name: row.zone_name,
        datetime: row.datetime,
        count: Number(row.count)
      }));

    let success = 0;
    for (const item of filtered) {
      const reportDoc = new Report({
        zone_name: item.zone_name,
        datetime: item.datetime,
        count: item.count
      });
      await reportDoc.save();
      success++;
    }

    res.json({ message: '✅ 上傳並儲存成功', inserted: success });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// 解析csv資料

function parseCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', data => results.push(data))
      .on('end', () => resolve(results))
      .on('error', err => reject(err));
  });
}

// 讀取資料 API（給前端）
app.get('/data', async (req, res) => {
  try {
    const allData = await Report.find();
    res.json(allData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 啟動 server
app.listen(3000, () => {
  console.log('🚀 Server is running on http://localhost:3000');
});



// data

/* app.get('/data', async (req, res) => {
  const folderPath = './uploads';
  const result = [];

  try {
    const files = fs.readdirSync(folderPath).filter(name =>
      name.includes('CH3InterestByZone') && name.endsWith('.csv')
    );

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const data = await parseCsvFile(filePath);
      for (const row of data) {
        if (row.ch !== '3') continue;

        const datetime = row.datetime;
        const zone_name = row.zone_name;
        const count = parseInt(row.count) || 0;

        result.push({ datetime, zone_name, count });
      }
    }

    // 根據 zone_name + datetime 合併加總
    const mergedMap = {};

    result.forEach(item => {
      const key = `${item.zone_name}___${item.datetime}`;
      if (!mergedMap[key]) {
        mergedMap[key] = {
          zone_name: item.zone_name,
          datetime: item.datetime,
          count: 0
        };
      }
      mergedMap[key].count += item.count;
    });

    const mergedResult = Object.values(mergedMap).sort((a, b) =>
      new Date(a.datetime) - new Date(b.datetime)
    );
    res.json(mergedResult);

  } catch (err) {
    console.error('❌ 錯誤:', err);
    res.status(500).json({ success: false, message: '處理失敗', error: err.message });
  }
});

*/

