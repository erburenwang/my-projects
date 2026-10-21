import {addDays,daysBetween,planDay} from './core.mjs';
export const PROGRAM_CYCLE=['UA','LA','','UB','','LB',''];
export const newProgram=plannedStart=>({status:'ready',plannedStart,startedOn:null,pauses:[]});
export function startProgram(p,date){return p.status==='ready'?{...p,status:'running',startedOn:date,pauses:[]}:p;}
export function pauseProgram(p,date){
  if(p.status!=='running'||!programPlan(date,p).active)return p;
  return {...p,status:'paused',pauses:[...p.pauses,{start:date,end:null}]};
}
export function resumeProgram(p,date){
  if(p.status!=='paused'||date<p.pauses.at(-1).start)return p;
  return {...p,status:'running',pauses:p.pauses.map((pause,i)=>i===p.pauses.length-1?{...pause,end:date}:pause)};
}
export function programPlan(date,p){
  const empty={active:false,status:'ready',index:0,week:1,day:0,type:'',scheduledType:'UA',sets:1,walk:0};
  if(!p?.startedOn||p.status==='ready')return empty;
  if(date<p.startedOn)return {...empty,status:'before'};
  let excluded=0,isPaused=false;
  for(const pause of p.pauses){
    if(date>=pause.start){const end=pause.end&&pause.end<date?pause.end:date;excluded+=Math.max(0,daysBetween(end,pause.start));}
    if(date>=pause.start&&(!pause.end||date<pause.end))isPaused=true;
  }
  const index=daysBetween(date,p.startedOn)-excluded,week=Math.floor(index/7)+1,day=index%7;
  if(index>=84)return {...empty,status:'completed',index:84,week:12,day:6,scheduledType:''};
  const scheduledType=PROGRAM_CYCLE[day],sets=week===1?1:week===2?2:3;
  return {active:!isPaused,status:isPaused?'paused':'running',index,week,day,type:isPaused?'':scheduledType,scheduledType,sets,walk:!isPaused&&[0,2,3,4,6].includes(day)?(week===1?15:week===2?20:30):0};
}
export function upgradeState(s,planned){
  if(s.version===2)return s;
  const days=Object.fromEntries(Object.entries(s.days).map(([date,d])=>[date,{...d,...(Object.keys(d.sets||{}).length?{workoutType:planDay(date,s.settings.start).type||'A',setLevel:d.setLevel||planDay(date,s.settings.start).sets}:{})}]));
  return {...s,version:2,settings:{...s.settings,start:planned},program:newProgram(planned),days};
}
