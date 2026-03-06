const DB_NAME = 'strava-pwa', DB_VERSION = 1
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('activities')) {
        const s = db.createObjectStore('activities', { keyPath: 'id' })
        s.createIndex('start_date', 'start_date')
        s.createIndex('type', 'type')
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function tx(db, store, mode = 'readonly') { return db.transaction(store, mode).objectStore(store) }
function p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) }) }
export async function saveActivities(acts) {
  const db = await openDB()
  const store = tx(db, 'activities', 'readwrite')
  await Promise.all(acts.map(a => p(store.put(a))))
  db.close()
}
export async function getAllActivities() {
  const db = await openDB()
  const result = await p(tx(db, 'activities').getAll())
  db.close()
  return result.sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
}
export async function countActivities() {
  const db = await openDB()
  const c = await p(tx(db, 'activities').count())
  db.close(); return c
}
export async function setMeta(key, value) {
  const db = await openDB()
  await p(tx(db, 'meta', 'readwrite').put({ key, value }))
  db.close()
}
export async function getMeta(key) {
  const db = await openDB()
  const r = await p(tx(db, 'meta').get(key))
  db.close(); return r?.value ?? null
}
export function buildYearSummary(activities) {
  const map = {}
  for (const a of activities) {
    const y = new Date(a.start_date).getFullYear()
    if (!map[y]) map[y] = []
    map[y].push(a)
  }
  return Object.entries(map).map(([year, acts]) => {
    const t = {}
    for (const a of acts) { const k = a.type||a.sport_type||'Other'; t[k]=(t[k]||0)+1 }
    return { year, total: acts.length, runs: t.Run||0, rides: t.Ride||0, walks: t.Walk||0, other: acts.length-(t.Run||0)-(t.Ride||0)-(t.Walk||0) }
  }).sort((a,b)=>a.year-b.year)
}
export function buildRunStats(activities) {
  const runs = activities.filter(a => (a.type||a.sport_type)==='Run' && a.distance > 500)
    .sort((a,b) => new Date(b.start_date)-new Date(a.start_date))
  const byDist = {'<2k':0,'2-5k':0,'5-9k':0,'9-11k':0,'>11k':0}
  for (const r of runs) {
    const d = r.distance/1000
    if(d<2) byDist['<2k']++; else if(d<5) byDist['2-5k']++; else if(d<9) byDist['5-9k']++; else if(d<=11) byDist['9-11k']++; else byDist['>11k']++
  }
  const best10k = runs.filter(r=>r.distance>=9000&&r.distance<=11000&&r.moving_time>0).sort((a,b)=>a.moving_time-b.moving_time)[0]
  const longestRun = [...runs].sort((a,b)=>b.distance-a.distance)[0]
  const fastestPace = runs.filter(r=>r.distance>=3000&&r.average_speed>0).sort((a,b)=>(b.average_speed-a.average_speed))[0]
  return { runs, byDist, best10k, longestRun, fastestPace }
}
export function buildPaceTrend(activities) {
  return activities.filter(a=>(a.type||a.sport_type)==='Run'&&a.distance>=3000&&a.average_speed>0)
    .sort((a,b)=>new Date(a.start_date)-new Date(b.start_date))
    .map(a=>({ date: new Date(a.start_date).toLocaleDateString('en-GB',{month:'short',year:'2-digit'}), pace: parseFloat((1000/a.average_speed/60).toFixed(2)), dist: parseFloat((a.distance/1000).toFixed(1)), name: a.name }))
}
