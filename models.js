import mongoose from 'mongoose';

// ─────────────────────────────── RAW Tables ───────────────────────────────
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
  heatmap  : [Number],   // 64 × 36
});

// People Counting (a / b counts per zone)
const pcRawSchema = new mongoose.Schema({
  timestamp  : Number,
  datetime   : Date,
  ch         : Number,
  count      : Number,
  cumulative : Number,
  zones      : [{ a_name:String, b_name:String, a:Number, b:Number }],
});

// ─────────────────────────────── Hourly / Daily / Weekly ──────────────────
const zoneAgg = new mongoose.Schema({ zone_name:String, count:Number });
const pcZoneAgg = new mongoose.Schema({ a_name:String, b_name:String, a:Number, b:Number });

function aggSchema(timeField, zoneSchema) {
  return new mongoose.Schema({
    [timeField]: Date,
    ch         : Number,
    zones      : [zoneSchema],
  });
}


const izHourlySchema = aggSchema('dateHour', zoneAgg);
const izDailySchema  = aggSchema('date',     zoneAgg);
const izWeeklySchema = aggSchema('weekStart',zoneAgg);

const heatmapHourlySchema = aggSchema('dateHour', new mongoose.Schema({ heatmap:[Number] },{_id:false}));
const heatmapDailySchema  = aggSchema('date',     new mongoose.Schema({ heatmap:[Number] },{_id:false}));
const heatmapWeeklySchema = aggSchema('weekStart',new mongoose.Schema({ heatmap:[Number] },{_id:false}));

const pcHourlySchema = aggSchema('dateHour', pcZoneAgg);
const pcDailySchema  = aggSchema('date',     pcZoneAgg);
const pcWeeklySchema = aggSchema('weekStart',pcZoneAgg);

// ─── Model Exports ────────────────────────────────────────────────
export const InterestByZoneRaw     = mongoose.models.InterestByZoneRaw     || mongoose.model('InterestByZoneRaw',     izRawSchema,          'interest_by_zone_raw');
export const HeatmapRaw           = mongoose.models.HeatmapRaw           || mongoose.model('HeatmapRaw',           heatmapRawSchema,     'heatmap_raw');
export const PeopleCountingRaw = mongoose.models.PeopleCountingRaw
  || mongoose.model('PeopleCountingRaw', pcRawSchema, 'people_counting_raw');

export const InterestByZoneHourly  = mongoose.models.InterestByZoneHourly  || mongoose.model('InterestByZoneHourly',  izHourlySchema,       'interest_by_zone_hourly');
export const InterestByZoneDaily   = mongoose.models.InterestByZoneDaily   || mongoose.model('InterestByZoneDaily',   izDailySchema,        'interest_by_zone_daily');
export const InterestByZoneWeekly  = mongoose.models.InterestByZoneWeekly  || mongoose.model('InterestByZoneWeekly',  izWeeklySchema,       'interest_by_zone_weekly');

export const HeatmapHourly         = mongoose.models.HeatmapHourly         || mongoose.model('HeatmapHourly',         heatmapHourlySchema,  'heatmap_hourly');
export const HeatmapDaily          = mongoose.models.HeatmapDaily          || mongoose.model('HeatmapDaily',          heatmapDailySchema,   'heatmap_daily');
export const HeatmapWeekly         = mongoose.models.HeatmapWeekly         || mongoose.model('HeatmapWeekly',         heatmapWeeklySchema,  'heatmap_weekly');

export const PeopleCountingHourly = mongoose.models.PeopleCountingHourly || mongoose.model('PeopleCountingHourly', pcHourlySchema,   'people_counting_hourly');
export const PeopleCountingDaily  = mongoose.models.PeopleCountingDaily  || mongoose.model('PeopleCountingDaily',  pcDailySchema,    'people_counting_daily');
export const PeopleCountingWeekly = mongoose.models.PeopleCountingWeekly || mongoose.model('PeopleCountingWeekly', pcWeeklySchema,   'people_counting_weekly');
