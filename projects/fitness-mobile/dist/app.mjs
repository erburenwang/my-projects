import {addDays,daysBetween,planDay,weekStats,totals,shoppingCycle,validImport,waistMean,trendMessage,buildFoodRows,cleanTrainingSnapshots} from './core.mjs';
import {DIET} from './nutrition.mjs';
import {exercisePlan,WORKOUT_NAMES,EXERCISES} from './training.mjs';
import {sessionStats,isValidTrainingSet,previousExercise} from './training-stats.mjs';
import {renderTrainingPage,renderTrainingSet,trainingSetLabel} from './training-ui.mjs';
import {plannedExercises,trainingWeekStats} from './training-week.mjs';
import {defaultRestSeconds,newRestTimer,restTimerState,pauseRestTimer,resumeRestTimer,resetRestTimer,restoreRestTimer} from './rest-timer.mjs';
import {renderTrainingWeek,renderRestTimerBar} from './training-extras-ui.mjs';
import {guideImageData} from './exercise-guide-ui.mjs';
import {PROGRAM_CYCLE,newProgram,startProgram,pauseProgram,resumeProgram,programPlan,upgradeState} from './program.mjs';

const KEY='shoulder-dorm-v1';
const defaults={start:'2026-10-21',firstMeal:'10:30',lunch:'13:30',snack:'16:30',dinner:'19:00',trainingTime:'18:00',targetCalories:2500,vegetableMode:'fresh',labels:{}};
const freshState=()=>({version:2,program:newProgram('2026-10-21'),settings:{...defaults,labels:{}},days:{},shopping:{}});
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=0)=>n===null||n===undefined?'—':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d});
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let state=freshState(),storageError='',selected=today(),page='today',shopPart='',toastTimer,previewType='UA',previewLevel=1;
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(validImport(parsed))state=upgradeState(cleanTrainingSnapshots({...parsed,settings:{...defaults,...parsed.settings}}),'2026-10-21');else storageError='原有记录格式无法读取，尚未覆盖。请先在设置中导出原始备份，再导入正确记录。';}}catch{storageError='本地储存暂不可用。仍可填写并导出本次记录，关闭网页前请先备份。';}
const icons={today:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',food:'<path d="M4 3v6a3 3 0 006 0V3M7 3v18M20 21V3c-5 3-6 10 0 10"/>',training:'<path d="M6 8v8M3 9v6M18 8v8M21 9v6M6 12h12"/>',trends:'<path d="M3 3v18h18M7 15l4-5 4 3 5-7"/>',shopping:'<path d="M5 7h14l2 14H3L5 7zM8 8V6a4 4 0 018 0v2"/>',rest:'<path d="M20 14A8 8 0 1110 4a7 7 0 0010 10z"/>'};
const icon=id=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id]||''}</svg>`;
const navs=[['today','今日'],['food','饮食'],['training','训练'],['trends','趋势'],['shopping','采购']];
const day=()=>state.days[selected]||{};
const mutableDay=()=>state.days[selected]??=( {foods:{},sets:{}} );
const plan=()=>programPlan(selected,state.program);
const SHORT_NAMES={UA:'胸肩',LA:'背腹',UB:'胸背',LB:'肩腹'};
const calendarMonday=date=>addDays(date,-((new Date(date+'T00:00:00Z').getUTCDay()+6)%7));
const level=()=>day().setLevel||plan().sets;
const exercises=()=>plannedExercises(day(),plan());
const time=id=>state.settings[id==='first'?'firstMeal':id];
const shortDate=s=>`${Number(s.slice(5,7))}.${Number(s.slice(8,10))}`;
function foodRows(includeRecorded=false){return buildFoodRows(DIET,state.settings.labels||{},state.settings.vegetableMode,includeRecorded?day().foods||{}:{},selected);}
const targetTotals=()=>totals(foodRows(),Object.fromEntries(foodRows().map(f=>[f.id,f.amount])));
const actualTotals=()=>totals(foodRows(true),day().foods||{});
function save(){
  try{if(storageError.startsWith('原有'))return;localStorage.setItem(KEY,JSON.stringify(state));$('#storage-warning').hidden=true;}catch{$('#storage-warning').textContent='储存失败：关闭网页前请到设置导出备份。';$('#storage-warning').hidden=false;}
}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000);}
function numericInput(field,label,unit,{min=0,max=100000,step=1,hint='',value=day()[field],kind='day',extra=''}={}){
  const id=`${kind}-${field}`;
  return `<label class="field" for="${id}">${label}<div class="input-with-unit"><input id="${id}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${step}" placeholder="未记录" value="${esc(value??'')}" data-kind="${kind}" data-field="${esc(field)}" ${extra}><span>${unit}</span></div>${hint?`<span class="field-help">${hint}</span>`:''}<span class="field-error" aria-live="polite"></span></label>`;
}
function nutritionPanel(){return `<section class="card"><div class="card-title"><div><p class="eyebrow">EAT WELL</p><h2>今天吃到哪里了</h2></div><span class="tag">按实吃量计算</span></div><div class="nutrition-top"><div class="ring" id="calorie-ring"><div class="ring-inner"><b data-live="kcal">0</b><span> / ${state.settings.targetCalories} kcal</span></div></div><div>${[['p','蛋白质',160,'g'],['c','碳水化合物',320,'g'],['f','脂肪',70,'g']].map(([k,n,t,u])=>`<div class="macro-row"><div class="flex-between"><span>${n}</span><span><b data-live="${k}">0</b> / ${t}${u}</span></div><div class="track"><span id="macro-${k}" style="width:0%"></span></div></div>`).join('')}</div></div><p class="micro-note" id="nutrition-note">还没有填写食量。计划食物不会自动算作已吃。</p></section>`;}
function completedSets(){const s=sessionStats(exercises(),day());return {done:s.completedSets,total:s.plannedSets};}
function programControls(){
  const p=programPlan(today(),state.program),ready=p.status==='ready',paused=p.status==='paused',ended=p.status==='completed';
  const heading=ready?'准备好，再开始。':paused?`已暂停 · 第${p.week}周第${p.day+1}天`:ended?'12周阶段已完成':`进行中 · 第${p.week}周第${p.day+1}天`;
  const detail=ready?`预计${shortDate(state.program.plannedStart)}开始，不会自动启动。点击当天算第1天，任何星期都能开始。`:paused?'进度已冻结。恢复后继续暂停时的计划日，原有记录保留在实际日期。':ended?'已完成84个计划日。历史数据仍可查看与导出。':'肩背、胸肌与腹肌优先 · 每7个计划日4练 · 腿部仅1次5组（适应期更少）';
  return `<section class="program-bar ${paused?'program-paused':''}" aria-label="计划开始与暂停"><div><p class="eyebrow">YOUR PLAN, YOUR PACE</p><h2>${heading}</h2><p>${detail}</p></div><div class="program-actions"><button class="primary dark-button" data-action="${ready?'program-start':paused?'program-resume':'program-running'}" ${!ready&&!paused?'disabled':''}>${ready?'开始计划':paused?'继续计划':ended?'阶段完成':'已开始'}</button><button class="secondary" data-action="program-pause" ${ready||paused||ended?'disabled':''}>暂停计划</button></div></section>`;
}
function habits(){
  const d=day(),p=plan(),set=completedSets();
  const checks=[
    [typeof d.weight==='number','记录晨起体重',typeof d.weight==='number'?`${d.weight} kg`:'如厕后、吃喝前，同一台秤'],
    [foodRows().every(f=>typeof d.foods?.[f.id]==='number'),'记录今天吃了多少','填实际克数，或吃完一餐后点“按计划记录”'],
    [typeof d.sleep==='number'&&d.sleep>=8,'睡眠尽量达到8小时',typeof d.sleep==='number'?`已记录 ${d.sleep} 小时`:'规律作息，比额外加练更有帮助']
  ];
  if(p.type)checks.splice(2,0,[set.done===set.total&&set.total>0,`完成${WORKOUT_NAMES[p.type]}`,`${set.done} / ${set.total} 个工作组`]);
  if(p.walk)checks.push([typeof d.walk==='number'&&d.walk>=p.walk,`快走${p.walk}分钟`,`已记录 ${d.walk??0} 分钟，计入全天步数`]);
  return checks;
}
function renderToday(){
  const p=plan(),ready=p.status==='ready',paused=p.status==='paused';
  const preview=ready?{...state.program,status:'running',startedOn:state.program.plannedStart,pauses:[]}:state.program;
  const stripStart=ready?state.program.plannedStart:selected;
  const title=ready?'第一天，等你决定。':paused?'暂停一下，也没关系。':p.type?`今天，练${WORKOUT_NAMES[p.type]}。`:p.walk?'今天，走得轻松一点。':'今天，把恢复做好。';
  const detail=ready?`预计${shortDate(state.program.plannedStart)}前后出发；先准备好食材和训练用品。`:paused?'记录不会丢失，计划天数不会在暂停期间增加。':p.type?`${state.settings.trainingTime} · ${p.week===1?'每动作先做1组':p.week===2?'恢复良好再用2组':'动作稳定再用完整组数'} · ${p.type==='LB'?'腿仅少量保留':'重点练肩背与胸肌'}`:p.walk?`快走 ${p.walk} 分钟 · 能说话，不太容易唱歌`:'正常走动，按同一份菜单吃，睡好觉。';
  return `<div class="grid today-grid"><section class="card hero"><div class="hero-art"></div><div class="hero-top"><p class="eyebrow">SHOULDERS. CHEST. WAIST.</p><span class="tag">${ready?'尚未开始':paused?'暂停中':p.status==='completed'?'阶段完成':p.status==='before'?'开始之前':`第 ${p.week} / 12 周`}</span></div><div><h2>${title}</h2><p>${detail}</p></div><div class="hero-bottom"><a class="pill-button" href="#${ready||p.type?'training':'food'}">${ready?'预览四练安排':p.type?'打开今日训练':'查看今日菜单'} <span aria-hidden="true">↗</span></a><span class="small">宽肩 · 细腰 · 胸肌与腹肌</span></div></section>${nutritionPanel()}<section class="card"><div class="card-title"><div><p class="eyebrow">SMALL NUMBERS, REAL CHANGE</p><h2>先记下真实的今天</h2></div><span class="tag">自动保存</span></div><div class="field-grid">${numericInput('weight','晨起体重','kg',{min:30,max:250,step:.1})}${numericInput('steps','全天步数','步',{step:1})}${numericInput('walk',`快走${p.walk?` · 计划${p.walk}分钟`:''}`,'分钟',{max:600})}${numericInput('sleep','昨晚睡眠','小时',{max:24,step:.1})}</div><p class="micro-note">未开始或暂停时，也能记录饮食、体重和生活数据。缺测留空，不会按0计算。</p></section><section class="card"><div class="card-title"><div><p class="eyebrow">DAILY CHECK-IN</p><h2>今日执行情况</h2></div><span class="tag" id="habit-count">0 / 3</span></div><div id="habit-list" class="checklist"></div></section></div><section class="card mt"><div class="week-info"><h3>${ready?'开始后的前7天（预览）':paused?'暂停期间不安排新训练':'从所选日起7天'}</h3><span>${shortDate(stripStart)} — ${shortDate(addDays(stripStart,6))}</span></div><div class="week-strip">${Array.from({length:7},(_,i)=>{const date=addDays(stripStart,i),sp=programPlan(date,preview),weekday='日一二三四五六'[new Date(date+'T00:00:00Z').getUTCDay()];return `<button class="day-chip ${date===selected?'selected':''}" data-date="${date}" aria-label="${date} ${WORKOUT_NAMES[sp.type]||'恢复'}"><span>周${weekday} ${shortDate(date)}</span><strong>${sp.status==='paused'?'暂停':SHORT_NAMES[sp.type]||'—'}</strong><small>${sp.walk?`${sp.walk}分钟快走`:sp.type?'力量训练':'恢复'}</small></button>`;}).join('')}</div><p class="micro-note">四练顺序：胸肩 → 背腹 → 休息 → 胸背 → 休息 → 肩腹＋少量腿 → 休息。暂停会顺延；预览和计划安排不算已完成。</p></section>`;
}
function renderFood(){
  const target=targetTotals(),rows=foodRows(true);
  return `<div class="notice"><strong>不吃米饭、不吃花生；10:30再吃便携首餐。</strong> 前晚只装干燕麦；整苹果和未开封常温奶分开带，临吃才拌。时间可在设置修改。全天总量比必须几点吃更值得优先落实。</div><div class="grid cols-2"><div>${nutritionPanel()}<section class="card mt"><p class="eyebrow">YOUR DAILY BASELINE</p><h2>一天，固定这份量</h2><div class="split-summary mt"><div><b>${fmt(target.kcal)}</b><small> kcal</small></div><div><b>${fmt(target.p,1)}</b><small> g蛋白质</small></div><div><b>${fmt(target.f,1)}</b><small> g脂肪</small></div></div><p class="micro-note">菜单是约2500千卡的起点，训练日、休息日先一致。以上是参考值；鸡胸、牛奶等按实际包装标签校正，设置里可改每100g营养值。</p><details><summary>小煮锅怎么做一餐？</summary><ol><li>土豆400g切成约1cm丁，少量水煮10–12分钟至熟透，末段加入番茄。</li><li>先盛出菜；同锅少水按产品说明加热现开的即食鸡胸200g。吃时加油：午餐18g、晚餐19g。</li><li>普通日分步煮；周一/五晚餐另煮胡萝卜薄片4–6分钟，再放西兰花小朵煮3–5分钟。时间随锅容量和功率变化，锅小继续分批；不把不耐热包装直接下锅。</li><li>一次只做一餐量，吃完洗锅。没有冰箱，不留熟饭、熟菜、开封鸡肉到下一餐。</li></ol></details><details><summary>无冰箱，买什么才可行？</summary><p>鸡胸和奶必须在包装上明确写“未开封可常温保存”，并遵守温度限制。真空包装或“即食”本身都不足以判断。</p><p>买250ml单盒奶、100g鸡胸小包，开封当餐吃完；冷藏鸡胸、鲜奶和生鸡肉不能囤在宿舍。</p></details><details><summary>西兰花、胡萝卜与缺货替换</summary><p>周一、周五晚餐默认用西兰花100g＋胡萝卜100g替换番茄200g，已计入采购。其他5天以完整番茄为基础；采购当天把新鲜蔬菜做完吃完。</p><p>如果找不到常温鸡胸，可选包装允许未开封常温保存的鸡肉罐头。按每餐可食鸡肉200g买，沥干肉重与罐头净重分清；按真实标签重算，不能当等热量等蛋白。</p><p>若当地两者都买不到，这套常温鸡肉菜单就暂不能执行，可当天在食堂购买熟肉当餐吃完，或调整蛋白质来源，别把冷藏鸡胸当替代库存。</p></details></section></div><div class="stack">${DIET.meals.map(meal=>`<section class="card meal-card"><header class="meal-head"><div><span class="meal-time">${esc(time(meal.id))}</span><h3>${meal.id==='dinner'&&rows.some(f=>f.foodId==='broccoli'&&f.amount>0)?'西兰花胡萝卜配鸡胸':meal.title}</h3><p class="meal-summary">计划约 ${fmt(totals(rows.filter(f=>f.meal===meal.id),Object.fromEntries(rows.map(f=>[f.id,f.amount]))).kcal)} kcal · ${meal.id==='first'?'随身带走':meal.id==='snack'?'临吃拌奶':'小锅分步现煮'}</p></div></header><div class="meal-body">${rows.filter(f=>f.meal===meal.id).map(f=>`<div class="food-row"><div><div class="food-name">${esc(f.name)}</div><div class="food-plan">${f.amount?`计划 ${f.amount}${f.unit}${f.foodId==='potato'?' · 生的可食部':''}`:'原食材记录已保留 · 可改实际克数'}</div></div><label class="food-actual"><span class="sr-only">${meal.title}${f.name}实际食量</span><input type="number" inputmode="decimal" min="0" max="3000" step="1" placeholder="实吃" value="${esc(day().foods?.[f.id]??'')}" data-kind="food" data-field="${f.id}"><span>${f.unit}</span></label></div>`).join('')}</div><footer class="meal-footer"><span id="meal-live-${meal.id}">尚未记录</span><button class="secondary" data-action="meal-fill" data-meal="${meal.id}">按计划记录</button></footer></section>`).join('')}</div></div><section class="card mt"><h3>只做当餐，不在室温留剩饭</h3><p class="reading mt">需冷藏的易腐食品在室温累计超过2小时、环境高于约32°C超过1小时应丢弃。没有冰箱，不把这些上限当成备餐保存方式；不能靠再次煮开补救不当存放。土豆避光通风，发绿、腐烂或明显发芽不用；整番茄有破损、霉变就不用。</p>${sources()}</section>`;
}
function progressFeedback(ex){
  const history=Object.entries(state.days).filter(([date])=>date<selected).sort(([a],[b])=>b.localeCompare(a)).filter(([,d])=>d.sets?.[ex.id]?.some(s=>isValidTrainingSet(s)&&s.done&&!s.skipped)).slice(0,2);
  if(!history.length)return '先找能留2–3次规范余力的重量，不预设起始公斤数。';
  const last=history[0],entries=last[1].sets[ex.id].filter(s=>isValidTrainingSet(s)&&s.done&&!s.skipped);
  const baseline=`上次 ${shortDate(last[0])}：${entries.map(s=>`${s.kg}kg × ${s.reps}`).join(' / ')}。`;
  const eligible=history.length===2&&history.every(([,d])=>{const ss=d.sets[ex.id];return ss.length>=ex.sets&&ss.slice(0,ex.sets).every(s=>isValidTrainingSet(s)&&s.done&&!s.skipped&&s.reps>=ex.max&&s.rir>=2&&s.rir!==null);});
  if(eligible)return `${baseline}最近两次达上限且有余力；动作稳定、未加组时才考虑最小档加重。本周若在加组，先维持重量。`;
  return `${baseline}所有组连续两次达到${ex.max}次、仍有≥2次余力，再考虑最小档加重。`;
}
function trainingView(){
  const p=plan(),saved=day(),actualType=saved.workoutType||p.type;
  const preview=!actualType&&(p.status==='ready'||p.status==='paused'||p.status==='before');
  return {p,type:preview?previewType:actualType,exs:preview?exercisePlan(previewType,previewLevel):exercises(),data:preview?{}:saved,preview,readOnly:preview||!p.active,stage:preview?previewLevel:level(),time:state.settings.trainingTime,feedback:progressFeedback,previous:id=>preview?null:previousExercise(state.days,selected,id)};
}
function ensureTrainingPlan(){
  const d=mutableDay();d.workoutType??=plan().type;d.setLevel??=level();
  d.trainingPlan??=exercises().map(({id,name,sets,min,max})=>({id,name,sets,min,max}));
}
function trainingSet(id,index){
  const d=mutableDay();d.workoutType??=plan().type;d.setLevel??=level();d.sets??={};d.sets[id]??=[];
  return d.sets[id][index]??={};
}
function renderTraining(){
  const v=trainingView();
  if(!v.preview&&!v.data.trainingPlan&&Object.values(v.data.sets||{}).some(ss=>ss.some(s=>s?.done||s?.skipped))){ensureTrainingPlan();save();}
  return renderTrainingPage(trainingView())+`<div id="weekly-training-live">${weekSummaryMarkup()}</div>`;
}
function updateTrainingMetrics(){
  if(!$('#session-percent'))return;
  const v=trainingView(),s=sessionStats(v.exs,v.data),f=v.data.trainingFeedback||{};
  const setText=(id,text)=>{const e=$(id);if(e)e.textContent=text;};
  setText('#session-percent',`${s.percent}%`);
  setText('#training-count',`${s.completedSets} / ${s.plannedSets} 个计划工作组已完成 · ${s.skippedSets} 组跳过`);
  $('#training-progress').style.width=`${s.percent}%`;$('#training-progressbar').setAttribute('aria-valuenow',s.percent);
  setText('#metric-exercises',`${s.completedExercises}/${s.totalExercises}`);
  setText('#metric-reps',s.completedSets?`${fmt(s.totalReps)} 次`:'—');
  setText('#metric-load',s.completedSets?fmt(s.loadReps,1):'—');
  setText('#metric-target',s.completedSets?`${s.targetMetSets}/${s.completedSets} · ${Math.round(s.targetMetSets/s.completedSets*100)}%`:'—');
  const waiting=s.recordedSets-s.completedSets-v.exs.reduce((n,ex)=>n+(v.data.sets?.[ex.id]||[]).slice(0,ex.sets).filter(r=>r?.skipped&&isValidTrainingSet(r)).length,0);
  setText('#session-detail',`${Math.max(0,waiting)}组已填写待确认 · ${s.partialRecords}组记录不完整${f.minutes!=null?` · 实际 ${fmt(f.minutes,1)} 分钟`:''}${f.effort!=null?` · 费力 ${f.effort}/10`:''}`);
  setText('#session-state',v.preview?'空白预览 · 未产生真实训练数据':f.finished?`本次已结束 · 实际完成 ${s.percent}%`:'记录中 · 填写数值后，请确认完成本组');
  const finish=$('#finish-training');if(finish)finish.textContent=f.finished?'继续记录本次训练':'结束本次训练';
  const stage=$('#set-level');if(stage&&v.data.trainingPlan){stage.disabled=true;setText('#plan-lock-note','已锁定本次计划组数；做不完可以如实跳过，完成率保留实际情况。');}
  for(const ex of v.exs){
    const es=s.exercises[ex.id];setText(`[data-ex-percent="${ex.id}"]`,`${es.completedSets}/${es.plannedSets}组 · ${es.percent}%`);
    setText(`[data-ex-actual="${ex.id}"]`,es.completedSets?`实际 ${es.totalReps} 次 · 负荷指数 ${fmt(es.loadReps,1)} kg×次 · ${es.targetMetSets}/${es.completedSets}组次数达标`:'尚无已确认完成组');
    es.rows.forEach((r,i)=>{
      const row=$(`#set-${ex.id}-${i}`),record=v.data.sets?.[ex.id]?.[i]||{};if(!row)return;
      row.classList.toggle('finished',r.completed);row.classList.toggle('skipped-set',r.status==='skipped');
      row.querySelector('[data-set-status]').textContent=row.querySelector('[aria-invalid=true]')?'数值无效 · 未计完成':trainingSetLabel(r);
      row.querySelector('[data-set-calculation]').textContent=r.completed?`${record.kg} kg × ${record.reps} 次 = ${fmt(r.loadReps,1)} kg×次${r.targetMet?'':` · 计划 ${ex.min}–${ex.max} 次，按实际保留`}`:r.status==='recorded'?'数值已填好，确认完成后计入实际训练量':r.status==='skipped'?'该组保留在计划分母中，跳过不会提高完成率':'';
      row.querySelector('[data-kind=set-done]').checked=r.completed;
      const rest=row.querySelector('[data-action=rest-start]');if(rest)rest.hidden=!r.completed;
    });
  }
}
function handleTrainingInput(el){
  const kind=el.dataset.kind;
  if(!['set','skip-reason','exercise-note','training-feedback'].includes(kind))return false;
  if(trainingView().readOnly)return true;
  const key=el.dataset.field;
  if(kind==='exercise-note'){const d=mutableDay();d.exerciseNotes??={};d.exerciseNotes[el.dataset.ex]=el.value.slice(0,500);}
  if(kind==='skip-reason')trainingSet(el.dataset.ex,Number(el.dataset.set)).skipReason=el.value.slice(0,200);
  if(kind==='set'||(kind==='training-feedback'&&el.type==='number')){
    const blank=el.value==='',n=blank?null:Number(el.value),min=Number(el.min),max=Number(el.max);
    const invalid=el.validity.badInput||!blank&&(!Number.isFinite(n)||n<min||n>max||key==='reps'&&!Number.isInteger(n));
    el.toggleAttribute('aria-invalid',invalid);if(invalid)el.setAttribute('aria-invalid','true');
    if(kind==='set'){
      const s=trainingSet(el.dataset.ex,Number(el.dataset.set));s[key]=invalid?null:n;
      if(invalid||!isValidTrainingSet(s))s.done=false;
      const error=el.closest('.actual-set').querySelector('.set-error');
      error.textContent=invalid?`请输入${min}–${max}${key==='reps'?'之间的整数':'之间的有效数字'}，该组暂不计完成`:'';
    }else{const d=mutableDay();d.trainingFeedback??={};d.trainingFeedback[key]=invalid?null:n;}
  }
  if(kind==='training-feedback'&&el.type!=='number'){
    const d=mutableDay();d.trainingFeedback??={};
    d.trainingFeedback[key]=key==='note'?el.value.slice(0,1000):el.value;
  }
  save();updateLive();return true;
}
function refreshTrainingRow(id,index){
  const ex=exercises().find(ex=>ex.id===id),row=$(`#set-${id}-${index}`);
  if(ex&&row)row.outerHTML=renderTrainingSet(ex,index,day().sets?.[id]?.[index]||{});
}
function handleTrainingAction(b,action){
  if(!['skip-set','skip-remaining','copy-set','copy-previous','finish-training'].includes(action))return false;
  if(trainingView().readOnly)return true;
  const id=b.dataset.ex,index=Number(b.dataset.set),ex=exercises().find(ex=>ex.id===id);
  if(action==='skip-set'){
    ensureTrainingPlan();const s=trainingSet(id,index);s.skipped=!s.skipped;s.done=false;refreshTrainingRow(id,index);
  }
  if(action==='skip-remaining'){
    ensureTrainingPlan();for(let i=0;i<ex.sets;i++){const s=trainingSet(id,i);if(!(s.done&&isValidTrainingSet(s)&&!s.skipped)){s.skipped=true;s.done=false;refreshTrainingRow(id,i);}}
    toast('未完成组已标记跳过，原有数值和已完成组保留');
  }
  if(action==='copy-set'){
    const source=day().sets?.[id]?.[index-1],s=trainingSet(id,index);
    if(s.kg!=null){toast('本组已有重量，未覆盖');return true;}
    if(typeof source?.kg!=='number'||!Number.isFinite(source.kg)){toast('上一组还没有有效重量');return true;}
    s.kg=source.kg;refreshTrainingRow(id,index);toast('只复制重量；次数与完成请按实际记录');
  }
  if(action==='copy-previous'){
    const prior=previousExercise(state.days,selected,id);let copied=0;
    if(prior)for(let i=0;i<ex.sets;i++){const s=trainingSet(id,i);if(s.kg==null&&!s.skipped){s.kg=(prior.sets[i]||prior.sets.at(-1)).kg;refreshTrainingRow(id,i);copied++;}}
    toast(copied?`已补${copied}组空白重量；次数与完成仍需手动记录`:'没有需要补填的空白重量');
  }
  if(action==='finish-training'){
    ensureTrainingPlan();const d=mutableDay();d.trainingFeedback??={};const f=d.trainingFeedback;
    f.finished=!f.finished;f.finishedAt=f.finished?new Date().toISOString():null;
    toast(f.finished?`本次已结束，真实完成率 ${sessionStats(exercises(),d).percent}%`:'可继续补充本次真实记录');
  }
  save();updateLive();return true;
}

function chartMarkup(){
  const start=addDays(selected,-27),records=Array.from({length:28},(_,i)=>{const date=addDays(start,i);return{date,value:state.days[date]?.weight};}).filter(x=>typeof x.value==='number');
  if(records.length<2)return '<div class="chart-empty"><div><b>从第一条实测数据开始</b><p>至少记录2天后显示体重曲线。<br>不放示例体重，也不把缺测画成0。</p></div></div>';
  let min=Math.min(...records.map(r=>r.value)),max=Math.max(...records.map(r=>r.value));if(max-min<1){min-=.5;max+=.5;}
  const x=d=>45+daysBetween(d,start)/27*510,y=v=>145-(v-min)/(max-min)*120;
  return `<svg class="chart" viewBox="0 0 580 190" role="img" aria-label="最近28天体重趋势，单位公斤，圆点为实际记录，缺测不记零"><g font-size="11" fill="#617068">${[0,1,2].map(i=>{const v=min+(max-min)*i/2;return `<text x="0" y="${y(v)+4}">${v.toFixed(1)}</text><path d="M42 ${y(v)}H562" stroke="#e4e9dc" stroke-dasharray="3 5"/>`;}).join('')}<text x="45" y="180">${shortDate(start)}</text><text x="520" y="180">${shortDate(selected)}</text></g><polyline points="${records.map(r=>`${x(r.date)},${y(r.value)}`).join(' ')}" stroke="#607d42" stroke-width="2.5" fill="none"/>${records.map(r=>`<circle cx="${x(r.date)}" cy="${y(r.value)}" r="4" fill="#607d42"><title>${r.date}：${r.value}kg</title></circle>`).join('')}</svg>`;
}
function renderTrends(){
  const p=plan(),reviewStart=calendarMonday(state.program.startedOn||state.program.plannedStart),weekStart=calendarMonday(selected),stats=weekStats(state.days,weekStart),prev=weekStats(state.days,addDays(weekStart,-7)),wm=waistMean(day());
  const delta=stats.mean!==null&&prev.mean!==null?stats.mean-prev.mean:null;
  return `<div id="weekly-training-live">${weekSummaryMarkup(true)}</div><div class="stat-row mt"><div class="stat"><label>本自然周 · 填满7天才计算</label><b>${fmt(stats.mean,2)}<small>kg</small></b><p>${stats.count} / 7天已记录</p></div><div class="stat"><label>较上一自然周</label><b>${delta===null?'—':`${delta>0?'+':''}${fmt(delta,2)}`}<small>kg</small></b><p>需要连续两周完整记录</p></div><div class="stat"><label>所选日腰围平均</label><b id="waist-mean">${fmt(wm,1)}<small>cm</small></b><p>同一天测两次，不收腹</p></div></div><div class="grid cols-2 mt"><section class="card"><div class="card-title"><div><p class="eyebrow">YOUR REAL TREND</p><h2>体重的变化，慢慢看</h2></div><span class="tag">近28天</span></div>${chartMarkup()}<p class="micro-note">圆点是实测，连线跨越未测日期。单日波动不是脂肪变化；以下方完整7天均值为主要对比。</p></section><section class="card"><p class="eyebrow">WEEKLY WAIST CHECK</p><h2>腰围，每周测一次就够</h2><div class="field-grid mt">${numericInput('waist1','肚脐水平 · 第一次','cm',{min:40,max:200,step:.1})}${numericInput('waist2','肚脐水平 · 第二次','cm',{min:40,max:200,step:.1})}</div><p class="micro-note">自然站立、呼气后读数，皮尺水平、不勒紧。两次都填后取平均。</p><label class="field mt" for="daily-note">训练表现 / 饥饿疲劳 / 本次调整<textarea id="daily-note" maxlength="1000" rows="3" placeholder="例如：力量进步，饥饿感正常；本周维持食量。">${esc(day().note||'')}</textarea></label></section></div><div class="notice mt"><strong>当前观察建议：</strong>${state.program.status==='ready'?'计划尚未开始，可先记录基线，暂不根据单日波动调整食量。':state.program.status==='paused'?'计划已暂停，继续记录实际饮食和体重，不自动减少食量；恢复后结合训练表现再复盘。':trendMessage(state.days,selected,state.settings.start)}<br>这只是基于已录数据的提示；不会自动改食量。单次调整后观察至少两周，持续疲劳或明显训练退步时先关注恢复。</div><section class="card"><div class="card-title"><div><p class="eyebrow">12 WEEK OVERVIEW</p><h2>每周复盘</h2></div><span class="tag">空白不代表0</span></div><table class="trend-table"><thead><tr><th>观察周</th><th>体重均值</th><th>周变化</th><th>腰围</th><th>提醒</th></tr></thead><tbody>${Array.from({length:12},(_,i)=>{const start=addDays(reviewStart,i*7),end=addDays(start,6),s=weekStats(state.days,start),before=weekStats(state.days,addDays(start,-7));const measurements=Object.entries(state.days).filter(([date,d])=>date>=start&&date<=end&&waistMean(d)!==null).sort(([a],[b])=>b.localeCompare(a));const waist=measurements.length?waistMean(measurements[0][1]):null;const change=s.mean!==null&&before.mean!==null?s.mean-before.mean:null;return `<tr class="${selected>=start&&selected<=end?'current':''}"><td><b>观察${i+1}</b><br><span class="muted">${shortDate(start)}–${shortDate(end)}</span></td><td>${s.mean===null?`${s.count}/7天`:fmt(s.mean,2)+' kg'}</td><td class="change">${change===null?'—':`${change>0?'+':''}${fmt(change,2)}`}</td><td>${waist===null?'—':fmt(waist,1)+' cm'}</td><td>${(i+1)%4===0?'拍对比照':i===0?'先学动作':i===1?'观察恢复':'按趋势调整'}</td></tr>`;}).join('')}</tbody></table><p class="micro-note">训练进度按有效计划日计算；这里按周一至周日复盘实际数据，暂停不会挪动历史日期。周腰围取该周最近一次完成两次测量的平均值，不混合不同天。第4、8、12周在同样光线下拍正、侧、背面照片，自行保留，不上传。</p></section>`;
}
function shoppingData(){
  const base=shoppingCycle(selected),monday=base.days===4?base.date:addDays(base.date,-4),date=shopPart==='friday'?addDays(monday,4):shopPart==='monday'?monday:base.date,cycle=shoppingCycle(date),part=cycle.days===4?'monday':'friday';
  const pool=[...DIET.food,...(DIET.rotation?.foods||[])];
  const rows=DIET.shopping.map(item=>{const food=pool.find(f=>f.id===item.food),quantity=item[part];return {...item,food,quantity};});
  if(state.settings.vegetableMode==='tin'){const r=rows.find(r=>r.food.id==='tomato');r.food={...r.food,id:'tomato-tin',name:'原味番茄罐头（含汁整罐）',pack:{type:'罐'}};r.quantity={amount:(cycle.days*2-1)*400,unit:'g含汁净重',count:cycle.days*2-1,pack:'400g/罐'};r.note='每餐开1罐整罐吃完；周一/五晚餐换西兰花胡萝卜。营养在设置按含汁口径校正。';}
  return {cycle,rows};
}
function renderShopping(){
  const {cycle,rows}=shoppingData(),checked=state.shopping[cycle.date]||{},count=rows.filter(r=>checked[r.food.id]).length;
  return `<div class="shopping-toggle" aria-label="本周采购批次"><button data-action="shop-monday" class="${cycle.days===4?'active':''}" aria-pressed="${cycle.days===4}">周一 · 4天量</button><button data-action="shop-friday" class="${cycle.days===3?'active':''}" aria-pressed="${cycle.days===3}">周五 · 3天量</button></div><div class="grid cols-2 mt"><section class="card"><div class="purchase-header"><div><p class="eyebrow">TWO TRIPS. ONE SIMPLE ROUTINE.</p><h2>${shortDate(cycle.date)} 这次买这些</h2><p class="micro-note">覆盖 ${shortDate(cycle.date)} — ${shortDate(cycle.end)}，共${cycle.days}天</p></div><strong>${cycle.days}<small>天</small></strong></div><p class="progress-text" id="shopping-count">${count} / ${rows.length}项已核对</p><div class="track mt"><span id="shopping-progress" style="width:${count/rows.length*100}%"></span></div><div class="mt">${rows.map(r=>{const q=r.quantity;return `<label class="shopping-row ${checked[r.food.id]?'checked':''}"><input type="checkbox" data-kind="shopping" data-cycle="${cycle.date}" data-field="${r.food.id}" ${checked[r.food.id]?'checked':''}><span class="item-info"><b>${r.food.name}</b><p>${esc(q.pack||(r.food.id==='apple'?`约${q.approxCount}个，整果约${q.purchaseApprox}g`:q.purchaseApprox?`建议买毛重约${q.purchaseApprox}g`:r.note||'按现有库存补足'))}</p></span><span class="quantity">${q.count?`${q.count}${r.food.pack?.type||'罐'}`:`${q.amount}${q.unit}`}<small>${q.count?`${q.amount}${q.unit}合计`:q.purchaseApprox?'上行为可食净用量':'本批用量'}</small></span></label>`;}).join('')}</div><p class="micro-note">燕麦、油按库存补足，可先买一周装：燕麦980g、油259g；不必每次重复买整袋。苹果和土豆的毛重含估计损耗，实际称可食部。</p></section><div class="stack"><section class="card"><p class="eyebrow">NO FRIDGE, NO LEFTOVERS</p><h2>采购前先看包装</h2><ul class="note-list"><li>奶：250ml × ${cycle.days*2}盒。只买允许未开封常温保存的UHT奶。</li><li>鸡胸：100g × ${cycle.days*4}包。必须明确允许未开封常温保存；冷藏即食款不适用。</li><li>燕麦：每天140g，首餐100g＋加餐40g。只买可直接食用的即食款。</li><li>每次开一餐，立即吃完。不要选需要开封分好几餐的大袋肉、大盒奶。</li></ul><details><summary>买不到100g鸡胸小包怎么办？</summary><p>可用200g单餐包，每天2包；这一批买${cycle.days*2}包。或选200g可食肉重的常温鸡肉罐头，每餐整罐。不要用罐头总净重冒充肉重；营养按实际标签校正。</p></details></section><section class="card"><h3>蔬菜按存放条件选择</h3><label class="field mt" for="vegetable-mode">宿舍存放方式<select id="vegetable-mode"><option value="fresh" ${state.settings.vegetableMode==='fresh'?'selected':''}>完整鲜番茄 · 有阴凉通风处</option><option value="tin" ${state.settings.vegetableMode==='tin'?'selected':''}>原味番茄罐头 · 含汁整罐吃</option></select></label><p class="micro-note">鲜番茄买成熟＋稍硬的，熟的先吃；采购覆盖4天不代表保证能安全存4天。宿舍闷热、无合适存放点时选常温罐头；整罐400g/餐，采购与菜单会一起更新；周一/五晚餐仍用当天采购的西兰花和胡萝卜，参考热量也会变化。</p><p class="micro-note">周一和周五晚餐默认换成西兰花100g＋胡萝卜100g，已列在这次清单里。若只能买整颗西兰花，当晚把可食部分分批煮完、按实重记录，不留半颗存多日。</p></section><section class="card"><h3>晚间只准备这些</h3><p class="reading mt">称好次日干燕麦两份：首餐100g、加餐40g，分装干燥密封盒；整苹果、未开封奶一起带走。土豆和番茄不预洗、不预切。午晚只煮当餐量，不做多日熟食备餐。</p></section></div></div>`;
}
function sources(){return `<div class="source-links">${DIET.sources.filter(s=>['FDA-storage','USDA-shelf','UMD-produce','FSA-rice'].includes(s.id)).map(s=>`<a href="${s.url}" target="_blank" rel="noopener noreferrer">${s.id==='FDA-storage'?'FDA 食品储存':s.id==='USDA-shelf'?'USDA 常温食品':s.id==='UMD-produce'?'蔬果存放':'FSA 熟饭安全'} ↗</a>`).join('')}</div>`;}
function render(){
  if(state.program.status==='paused'&&restTimer?.status==='running')pauseCurrentRest();
  const meta={today:['YOUR DAILY ROUTINE','把今天练好，吃好。','把大目标，拆成今天能完成的小事。'],food:['SIMPLE FOOD, EVERY DAY','吃得简单，也吃得够。','便携首餐＋现煮午晚餐。输入实吃克数，即时看营养。'],training:['BUILD YOUR SHOULDERS','每一组，都有记录。','每7个计划日4练；肩背、胸肌与腹肌优先，腿仅一次少量保留。'],trends:['PROGRESS OVER PERFECTION','看趋势，不追单日数字。','腰腹逐渐清晰，肩背撑起来，力量持续进步。'],shopping:['YOUR TWO-TRIP SHOPPING LIST','一周两次，买得明白。','小煮锅、无冰箱；按周一4天、周五3天拆开。']};
  const m=meta[page];$('#page-kicker').textContent=m[0];$('#page-title').textContent=m[1];$('#page-desc').textContent=m[2];$('#selected-date').value=selected;
  for(const container of ['#desktop-nav','#mobile-nav'])$(container).innerHTML=navs.map(([id,label])=>`<a href="#${id}" class="nav-item ${page===id?'active':''}" ${page===id?'aria-current="page"':''}>${icon(id)}<span>${label}</span></a>`).join('');
  $('#content').innerHTML=programControls()+({today:renderToday,food:renderFood,training:renderTraining,trends:renderTrends,shopping:renderShopping})[page]();
  if(storageError){$('#storage-warning').textContent=storageError;$('#storage-warning').hidden=false;}
  updateLive();
}
function updateLive(){
  const t=actualTotals();for(const [key,v]of Object.entries(t))$$(`[data-live="${key}"]`).forEach(e=>e.textContent=fmt(v,key==='kcal'?0:1));
  const ring=$('#calorie-ring');if(ring)ring.style.setProperty('--progress',`${Math.min(1,t.kcal/state.settings.targetCalories)*360}deg`);
  for(const [key,target]of [['p',160],['c',320],['f',70]]){const e=$(`#macro-${key}`);if(e)e.style.width=`${Math.min(100,t[key]/target*100)}%`;}
  if($('#nutrition-note'))$('#nutrition-note').textContent=t.kcal===0?'还没有填写食量。计划食物不会自动算作已吃。':`已记录约${fmt(t.kcal)}千卡${t.kcal>state.settings.targetCalories?`，较参考量多${fmt(t.kcal-state.settings.targetCalories)}千卡`:`，距参考量约${fmt(state.settings.targetCalories-t.kcal)}千卡`}。这是记录反馈，不是必须凑满的分数。`;
  for(const meal of DIET.meals){const e=$(`#meal-live-${meal.id}`);if(e){const rows=foodRows(true).filter(f=>f.meal===meal.id),n=rows.filter(f=>typeof day().foods?.[f.id]==='number').length;e.textContent=n?`已录 ${n}/${rows.length}项 · ${fmt(totals(rows,day().foods).kcal)} kcal`:'尚未记录';}}
  if($('#habit-list')){const h=habits();$('#habit-list').innerHTML=h.map(([done,title,note])=>`<div class="checkline"><span class="check-circle ${done?'done':''}" aria-hidden="true">${done?'✓':'·'}</span><div class="checkline-text"><b>${title}</b><p>${note}</p></div><span class="sr-only">${done?'已完成':'未完成'}</span></div>`).join('');$('#habit-count').textContent=`${h.filter(h=>h[0]).length} / ${h.length}`;}
  updateTrainingMetrics();updateWeeklyTraining();updateRestTimerUI();
  if($('#waist-mean'))$('#waist-mean').innerHTML=`${fmt(waistMean(day()),1)}<small>cm</small>`;
}
function settings(){
  $('#settings-content').innerHTML=`<p class="reading">预计10月21日前后开始。先保持“尚未开始”，准备好时点击开始计划；按点击当天开始，不限周一。暂停会冻结计划日，恢复继续当前计划日，原始记录保留日期。</p><div class="settings-group"><h3>计划与时间</h3><label class="field" for="planned-start">预计开始日期（仅提醒，不自动启动）<input id="planned-start" type="date" value="${state.program.plannedStart}" min="2000-01-01" max="2099-12-31" ${state.program.startedOn?'disabled':''}></label><p class="micro-note">实际开始：${state.program.startedOn||'还未点击开始'}。开始、暂停和继续按钮在每个页面上方。</p><div class="field-grid mt">${[['firstMeal','便携首餐'],['lunch','午餐'],['snack','奶加餐'],['dinner','晚餐'],['trainingTime','训练']].map(([key,label])=>`<label class="field" for="time-${key}">${label}<input id="time-${key}" type="time" value="${esc(state.settings[key])}" data-setting="${key}"></label>`).join('')}${numericInput('targetCalories','参考热量','kcal',{min:1800,max:3500,step:1,value:state.settings.targetCalories,kind:'setting'})}</div><p class="micro-note">改时间不会改变全天食物总量。热量先观察14天，单次调整约150千卡；菜单克数不会随参考值自动改变。</p></div><div class="settings-group"><h3>数据保存在当前浏览器</h3><p class="reading">没有账号云同步。电脑和手机各有各的记录；清理浏览器数据会丢失，请定期导出JSON。换设备时先导出，再在新设备导入，导入将替换该设备记录。</p><div class="flex wrap mt"><button class="secondary" data-action="export">导出备份</button><button class="secondary" data-action="import">导入备份</button><button class="text-button" data-action="export-raw">导出原始储存</button></div><p id="import-error" class="error-box" role="alert"></p></div><div class="settings-group"><details><summary>按包装校正营养值（每100g / ml）</summary><p>以下初始值是计算参考，不是某品牌实测标签。用你买到的包装修改；能量若只有kJ，先除以4.184。修改会重新计算所有已录克数对应的估算，不改变实际克数。番茄罐头按含汁整罐标签计算。</p><div class="label-edit"><span>食物</span><span>kcal</span><span>蛋白g</span><span>脂肪g</span><span>碳水g</span></div>${[...new Map(foodRows(true).map(f=>[f.foodId,f])).values()].map(f=>`<div class="label-edit"><span>${esc(f.name)}</span>${['kcal','p','f','c'].map(k=>`<input type="number" inputmode="decimal" min="0" max="${k==='kcal'?1000:100}" step=".1" value="${f[k]}" aria-label="${esc(f.name)}每100${f.unit}${k}" data-kind="label" data-food="${f.foodId}" data-field="${k}">`).join('')}</div>`).join('')}</details></div><button class="primary wide mt" data-action="close-settings">保存并返回</button>`;
  $('#settings-dialog').showModal();
}
function exportData(raw=false){const text=raw?(localStorage.getItem(KEY)||JSON.stringify(state)):JSON.stringify(state,null,2);const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`肩背计划-${today()}${raw?'-原始':''}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('已生成备份文件，请妥善保存');}
document.addEventListener('input',e=>{
  const el=e.target;
  if(handleTrainingInput(el))return;
  if(el.id==='daily-note'){mutableDay().note=el.value;save();return;}
  if(el.dataset.setting){if(el.value){state.settings[el.dataset.setting]=el.value;save();}return;}
  if(!el.dataset.kind||el.type!=='number')return;
  const blank=el.value==='',value=blank?null:Number(el.value),min=Number(el.min),max=Number(el.max);
  if(!blank&&(!Number.isFinite(value)||value<min||value>max)){el.setAttribute('aria-invalid','true');const err=el.closest('.field')?.querySelector('.field-error');if(err)err.textContent=`请输入${min}–${max}之间的数值`;return;}
  el.removeAttribute('aria-invalid');const err=el.closest('.field')?.querySelector('.field-error');if(err)err.textContent='';
  const kind=el.dataset.kind,key=el.dataset.field;
  if(kind==='day')mutableDay()[key]=value;
  if(kind==='food'){mutableDay().foods??={};if(blank)delete mutableDay().foods[key];else mutableDay().foods[key]=value;}
  if(kind==='setting'&&value!==null)state.settings[key]=value;
  if(kind==='label'&&value!==null){state.settings.labels??={};state.settings.labels[el.dataset.food]??={};state.settings.labels[el.dataset.food][key]=value;}
  save();updateLive();
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.setting&&!el.value){el.value=state.settings[el.dataset.setting];toast('时间不能为空，已保留原时间');return;}
  if(el.id==='selected-date'){if(!el.value)return;clearRestOnDate(el.value);selected=el.value;shopPart='';render();return;}
  if(el.id==='planned-start'){if(!el.value){el.value=state.program.plannedStart;return;}state.program.plannedStart=el.value;if(!state.program.startedOn)state.settings.start=el.value;save();toast('预计日期已保存，仍需手动点击开始');return;}
  if(el.id==='training-preview-type'){previewType=el.value;render();return;}
  if(el.id==='training-preview-level'){previewLevel=Number(el.value);render();return;}
  if(el.id==='set-level'){if(trainingView().readOnly||day().trainingPlan)return;mutableDay().setLevel=Number(el.value);save();render();toast('已调整尚未开始记录的本次目标组数');return;}
  if(el.dataset.kind==='training-feedback'){handleTrainingInput(el);return;}
  if(el.id==='vegetable-mode'){state.settings.vegetableMode=el.value;save();render();toast('采购与菜单已一起更新，请核对实际包装标签');return;}
  if(el.dataset.kind==='set-done'){
    if(trainingView().readOnly){el.checked=false;return;}
    const s=trainingSet(el.dataset.ex,Number(el.dataset.set));
    if(el.checked&&(!isValidTrainingSet(s)||s.skipped)){el.checked=false;toast('先填有效重量和整数次数；自重填0kg，余力可留空');return;}
    if(el.checked)ensureTrainingPlan();s.done=el.checked;save();updateLive();return;
  }
  if(el.dataset.kind==='shopping'){const date=el.dataset.cycle;state.shopping[date]??={};state.shopping[date][el.dataset.field]=el.checked;el.closest('.shopping-row').classList.toggle('checked',el.checked);save();const {cycle,rows}=shoppingData();const count=rows.filter(r=>state.shopping[cycle.date]?.[r.food.id]).length;$('#shopping-count').textContent=`${count} / ${rows.length}项已核对`;$('#shopping-progress').style.width=`${count/rows.length*100}%`;}
});
document.addEventListener('click',e=>{
  const dateButton=e.target.closest('[data-date]');if(dateButton){clearRestOnDate(dateButton.dataset.date);selected=dateButton.dataset.date;if(dateButton.dataset.goTraining){page='training';if(location.hash!=='#training')location.hash='training';}render();return;}
  const b=e.target.closest('[data-action]');if(!b)return;
  const action=b.dataset.action;
  if(handleTrainingExtrasAction(b,action))return;
  if(handleTrainingAction(b,action))return;
  if(action==='program-start'||action==='program-pause'||action==='program-resume'){const date=today();if(action==='program-pause')pauseCurrentRest();clearRestOnDate(date);state.program=action==='program-start'?startProgram(state.program,date):action==='program-pause'?pauseProgram(state.program,date):resumeProgram(state.program,date);if(state.program.startedOn)state.settings.start=state.program.startedOn;selected=date;save();render();toast(action==='program-start'?'已开始：今天是第1周第1天':action==='program-pause'?'已暂停，进度冻结，原有记录保留':'已继续，从暂停的计划日接着练');return;}
  if(action==='settings')settings();
  if(action==='close-settings'){$('#settings-dialog').close();render();toast('记录与设置已保存在当前浏览器');}
  if(action==='today'||action==='prev-date'||action==='next-date'){selected=action==='today'?today():addDays(selected,action==='prev-date'?-1:1);clearRestOnDate(selected);shopPart='';render();}
  if(action==='meal-fill'){const d=mutableDay();d.foods??={};for(const f of foodRows(true).filter(f=>f.meal===b.dataset.meal))delete d.foods[f.id];for(const f of foodRows().filter(f=>f.meal===b.dataset.meal))d.foods[f.id]=f.amount;save();render();toast('整餐已按当前计划重填，可继续改成实际克数');}
  if(action==='shop-monday'||action==='shop-friday'){shopPart=action==='shop-monday'?'monday':'friday';render();}
  if(action==='export')exportData();if(action==='export-raw')exportData(true);if(action==='import')$('#import-file').click();
});
$('#import-file').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>2*1024*1024)throw Error('文件超过2MB，请选择本工具导出的JSON。');const parsed=JSON.parse(await file.text());if(!validImport(parsed))throw Error('记录格式不正确：请使用本工具导出的备份；日期、范围和记录结构必须有效。');if(!confirm('导入将替换当前浏览器的全部记录，建议先导出备份。继续导入吗？'))return;state=upgradeState(cleanTrainingSnapshots({...parsed,settings:{...defaults,...parsed.settings}}),'2026-10-21');storageError='';restTimer=null;persistRest();save();$('#settings-dialog').close();render();toast('备份已导入');}catch(error){$('#import-error').textContent=error.message;}finally{e.target.value='';}
});
$('#settings-dialog').addEventListener('cancel',()=>setTimeout(render,0));
function route(){const id=location.hash.slice(1);page=navs.some(([name])=>name===id)?id:'today';render();window.scrollTo({top:0,behavior:'instant'});}
const REST_STORAGE='shoulder-dorm-rest-v1';
let restTimer=null;
try{restTimer=restoreRestTimer(sessionStorage.getItem(REST_STORAGE),Date.now());}catch{}
function persistRest(){try{if(restTimer)sessionStorage.setItem(REST_STORAGE,JSON.stringify(restTimer));else sessionStorage.removeItem(REST_STORAGE);}catch{}}
function clearRestOnDate(date){if(restTimer&&restTimer.date!==date){restTimer=null;persistRest();updateRestTimerUI();}}
function pauseCurrentRest(){if(restTimer){restTimer=pauseRestTimer(restTimer,Date.now());persistRest();updateRestTimerUI();}}
function updateRestTimerUI(){
  const bar=$('#rest-timer-bar');if(!bar)return;
  if(!restTimer){bar.hidden=true;document.body.classList.remove('has-rest-timer');return;}
  const before=restTimer.status;restTimer=restTimerState(restTimer,Date.now());
  if(before==='running'&&restTimer.status==='finished'){persistRest();toast('组间休息结束，按恢复情况开始下一组');}
  bar.hidden=false;document.body.classList.add('has-rest-timer');
  $('#rest-timer-label').textContent=`${restTimer.label} · 组间休息`;
  const seconds=restTimer.remaining;
  $('#rest-timer-clock').textContent=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  $('#rest-toggle').textContent=restTimer.status==='running'?'暂停':restTimer.status==='finished'?'重新开始':restTimer.status==='idle'?'开始':'继续';
  $('#rest-toggle').disabled=state.program.status==='paused';
  const status={running:'倒计时中',paused:'已暂停',idle:'准备计时',finished:'休息结束'}[restTimer.status];
  if($('#rest-timer-state').textContent!==status)$('#rest-timer-state').textContent=status;
  $$('#rest-timer-bar [data-action=rest-preset]').forEach(b=>{b.setAttribute('aria-pressed',Number(b.dataset.seconds)===restTimer.duration?'true':'false');b.disabled=state.program.status==='paused';});
}
function currentTrainingWeek(){return trainingWeekStats(state.days,selected,state.program,today());}
function weekSummaryMarkup(detail=false){return renderTrainingWeek(currentTrainingWeek(),detail);}
function updateWeeklyTraining(){
  const container=$('#weekly-training-live');if(!container)return;
  const wasOpen=container.querySelector('.week-training-details')?.open;
  container.innerHTML=weekSummaryMarkup(page==='trends');
  if(wasOpen&&container.querySelector('.week-training-details'))container.querySelector('.week-training-details').open=true;
}
function handleTrainingExtrasAction(b,action){
  if(action.startsWith('rest-')){
    if(state.program.status==='paused'&&['rest-start','rest-toggle','rest-preset'].includes(action)){toast('计划已暂停，继续计划后再开始休息计时');return true;}
    if(action==='rest-start'){
      if(trainingView().readOnly)return true;
      const ex=exercises().find(e=>e.id===b.dataset.ex);if(!ex)return true;
      restTimer=newRestTimer({date:selected,exerciseId:ex.id,label:ex.name,seconds:defaultRestSeconds(ex)},Date.now());
    }else if(!restTimer)return true;
    else if(action==='rest-toggle')restTimer=restTimer.status==='running'?pauseRestTimer(restTimer,Date.now()):restTimer.status==='finished'?newRestTimer({date:restTimer.date,exerciseId:restTimer.exerciseId,label:restTimer.label,seconds:restTimer.duration},Date.now()):resumeRestTimer(restTimer,Date.now());
    else if(action==='rest-reset')restTimer=resetRestTimer(restTimer,Date.now());
    else if(action==='rest-preset')restTimer=newRestTimer({date:restTimer.date,exerciseId:restTimer.exerciseId,label:restTimer.label,seconds:Number(b.dataset.seconds)},Date.now());
    else if(action==='rest-close')restTimer=null;
    persistRest();updateRestTimerUI();return true;
  }
  if(action==='guide-image'){
    const img=guideImageData(b.dataset.ex,Number(b.dataset.image));if(!img)return true;
    $('#guide-large-image').src=img.src;$('#guide-large-image').alt=img.alt;$('#guide-image-caption').textContent=img.label||img.alt;
    $('#guide-image-dialog').showModal();return true;
  }
  if(action==='guide-image-close'){$('#guide-image-dialog').close();return true;}
  if(action==='guide-play'){
    const panel=b.closest('.guide-video-panel'),video=panel.querySelector('video'),message=panel.querySelector('.guide-media-message');
    if(!video.src){video.src=video.dataset.videoSrc;video.load();}
    video.currentTime=0;video.play().then(()=>{message.textContent='可随时暂停；收起教学会停止播放。';}).catch(()=>{message.textContent='暂时无法播放，可继续看起止姿势和动作要领，或打开下方专业教程。';});return true;
  }
  return false;
}
function initializeTrainingExtras(){
  document.body.insertAdjacentHTML('beforeend',renderRestTimerBar()+`<dialog id="guide-image-dialog" aria-labelledby="guide-image-caption"><div class="dialog-top"><h2 id="guide-image-caption">动作图片</h2><button class="icon-button" data-action="guide-image-close" aria-label="关闭大图">×</button></div><img id="guide-large-image" alt=""></dialog>`);
  document.addEventListener('toggle',e=>{if(e.target.tagName==='DETAILS'&&!e.target.open)e.target.querySelectorAll('video').forEach(v=>v.pause());},true);
  document.addEventListener('error',e=>{
    if(e.target.tagName==='VIDEO'){const message=e.target.closest('.guide-video-panel')?.querySelector('.guide-media-message');if(message)message.textContent='示范暂时无法加载，静态图片和文字仍可使用；完整教学见来源链接。';}
    if(e.target.matches('.guide-gallery img')){const caption=e.target.closest('button')?.querySelector('span');if(caption)caption.textContent='图片暂不可用，请阅读下方动作要领';}
  },true);
  document.addEventListener('visibilitychange',updateRestTimerUI);
  window.addEventListener('pageshow',updateRestTimerUI);
  setInterval(()=>{if(restTimer?.status==='running')updateRestTimerUI();},500);
  updateRestTimerUI();
}

initializeTrainingExtras();
window.addEventListener('hashchange',route);route();
