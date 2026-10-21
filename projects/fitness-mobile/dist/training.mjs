export const EXERCISES={
  pulldown:{name:'高位下拉',sets:3,min:8,max:12,tip:'拉向胸前，身体少晃；不做颈后下拉。',rest:'2分钟'},
  chest:{name:'器械胸推',sets:3,min:8,max:12,tip:'调好座椅，控制回放，不弹起重量。',rest:'2分钟'},
  pecfly:{name:'器械蝴蝶机夹胸',sets:2,min:12,max:15,tip:'轻重量控制回放，在胸肩舒适范围内合拢；不勉强拉到过深。',rest:'60–90秒'},
  row:{name:'坐姿划船',sets:3,min:8,max:12,tip:'手肘向后，不靠腰部甩动。',rest:'2分钟'},
  lateral:{name:'哑铃侧平举',sets:3,min:12,max:20,tip:'轻重量，接近肩高；不耸肩甩动。记录单只哑铃重量。',rest:'60–90秒'},
  legpress:{name:'腿举',sets:2,min:10,max:15,tip:'背与骨盆贴稳靠垫，膝盖朝脚尖方向。',rest:'2分钟'},
  legcurl:{name:'坐姿腿弯举',sets:2,min:10,max:15,tip:'控制伸回，不让配重砸落。',rest:'60–90秒'},
  crunch:{name:'绳索卷腹',sets:2,min:10,max:15,tip:'用腹部卷动躯干，不靠手臂拉绳。',rest:'60–90秒'},
  shoulder:{name:'器械肩推',sets:2,min:8,max:12,tip:'调好座椅，避免腰部过度后仰。',rest:'2分钟'},
  bridge:{name:'臀桥',sets:2,min:10,max:15,tip:'先自重（填0kg），收紧臀部，不用腰向上顶。',rest:'2分钟'},
  reversefly:{name:'反向蝴蝶机飞鸟',sets:2,min:12,max:20,tip:'练肩后侧，轻重量、少耸肩。',rest:'60–90秒'},
  reversecrunch:{name:'仰卧反向卷腹',sets:2,min:10,max:15,tip:'骨盆轻轻卷离垫子，不甩腿。自重填0kg。',rest:'60–90秒'}
};
export const WORKOUT_NAMES={UA:'胸肩',LA:'背腹',UB:'胸背',LB:'肩腹＋少量腿',A:'全身 A（旧计划）',B:'全身 B（旧计划）'};
export const WORKOUTS={
  UA:['chest','pecfly','shoulder','lateral','reversefly'],
  LA:['pulldown','row','reversecrunch'],
  UB:['chest','pulldown','row','lateral','reversefly','crunch'],
  LB:['shoulder','lateral','legpress','legcurl','bridge','reversecrunch']
};
const LEGACY_WORKOUTS={A:['pulldown','chest','row','lateral','legpress','legcurl','crunch'],B:['shoulder','row','chest','lateral','bridge','reversefly','reversecrunch']};
const SET_OVERRIDES={LB:{bridge:1},A:{chest:2,row:2},B:{chest:2}};
export function exercisePlan(type,level=3){return (WORKOUTS[type]||LEGACY_WORKOUTS[type]||[]).map(id=>({...EXERCISES[id],id,sets:Math.min(level,SET_OVERRIDES[type]?.[id]??EXERCISES[id].sets)}));}
