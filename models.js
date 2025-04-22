import mongoose from 'mongoose';

// ─── 5‑分鐘原始資料 ────────────────────────────────────────────────
const izRawSchema = new mongoose.Schema({
  timestamp: Number,
  datetime : Date,
  ch       : Number,
  zone_name: String,
  count    : Number,
});

const heatmapRawSchema = new mongoose.Schema({
  timestamp: Number,
  datetime : Date,
  ch       : Number,
  heatmap  : [Number],          // 64×36 = 2304 elements
});

// ─── Interest‑By‑Zone 聚合 (hour/day/week) ─────────────────────────
const izHourlySchema = new mongoose.Schema({
  dateHour: Date,
  ch      : Number,
  zones   : [{ zone_name: String, count: Number }],
});

const izDailySchema = new mongoose.Schema({
  date : Date,
  ch   : Number,
  zones: [{ zone_name: String, count: Number }],
});

const izWeeklySchema = new mongoose.Schema({
  weekStart: Date,
  ch       : Number,
  zones    : [{ zone_name: String, count: Number }],
});

// ─── Heatmap 聚合 (hour/day/week) ──────────────────────────────────
const heatmapHourlySchema = new mongoose.Schema({
  dateHour: Date,
  ch      : Number,
  heatmap : [Number],
});

const heatmapDailySchema = new mongoose.Schema({
  date   : Date,
  ch     : Number,
  heatmap: [Number],
});

const heatmapWeeklySchema = new mongoose.Schema({
  weekStart: Date,
  ch       : Number,
  heatmap  : [Number],
});

// ─── Model Exports ────────────────────────────────────────────────
export const InterestByZoneRaw     = mongoose.models.InterestByZoneRaw     || mongoose.model('InterestByZoneRaw',     izRawSchema,          'interest_by_zone_raw');
export const HeatmapRaw           = mongoose.models.HeatmapRaw           || mongoose.model('HeatmapRaw',           heatmapRawSchema,     'heatmap_raw');

export const InterestByZoneHourly  = mongoose.models.InterestByZoneHourly  || mongoose.model('InterestByZoneHourly',  izHourlySchema,       'interest_by_zone_hourly');
export const InterestByZoneDaily   = mongoose.models.InterestByZoneDaily   || mongoose.model('InterestByZoneDaily',   izDailySchema,        'interest_by_zone_daily');
export const InterestByZoneWeekly  = mongoose.models.InterestByZoneWeekly  || mongoose.model('InterestByZoneWeekly',  izWeeklySchema,       'interest_by_zone_weekly');

export const HeatmapHourly         = mongoose.models.HeatmapHourly         || mongoose.model('HeatmapHourly',         heatmapHourlySchema,  'heatmap_hourly');
export const HeatmapDaily          = mongoose.models.HeatmapDaily          || mongoose.model('HeatmapDaily',          heatmapDailySchema,   'heatmap_daily');
export const HeatmapWeekly         = mongoose.models.HeatmapWeekly         || mongoose.model('HeatmapWeekly',         heatmapWeeklySchema,  'heatmap_weekly');
