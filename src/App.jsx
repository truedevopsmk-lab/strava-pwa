import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { initiateAuth, exchangeCode, getTokens, clearTokens, fetchAthlete, fetchAllActivities, getValidToken, saveTokens } from './strava'
import { saveActivities, getAllActivities, setMeta, getMeta, countActivities, buildYearSummary, buildRunStats, buildPaceTrend } from './db'

const fontLink = document.createElement('link')
fontLink.href = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&display=swap'
fontLink.rel = 'stylesheet'; document.head.appendChild(fontLink)

const C = { o:'#f97316', b:'#3b82f6', g:'#22c55e', p:'#a855f7', y:'#eab308', c:'#06b6d4', dim:'#64748b', muted:'#94a3b8', surf:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.07)' }
const fmtTime = s => { if(!s) return '—'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; return h>0?`${h}h ${String(m).padStart(2,'0')}m`:`${m}m ${String(sec).padStart(2,'0')}s` }
const fmtPace = sp => { if(!sp) return '—'; const p=1000/sp; return `${Math.floor(p/60)}:${String(Math.round(p%60)).padStart(2,'0')}/km` }
const fmtKm = m => m?(m/1000).toFixed(1)+' km':'—'

const Card = ({children,style={},glow}) => <div style={{background:C.surf,border:`1px solid ${glow?glow+'30':C.border}`,borderRadius:16,padding:24,...style}}>{children}</div>
const Stat = ({icon,label,value,sub,color}) => (
  <Card style={{position:'relative',overflow:'hidden'}}>
    <div style={{position:'absolute',top:-8,right:-8,fontSize:54,opacity:0.05}}>{icon}</div>
    <div style={{fontSize:24,marginBottom:4}}>{icon}</div>
    <div style={{color:C.dim,fontSize:10,letterSpacing:2,textTransform:'uppercase',marginBottom:3}}>{label}</div>
    <div style={{color:color||'#f8fafc',fontSize:26,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:1}}>{value}</div>
    {sub&&<div style={{color:C.dim,fontSize:11,marginTop:2}}>{sub}</div>}
  </Card>)
const Tip = ({children,color=C.g}) => <div style={{marginTop:12,padding:'10px 14px',background:color+'12',borderRadius:8,border:`1px solid ${color}25`,fontSize:12,color:color+'cc'}}>{children}</div>
const TT = ({active,payload,label}) => {
  if(!active||!payload?.length) return null
  return <div style={{background:'#0f172a',border:`1px solid ${C.o}40`,borderRadius:10,padding:'10px 14px'}}><div style={{color:C.dim,fontSize:10,marginBottom:4}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color||C.o,fontSize:12}}>{p.name}: <b>{p.value}</b></div>)}</div>
}
const SH = ({title,sub}) => <div style={{marginBottom:18}}><h2 style={{margin:0,fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,color:'#f8fafc'}}>{title}</h2>{sub&&<p style={{margin:'3px 0 0',color:C.dim,fontSize:12}}>{sub}</p>}</div>

function SyncBar({status,count,onSync,onReset}) {
  return <div style={{display:'flex',alignItems:'center',gap:12,padding:'8px 16px',background:'rgba(249,115,22,0.06)',borderRadius:10,border:`1px solid ${C.o}20`,fontSize:12,flexWrap:'wrap'}}>
    <span style={{color:C.dim}}>📦 {count} activities cached</span>
    {status==='syncing'&&<span style={{color:C.o}}>⟳ Syncing…</span>}
    {status==='done'&&<span style={{color:C.g}}>✓ Up to date</span>}
    {status==='error'&&<span style={{color:'#f87171'}}>⚠ Sync error</span>}
    <div style={{marginLeft:'auto',display:'flex',gap:8}}>
      <button onClick={onSync} disabled={status==='syncing'} style={{background:C.o+'20',border:`1px solid ${C.o}50`,color:C.o,borderRadius:6,padding:'4px 12px',cursor:'pointer',fontSize:11}}>
        {status==='syncing'?'Syncing…':'↻ Sync New'}
      </button>
      <button onClick={onReset} style={{background:'rgba(248,113,113,0.1)',border:'1px solid rgba(248,113,113,0.3)',color:'#f87171',borderRadius:6,padding:'4px 12px',cursor:'pointer',fontSize:11}}>✕ Sign Out</button>
    </div>
  </div>
}

function Loading({count}) {
  return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'70vh',gap:16}}>
    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:32,letterSpacing:4,color:C.o}}>FETCHING YOUR DATA</div>
    <div style={{width:240,height:3,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden'}}>
      <div style={{height:'100%',width:`${Math.min(98,(count/700)*100)}%`,background:C.o,transition:'width 0.4s ease',borderRadius:2}}/>
    </div>
    <div style={{color:C.dim,fontSize:12}}>{count} activities fetched…</div>
    <div style={{color:'#334155',fontSize:11}}>This only happens once — we'll cache everything locally.</div>
  </div>
}

function Login() {
  return <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'90vh',gap:28,textAlign:'center',padding:24}}>
    <div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:52,letterSpacing:6,color:C.o,lineHeight:1}}>STRAVA</div>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:4,color:'#f8fafc'}}>PERSONAL DASHBOARD</div>
      <div style={{color:C.dim,fontSize:11,marginTop:8,letterSpacing:1}}>LIVE DATA · OFFLINE PWA · INDEXED CACHE</div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,maxWidth:480}}>
      {[['📊','Live Charts','Recharts powered'],['📴','Works Offline','IndexedDB cache'],['🔄','Incremental Sync','Only fetches new']].map(([e,l,s])=>(
        <div key={l} style={{background:C.surf,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
          <div style={{fontSize:22,marginBottom:6}}>{e}</div>
          <div style={{fontSize:12,color:'#e2e8f0',marginBottom:3}}>{l}</div>
          <div style={{fontSize:10,color:C.dim}}>{s}</div>
        </div>))}
    </div>
    <button onClick={initiateAuth} style={{background:'linear-gradient(135deg,#f97316,#ea580c)',border:'none',borderRadius:12,padding:'14px 36px',color:'#fff',fontSize:14,fontFamily:"'Space Mono',monospace",cursor:'pointer',letterSpacing:1,boxShadow:'0 8px 32px rgba(249,115,22,0.35)'}}>
      🔗 CONNECT WITH STRAVA
    </button>
    <div style={{color:C.dim,fontSize:11,maxWidth:360,lineHeight:1.6}}>Your data is stored entirely in your browser. No servers, no tracking.</div>
  </div>
}

const TABS = ['Overview','Running','Best Runs','Insights']

export default function App() {
  const [stage,setStage] = useState('checking')
  const [tab,setTab] = useState('Overview')
  const [tabAnim,setTabAnim] = useState(true)
  const [activities,setActivities] = useState([])
  const [athlete,setAthlete] = useState(null)
  const [syncStatus,setSyncStatus] = useState('idle')
  const [fetchCount,setFetchCount] = useState(0)
  const [cachedCount,setCachedCount] = useState(0)
  const [yearData,setYearData] = useState([])
  const [runStats,setRunStats] = useState(null)
  const [paceTrend,setPaceTrend] = useState([])
  const [runKmByYear,setRunKmByYear] = useState([])
  const [activityMix,setActivityMix] = useState([])

  const computeAnalytics = useCallback((acts) => {
    setYearData(buildYearSummary(acts))
    setRunStats(buildRunStats(acts))
    setPaceTrend(buildPaceTrend(acts))
    const byYear={}
    acts.filter(a=>(a.type||a.sport_type)==='Run').forEach(a=>{ const y=new Date(a.start_date).getFullYear(); byYear[y]=(byYear[y]||0)+a.distance })
    setRunKmByYear(Object.entries(byYear).map(([year,m])=>({year:String(year),km:+(m/1000).toFixed(1)})).sort((a,b)=>a.year-b.year))
    const mix={};acts.forEach(a=>{const t=a.type||a.sport_type||'Other';mix[t]=(mix[t]||0)+1})
    const cols={Run:C.o,Ride:C.b,Walk:C.g,Swim:C.c,Hike:'#84cc16'}
    setActivityMix(Object.entries(mix).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value,color:cols[name]||C.p})))
  },[])

  useEffect(()=>{
    async function init() {
      const params=new URLSearchParams(window.location.search)
      const code=params.get('code')
      if(code) {
        window.history.replaceState({},'',window.location.pathname)
        try { await exchangeCode(code) } catch(e) { console.error('Token exchange:',e) }
      }
      const tokens=getTokens()
      if(!tokens){setStage('login');return}
      setAthlete(tokens.athlete)
      const cached=await getAllActivities()
      const count=await countActivities()
      setCachedCount(count)
      if(cached.length>0){
        setActivities(cached);computeAnalytics(cached);setStage('ready')
        syncIncremental(false)
      } else {
        setStage('loading');await fullSync()
      }
    }
    init()
  },[])

  async function fullSync() {
    setSyncStatus('syncing')
    try {
      const token=await getValidToken()
      if(!token){setStage('login');return}
      const ath=await fetchAthlete()
      setAthlete(ath)
      const t=getTokens();if(t) saveTokens({...t,athlete:ath})
      const all=await fetchAllActivities(n=>setFetchCount(n))
      await saveActivities(all)
      await setMeta('last_sync',Math.floor(Date.now()/1000))
      setActivities(all);computeAnalytics(all);setCachedCount(all.length)
      setSyncStatus('done');setStage('ready')
    } catch(e){console.error(e);setSyncStatus('error');setStage('ready')}
  }

  async function syncIncremental(show=true) {
    if(show) setSyncStatus('syncing')
    try {
      const lastSync=await getMeta('last_sync')||0
      const newActs=await fetchAllActivities(null,lastSync-3600)
      if(newActs.length>0){
        await saveActivities(newActs)
        await setMeta('last_sync',Math.floor(Date.now()/1000))
        const all=await getAllActivities()
        setActivities(all);computeAnalytics(all);setCachedCount(all.length)
      }
      if(show) setSyncStatus('done')
    } catch(e){if(show) setSyncStatus('error')}
  }

  function switchTab(t){setTabAnim(false);setTimeout(()=>{setTab(t);setTabAnim(true)},120)}

  if(stage==='checking') return null
  if(stage==='login') return <Login/>
  if(stage==='loading') return <div style={{minHeight:'100vh',background:'#060b14',color:'#f8fafc',fontFamily:"'Space Mono',monospace"}}><Loading count={fetchCount}/></div>

  const totalRunKm=activities.filter(a=>(a.type||a.sport_type)==='Run').reduce((s,a)=>s+a.distance,0)
  const totalRideKm=activities.filter(a=>(a.type||a.sport_type)==='Ride').reduce((s,a)=>s+a.distance,0)
  const totalRunTime=activities.filter(a=>(a.type||a.sport_type)==='Run').reduce((s,a)=>s+a.moving_time,0)
  const swimCount=activities.filter(a=>(a.type||a.sport_type)==='Swim').length

  return (
    <div style={{minHeight:'100vh',background:'#060b14',color:'#f8fafc',fontFamily:"'Space Mono',monospace",backgroundImage:'radial-gradient(ellipse at 20% 0%,rgba(249,115,22,0.08) 0%,transparent 60%),radial-gradient(ellipse at 80% 100%,rgba(59,130,246,0.06) 0%,transparent 60%)'}}>
      {/* HEADER */}
      <div style={{borderBottom:`1px solid ${C.border}`,padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(6,11,20,0.92)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:100,flexWrap:'wrap',gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 0'}}>
          <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,#f97316,#ea580c)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>🏃</div>
          <div>
            <div style={{fontSize:13,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:3,color:C.o}}>STRAVA DASHBOARD</div>
            {athlete&&<div style={{fontSize:10,color:C.dim}}>{athlete.firstname} {athlete.lastname}{athlete.city?` · ${athlete.city}`:''}</div>}
          </div>
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',padding:'8px 0'}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>switchTab(t)} style={{background:tab===t?C.o+'18':'transparent',border:`1px solid ${tab===t?C.o+'50':'transparent'}`,color:tab===t?C.o:C.dim,borderRadius:8,padding:'6px 12px',cursor:'pointer',fontSize:11,letterSpacing:1,transition:'all 0.2s'}}>
              {t.toUpperCase()}
            </button>))}
        </div>
      </div>

      {/* MAIN */}
      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 20px',opacity:tabAnim?1:0,transition:'opacity 0.12s'}}>
        <div style={{marginBottom:20}}><SyncBar status={syncStatus} count={cachedCount} onSync={()=>syncIncremental(true)} onReset={()=>{clearTokens();setActivities([]);setStage('login')}}/></div>

        {/* OVERVIEW */}
        {tab==='Overview'&&(
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:4,lineHeight:1,marginBottom:4}}>YOUR JOURNEY<br/><span style={{color:C.o}}>BY THE NUMBERS</span></div>
              <p style={{color:C.dim,fontSize:11,letterSpacing:1,margin:0}}>ALL-TIME STRAVA DATA · LIVE FROM API + LOCAL CACHE</p>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12}}>
              <Stat icon="🏃" label="Total Runs" value={runStats?.runs?.length||'—'} sub="logged activities" color={C.o}/>
              <Stat icon="📏" label="Run Distance" value={fmtKm(totalRunKm)} sub={fmtTime(totalRunTime)+' total'} color="#fb923c"/>
              <Stat icon="🚴" label="Ride Distance" value={fmtKm(totalRideKm)} sub={activities.filter(a=>(a.type||a.sport_type)==='Ride').length+' rides'} color={C.b}/>
              <Stat icon="🏊" label="Swims" value={swimCount} sub="water sessions" color={C.c}/>
              {runStats?.best10k&&<Stat icon="⚡" label="Best 10K" value={fmtTime(runStats.best10k.moving_time)} sub={fmtPace(runStats.best10k.average_speed)} color={C.g}/>}
              {runStats?.longestRun&&<Stat icon="🏆" label="Longest Run" value={fmtKm(runStats.longestRun.distance)} sub={runStats.longestRun.name?.slice(0,20)} color={C.y}/>}
            </div>
            <Card>
              <SH title="ACTIVITY BY YEAR" sub="Total activities across all types"/>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={yearData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="year" tick={{fill:C.dim,fontSize:11,fontFamily:'Space Mono'}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.dim,fontSize:11,fontFamily:'Space Mono'}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="runs" stackId="a" fill={C.o} name="Runs"/>
                  <Bar dataKey="rides" stackId="a" fill={C.b} name="Rides"/>
                  <Bar dataKey="walks" stackId="a" fill={C.g} name="Walks"/>
                  <Bar dataKey="other" stackId="a" fill={C.p} name="Other" radius={[5,5,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{display:'flex',gap:18,marginTop:10,flexWrap:'wrap'}}>
                {[[C.o,'Runs'],[C.b,'Rides'],[C.g,'Walks'],[C.p,'Other']].map(([c,l])=>(
                  <div key={l} style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:C.dim}}>
                    <div style={{width:9,height:9,borderRadius:2,background:c}}/>{l}
                  </div>))}
              </div>
            </Card>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <Card>
                <SH title="ACTIVITY MIX" sub="All-time breakdown"/>
                <div style={{display:'flex',alignItems:'center',gap:20}}>
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart><Pie data={activityMix} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" stroke="none">
                      {activityMix.map((e,i)=><Cell key={i} fill={e.color}/>)}
                    </Pie></PieChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {activityMix.map(a=>(
                      <div key={a.name} style={{display:'flex',alignItems:'center',gap:7}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:a.color,flexShrink:0}}/>
                        <span style={{color:C.muted,fontSize:12}}>{a.name}</span>
                        <span style={{color:a.color,marginLeft:4,fontSize:12,fontWeight:'bold'}}>{a.value}</span>
                      </div>))}
                  </div>
                </div>
              </Card>
              <Card>
                <SH title="RUN KM / YEAR" sub="Distance per year"/>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={runKmByYear}>
                    <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.o} stopOpacity={0.3}/><stop offset="95%" stopColor={C.o} stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis dataKey="year" tick={{fill:C.dim,fontSize:10,fontFamily:'Space Mono'}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.dim,fontSize:10,fontFamily:'Space Mono'}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<TT/>}/>
                    <Area type="monotone" dataKey="km" stroke={C.o} strokeWidth={2} fill="url(#rg)" name="km" dot={{fill:C.o,r:3,strokeWidth:0}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>)}

        {/* RUNNING */}
        {tab==='Running'&&(
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:4,lineHeight:1,marginBottom:4}}>RUNNING<br/><span style={{color:C.o}}>DEEP DIVE</span></div>
              <p style={{color:C.dim,fontSize:11,letterSpacing:1,margin:0}}>PACE TRENDS, VOLUME & CONSISTENCY</p>
            </div>
            <Card>
              <SH title="PACE TREND" sub="Avg pace per run (min/km) — lower = faster"/>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={paceTrend.slice(-50)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="date" tick={{fill:C.dim,fontSize:10,fontFamily:'Space Mono'}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                  <YAxis domain={['auto','auto']} tick={{fill:C.dim,fontSize:10,fontFamily:'Space Mono'}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}'`}/>
                  <Tooltip content={<TT/>} formatter={v=>[`${v} min/km`,'Pace']}/>
                  <Line type="monotone" dataKey="pace" stroke={C.o} strokeWidth={2} dot={{fill:C.o,r:3,strokeWidth:0}} activeDot={{r:5}} name="Pace"/>
                </LineChart>
              </ResponsiveContainer>
              {runStats?.fastestPace&&<Tip>💡 <b>Fastest pace run:</b> {runStats.fastestPace.name} — {fmtPace(runStats.fastestPace.average_speed)} over {fmtKm(runStats.fastestPace.distance)}</Tip>}
            </Card>
            <Card>
              <SH title="RUN LENGTH DISTRIBUTION" sub="How your runs split by distance"/>
              <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:8}}>
                {runStats&&Object.entries(runStats.byDist).map(([label,count],i)=>{
                  const total=Object.values(runStats.byDist).reduce((a,b)=>a+b,0)
                  const pct=total?Math.round((count/total)*100):0
                  const cols=[C.dim,C.o,'#fb923c',C.y,C.g]
                  return <div key={label} style={{flex:1,minWidth:100,background:'rgba(255,255,255,0.02)',borderRadius:12,padding:14,border:`1px solid ${cols[i]}25`}}>
                    <div style={{color:cols[i],fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2}}>{count}</div>
                    <div style={{color:C.muted,fontSize:11,marginBottom:8}}>{label}</div>
                    <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}><div style={{height:'100%',width:`${pct}%`,background:cols[i],borderRadius:2}}/></div>
                    <div style={{color:C.dim,fontSize:10,marginTop:4}}>{pct}%</div>
                  </div>})}
              </div>
            </Card>
            <Card>
              <SH title="RECENT RUNS" sub="Last 10 runs from cache"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {(runStats?.runs||[]).slice(0,10).map((r,i)=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`}}>
                    <div style={{color:C.dim,fontSize:11,minWidth:22}}>#{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{color:'#e2e8f0',fontSize:12}}>{r.name}</div>
                      <div style={{color:C.dim,fontSize:10}}>{new Date(r.start_date).toLocaleDateString()}</div>
                    </div>
                    <div style={{color:C.o,fontSize:12,minWidth:55,textAlign:'right'}}>{fmtKm(r.distance)}</div>
                    <div style={{color:C.muted,fontSize:12,minWidth:65,textAlign:'right'}}>{fmtTime(r.moving_time)}</div>
                    <div style={{color:C.dim,fontSize:11,minWidth:68,textAlign:'right'}}>{fmtPace(r.average_speed)}</div>
                  </div>))}
              </div>
            </Card>
          </div>)}

        {/* BEST RUNS */}
        {tab==='Best Runs'&&(
          <div style={{display:'flex',flexDirection:'column',gap:24}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:4,lineHeight:1,marginBottom:4}}>HALL OF<br/><span style={{color:C.o}}>FAME</span></div>
              <p style={{color:C.dim,fontSize:11,letterSpacing:1,margin:0}}>AUTO-DETECTED FROM YOUR LIVE DATA</p>
            </div>
            <Card>
              <SH title="TOP 10 LONGEST RUNS" sub="By distance"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {(runStats?.runs||[]).slice().sort((a,b)=>b.distance-a.distance).slice(0,10).map((r,i)=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',borderRadius:12,background:i===0?'rgba(234,179,8,0.06)':'rgba(255,255,255,0.02)',border:`1px solid ${i===0?C.y+'30':C.border}`}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:i===0?C.y:C.dim,minWidth:28}}>#{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{color:'#e2e8f0',fontSize:13}}>{r.name}</div>
                      <div style={{color:C.dim,fontSize:10}}>{new Date(r.start_date).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
                    </div>
                    <div style={{color:C.o,fontFamily:"'Bebas Neue',sans-serif",fontSize:20}}>{fmtKm(r.distance)}</div>
                    <div style={{color:C.muted,fontSize:12,minWidth:75,textAlign:'right'}}>{fmtTime(r.moving_time)}</div>
                    <div style={{color:C.dim,fontSize:11,minWidth:68,textAlign:'right'}}>{fmtPace(r.average_speed)}</div>
                    {r.kudos_count>0&&<div style={{fontSize:11,color:C.o,background:C.o+'15',padding:'2px 8px',borderRadius:20,flexShrink:0}}>👏 {r.kudos_count}</div>}
                  </div>))}
              </div>
            </Card>
            <Card glow={C.o}>
              <SH title="9–11 KM LEADERBOARD" sub="All runs in range · fastest to slowest"/>
              {(()=>{
                const range=(runStats?.runs||[]).filter(r=>r.distance>=9000&&r.distance<=11000).sort((a,b)=>a.moving_time-b.moving_time)
                if(!range.length) return <div style={{color:C.dim,fontSize:13}}>No 9–11km runs found yet.</div>
                const best=range[0].moving_time,worst=range[range.length-1].moving_time
                return range.map((r,i)=>{
                  const pct=worst===best?100:100-((r.moving_time-best)/(worst-best))*80
                  return <div key={r.id} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:i===0?C.o:C.dim,minWidth:28}}>#{i+1}</span>
                        <div>
                          <div style={{fontSize:13,color:'#e2e8f0'}}>{r.name}</div>
                          <div style={{fontSize:10,color:C.dim}}>{new Date(r.start_date).toLocaleDateString()} · {fmtKm(r.distance)}</div>
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:i===0?C.o:C.muted}}>{fmtTime(r.moving_time)}</div>
                        <div style={{fontSize:10,color:C.dim}}>{fmtPace(r.average_speed)}{r.average_heartrate?` · ❤️ ${Math.round(r.average_heartrate)}`:''}</div>
                      </div>
                    </div>
                    <div style={{height:3,borderRadius:2,background:'rgba(255,255,255,0.05)'}}><div style={{height:'100%',width:`${pct}%`,background:i===0?C.o:C.o+'50',borderRadius:2}}/></div>
                  </div>})})()}
            </Card>
            <Card>
              <SH title="FASTEST PACE RUNS" sub="Runs ≥ 3km · best avg pace"/>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {(runStats?.runs||[]).filter(r=>r.distance>=3000&&r.average_speed>0).slice().sort((a,b)=>b.average_speed-a.average_speed).slice(0,10).map((r,i)=>(
                  <div key={r.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderRadius:10,background:'rgba(255,255,255,0.02)',border:`1px solid ${C.border}`}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:i===0?C.g:C.dim,minWidth:28}}>#{i+1}</div>
                    <div style={{flex:1}}>
                      <div style={{color:'#e2e8f0',fontSize:12}}>{r.name}</div>
                      <div style={{color:C.dim,fontSize:10}}>{new Date(r.start_date).toLocaleDateString()} · {fmtKm(r.distance)}</div>
                    </div>
                    <div style={{color:C.g,fontFamily:"'Bebas Neue',sans-serif",fontSize:18}}>{fmtPace(r.average_speed)}</div>
                    <div style={{color:C.muted,fontSize:11,minWidth:68,textAlign:'right'}}>{fmtTime(r.moving_time)}</div>
                  </div>))}
              </div>
            </Card>
          </div>)}

        {/* INSIGHTS */}
        {tab==='Insights'&&(
          <div style={{display:'flex',flexDirection:'column',gap:18}}>
            <div>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:44,letterSpacing:4,lineHeight:1,marginBottom:4}}>DATA<br/><span style={{color:C.o}}>INSIGHTS</span></div>
              <p style={{color:C.dim,fontSize:11,letterSpacing:1,margin:0}}>AUTO-COMPUTED FROM YOUR FULL HISTORY</p>
            </div>
            {(()=>{
              const runs=runStats?.runs||[]
              const totalDist=runs.reduce((s,r)=>s+r.distance,0)
              const bestYear=yearData.reduce((best,y)=>y.runs>(best?.runs||0)?y:best,null)
              const avgSpd=runs.filter(r=>r.average_speed>0).reduce((s,r)=>s+r.average_speed,0)/(runs.filter(r=>r.average_speed>0).length||1)
              const longRuns=runs.filter(r=>r.distance>=20000)
              const morningRuns=runs.filter(r=>{const h=new Date(r.start_date).getHours();return h>=4&&h<10}).length
              const eveningRuns=runs.filter(r=>new Date(r.start_date).getHours()>=17).length
              const insights=[
                {icon:'📊',color:C.o,title:'Total Running Output',body:`You've completed ${runs.length} runs covering ${fmtKm(totalDist)} — that's roughly ${Math.round(totalDist/42195)} marathons' worth of ground covered across your history!`,stat:fmtKm(totalDist),sub:`${runs.length} runs`},
                bestYear&&{icon:'🏆',color:C.y,title:'Best Running Year',body:`${bestYear.year} was your strongest year with ${bestYear.runs} runs — averaging ${(bestYear.runs/12).toFixed(1)} runs/month. That's a disciplined training rhythm.`,stat:bestYear.year,sub:`${bestYear.runs} runs`},
                {icon:'⏰',color:C.c,title:'Preferred Run Time',body:`You're predominantly a ${morningRuns>eveningRuns?'morning 🌅':'evening 🌙'} runner (${Math.max(morningRuns,eveningRuns)} vs ${Math.min(morningRuns,eveningRuns)}). Research shows consistent run timing boosts adherence.`,stat:morningRuns>eveningRuns?'Morning':'Evening',sub:`${morningRuns} AM vs ${eveningRuns} PM`},
                longRuns.length>0&&{icon:'🦾',color:C.p,title:'Long Run Capability',body:`You have ${longRuns.length} runs over 20km in your history. Your longest is ${fmtKm(runStats.longestRun?.distance)} — that's serious endurance base work.`,stat:`${longRuns.length}×`,sub:'runs over 20km'},
                runStats?.best10k&&{icon:'⚡',color:C.g,title:'10K Personal Best',body:`Your fastest 10K-range run clocks in at ${fmtTime(runStats.best10k.moving_time)} (${fmtPace(runStats.best10k.average_speed)}). ${runStats.best10k.moving_time<3600?'Sub-60! That puts you in the top 25% of recreational runners.':'Keep building — sub-60 is within striking distance!'}`,stat:fmtTime(runStats.best10k.moving_time),sub:fmtPace(runStats.best10k.average_speed)},
                {icon:'📈',color:C.b,title:'Overall Pace Baseline',body:`Your all-time average pace across runs ≥3km is ${fmtPace(avgSpd)}. As this number drops over time, your fitness is improving — track it monthly.`,stat:fmtPace(avgSpd),sub:'all-time avg pace'},
              ].filter(Boolean)
              return insights.map((ins,i)=>(
                <div key={i} style={{display:'flex',gap:16,padding:20,borderRadius:16,background:C.surf,border:`1px solid ${ins.color}18`}}>
                  <div style={{width:44,height:44,borderRadius:12,background:ins.color+'15',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{ins.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:17,letterSpacing:2,color:ins.color,marginBottom:5}}>{ins.title}</div>
                    <div style={{fontSize:13,color:C.muted,lineHeight:1.7}}>{ins.body}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,minWidth:80}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:ins.color,letterSpacing:1}}>{ins.stat}</div>
                    <div style={{fontSize:10,color:C.dim,marginTop:2}}>{ins.sub}</div>
                  </div>
                </div>))})()}
            <Card glow={C.c} style={{marginTop:8}}>
              <SH title="🚀 DEPLOY TO GITHUB PAGES" sub="3 steps to go live"/>
              <div style={{fontSize:12,color:C.muted,lineHeight:2.2}}>
                <div>1. <span style={{color:C.o}}>Create GitHub repo</span> → name it <code style={{background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:4}}>strava-pwa</code> and push this project</div>
                <div>2. <span style={{color:C.o}}>Add Secrets</span> in repo Settings → Secrets: <code style={{background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:4}}>VITE_STRAVA_CLIENT_ID</code> and <code style={{background:'rgba(255,255,255,0.06)',padding:'1px 6px',borderRadius:4}}>VITE_STRAVA_CLIENT_SECRET</code></div>
                <div>3. <span style={{color:C.o}}>Enable GitHub Pages</span> (Settings → Pages → Source: GitHub Actions) → push to main → auto-deploys ✅</div>
                <div style={{marginTop:8,color:C.dim,fontSize:11}}>Also update your Strava app's "Authorization Callback Domain" to <code>yourusername.github.io</code></div>
              </div>
            </Card>
          </div>)}
      </div>
      <div style={{textAlign:'center',padding:20,color:'#1e293b',fontSize:10,letterSpacing:1}}>STRAVA PWA · DATA IN YOUR BROWSER · STRAVA API</div>
    </div>)
}
