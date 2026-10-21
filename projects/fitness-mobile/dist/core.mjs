import {EXERCISES} from './training.mjs';
const DAY=86400000;
const parse=s=>new Date(`${s}T00:00:00Z`);
export const addDays=(s,n)=>new Date(parse(s).getTime()+n*DAY).toISOString().slice(0,10);
export const daysBetween=(a,b)=>Math.round((parse(a)-parse(b))/DAY);
export function planDay(date,start){
  const n=daysBetween(date,start),week=Math.floor(n/7)+1,day=((n%7)+7)%7;
  const active=n>=0&&n<84;
  return {active,week,day,type:active?({0:'A',2:'B',4:'A'}[day]||''):'',sets:week===1?1:week===2?2:3,walk:active&&[0,1,3,4,5].includes(day)?(week===1?15:week===2?20:30):0};
}
const numeric=v=>typeof v==='number'&&Number.isFinite(v);
export function weekStats(days,start){
  const values=Array.from({length:7},(_,i)=>days[addDays(start,i)]?.weight).filter(v=>numeric(v)&&v>=30&&v<=250);
  return {count:values.length,mean:values.length===7?Math.round(values.reduce((a,b)=>a+b,0)/7*100)/100:null};
}
export function totals(foods,portions){
  const result={kcal:0,p:0,f:0,c:0};
  for(const food of foods){const amount=Number(portions?.[food.id])||0; if(amount<0)continue;for(const key of Object.keys(result))result[key]+=amount*food[key]/100;}
  for(const key of Object.keys(result))result[key]=Math.round(result[key]*100)/100;
  return result;
}
export function shoppingCycle(date){
  const day=(parse(date).getUTCDay()+6)%7;
  const start=addDays(date,day<4?-day:4-day),days=day<4?4:3;
  return {date:start,end:addDays(start,days-1),days};
}
export const waistMean=d=>numeric(d?.waist1)&&numeric(d?.waist2)?(d.waist1+d.waist2)/2:null;
export function buildFoodRows(diet,labels={},mode='fresh',recorded={},date=''){
  const tomato=()=>diet.food.find(f=>f.id==='tomato');
  const tin=()=>({...tomato(),id:'tomato-tin',name:'原味常温番茄罐头（含汁整罐）',kcal:24,p:1.2,f:.3,c:4.4});
  const row=(food,meal,amount)=>({...food,...labels[food.id],id:`${meal}-${food.id}`,foodId:food.id,meal,amount});
  const rotation=date&&[1,5].includes(parse(date).getUTCDay());
  const vegetableRows=diet.rotation?.foods||[{id:'broccoli',name:'西兰花（采购日当天吃）',unit:'g',kcal:34,p:2.8,f:.4,c:6.6},{id:'carrot',name:'胡萝卜（采购日当天吃）',unit:'g',kcal:41,p:.9,f:.2,c:9.6}];
  return diet.meals.flatMap(meal=>meal.items.flatMap(item=>{
    const isTomato=item.food==='tomato';
    if(isTomato&&meal.id==='dinner'&&rotation){const rows=vegetableRows.map(f=>row(f,meal.id,100));for(const f of [tomato(),tin()])if(typeof recorded[`${meal.id}-${f.id}`]==='number')rows.push(row(f,meal.id,0));return rows;}
    const food=isTomato&&mode==='tin'?tin():diet.food.find(f=>f.id===item.food);
    const rows=[row(food,meal.id,isTomato&&mode==='tin'?400:item.amount)];
    if(isTomato){const old=mode==='tin'?tomato():tin();if(typeof recorded[`${meal.id}-${old.id}`]==='number')rows.push(row(old,meal.id,0));if(meal.id==='dinner')for(const f of vegetableRows)if(typeof recorded[`${meal.id}-${f.id}`]==='number')rows.push(row(f,meal.id,0));}
    return rows;
  }));
}
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const dateOK=s=>typeof s==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(parse(s).getTime())&&parse(s).toISOString().slice(0,10)===s;
const ranged=(v,min,max)=>v===null||v===undefined||(numeric(v)&&v>=min&&v<=max);
const trainingID=id=>typeof id==='string'&&Object.hasOwn(EXERCISES,id);
const boundedText=(v,max,min=0)=>typeof v==='string'&&v.length>=min&&v.length<=max;
function validTrainingPlan(plan){
  if(!Array.isArray(plan)||plan.length>20)return false;
  const seen=new Set();
  for(const ex of plan){
    if(!obj(ex)||!trainingID(ex.id)||seen.has(ex.id)||!boundedText(ex.name,80,1)
      ||!Number.isInteger(ex.sets)||ex.sets<1||ex.sets>3
      ||!Number.isInteger(ex.min)||ex.min<1||ex.min>100
      ||!Number.isInteger(ex.max)||ex.max<ex.min||ex.max>100)return false;
    seen.add(ex.id);
  }
  return true;
}
function isoDateTime(value){
  if(typeof value!=='string')return false;
  const match=/^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if(!match||!Number.isFinite(Date.parse(value)))return false;
  const date=parse(match[1]);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===match[1];
}
function validTrainingFeedback(feedback){
  if(!obj(feedback)||!ranged(feedback.minutes,0,600)||!ranged(feedback.effort,1,10))return false;
  if(feedback.feeling!==undefined&&!['','normal','tired','sore','discomfort'].includes(feedback.feeling))return false;
  if(feedback.note!==undefined&&!boundedText(feedback.note,1000))return false;
  if(feedback.finished!==undefined&&typeof feedback.finished!=='boolean')return false;
  if(feedback.finishedAt!==undefined&&feedback.finishedAt!==null&&!isoDateTime(feedback.finishedAt))return false;
  return true;
}
export function cleanTrainingSnapshots(value){
  return {...value,days:Object.fromEntries(Object.entries(value.days||{}).map(([date,d])=>[date,d.trainingPlan?{...d,trainingPlan:d.trainingPlan.map(({id,name,sets,min,max})=>({id,name,sets,min,max}))}:d]))};
}
export function validProgram(p){
  if(!obj(p)||!['ready','running','paused'].includes(p.status)||!dateOK(p.plannedStart)||!Array.isArray(p.pauses)||p.pauses.length>1000)return false;
  if(p.status==='ready')return p.startedOn===null&&p.pauses.length===0;
  if(!dateOK(p.startedOn))return false;
  let previousEnd=p.startedOn,open=0;
  for(const [i,pause]of p.pauses.entries()){
    if(!obj(pause)||!dateOK(pause.start)||pause.start<previousEnd)return false;
    if(pause.end===null){open++;if(i!==p.pauses.length-1)return false;}
    else {if(!dateOK(pause.end)||pause.end<pause.start)return false;previousEnd=pause.end;}
  }
  return p.status==='paused'?open===1:open===0;
}
export function validImport(v){
  if(!obj(v)||![1,2].includes(v.version)||!obj(v.settings)||!dateOK(v.settings.start)||(v.version===1&&parse(v.settings.start).getUTCDay()!==1)||!obj(v.days)||!obj(v.shopping))return false;
  if(v.version===2&&(!validProgram(v.program)||(v.program.startedOn&&v.settings.start!==v.program.startedOn)))return false;
  if(Object.keys(v.days).length>4000)return false;
  for(const key of ['firstMeal','lunch','snack','dinner','trainingTime'])if(v.settings[key]!==undefined&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.settings[key]))return false;
  if(!ranged(v.settings.targetCalories,1800,3500))return false;
  for(const [key,d]of Object.entries(v.days)){
    if(!dateOK(key)||!obj(d))return false;
    if(d.workoutType!==undefined&&!['A','B','UA','LA','UB','LB'].includes(d.workoutType))return false;
    for(const [field,min,max]of [['weight',30,250],['waist1',40,200],['waist2',40,200],['steps',0,100000],['sleep',0,24],['walk',0,600]])if(!ranged(d[field],min,max))return false;
    if(d.note!==undefined&&(typeof d.note!=='string'||d.note.length>1000))return false;
    if(d.foods!==undefined){if(!obj(d.foods))return false;for(const [id,amount]of Object.entries(d.foods))if(!/^[a-z0-9_-]+$/.test(id)||!ranged(amount,0,3000))return false;}
    if(d.sets!==undefined){if(!obj(d.sets))return false;for(const [id,sets]of Object.entries(d.sets)){if(!/^[a-z0-9_-]+$/.test(id)||!Array.isArray(sets)||sets.length>3)return false;for(const s of sets){if(s===null)continue;if(!obj(s)||!ranged(s.kg,0,500)||!ranged(s.reps,0,100)||!ranged(s.rir,0,10)||(s.done!==undefined&&typeof s.done!=='boolean')||(s.skipped!==undefined&&typeof s.skipped!=='boolean')||(s.skipReason!==undefined&&!boundedText(s.skipReason,200)))return false;}}}
    if(d.trainingPlan!==undefined&&!validTrainingPlan(d.trainingPlan))return false;
    if(d.exerciseNotes!==undefined){if(!obj(d.exerciseNotes))return false;for(const [id,note]of Object.entries(d.exerciseNotes))if(!trainingID(id)||!boundedText(note,500))return false;}
    if(d.trainingFeedback!==undefined&&!validTrainingFeedback(d.trainingFeedback))return false;
    if(!ranged(d.setLevel,1,3))return false;
  }
  if(v.settings.labels!==undefined){if(!obj(v.settings.labels))return false;for(const [id,label]of Object.entries(v.settings.labels)){if(!/^[a-z0-9_-]+$/.test(id)||!obj(label))return false;for(const k of ['kcal','p','f','c'])if(!ranged(label[k],0,k==='kcal'?1000:100))return false;}}
  for(const [date,items]of Object.entries(v.shopping)){if(!dateOK(date)||!obj(items))return false;for(const [id,checked]of Object.entries(items))if(!/^[a-z0-9_-]+$/.test(id)||typeof checked!=='boolean')return false;}
  return true;
}
export function trendMessage(days,date,start){
  const age=daysBetween(date,start)+1;
  const now=weekStats(days,addDays(date,-6)),before=weekStats(days,addDays(date,-13));
  if(age<14)return '先完成14天观察，不因单日体重波动调整食量。';
  if(now.mean===null||before.mean===null)return '近两周记录不足：每个7天窗口都填满体重后，再比较均值。缺测不会按0计算。';
  const delta=now.mean-before.mean;
  if(delta<-.5)return '两周均值比较下降偏快。结合饥饿、疲劳和训练表现，可考虑每天增加约150千卡，调整后再观察至少两周。';
  if(delta<=0)return '体重稳定或缓慢下降。结合腰围与力量：腰围下降、力量进步就维持，不必继续减食量。';
  return '均值有所上升。结合每周腰围：两者持续一起上升才考虑减约150千卡；腰围下降、力量上升则维持。';
}
