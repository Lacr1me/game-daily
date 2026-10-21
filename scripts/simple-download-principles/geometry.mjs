import * as k from './vendor/anatomy/iso-kit.mjs';
import * as A from './vendor/anatomy/audit.mjs';

export function makeMachine({audit=false}={}) {
  const base={x:-181,y:-70,w:362,d:140,r:8};
  const P=k.fitProjection(k.boxCorners(base,-18,64),960,570,{pad:66,azimuth:61,elevation:32});
  const R=A.recorder(P);
  const L=(d,tone='lo',free=false)=>k.lineSvg(d,{tone,free});
  const S=k.solidSvg;
  const positions=[-145,-87,-29,29,87,145];
  const screws=(p,z,inset=4)=>{
    const c=k.corners(p,inset);
    return L(c.map(([x,y])=>k.ring(x,y,1.2,z,P,16)).join(''),'lo')+k.dotsSvg(c.map(([x,y])=>k.iso([x,y,z],P)),{size:.42,tone:'mid'});
  };
  function slab(name,p,z,h,{stage=-1,tone='mid',detail='',carriage=false,bevel=.5}={}) {
    const paths=k.slabOf(p,z,h,P,5,bevel);
    const shape=R.solid(A.slab(p,z,h,{name,owner:carriage?'carriage':name},5));
    R.put({name,piece:carriage?'carriage':name,at:[p.x+p.w/2,p.y+p.d/2,z+h/2],move:carriage?[290,0,0]:[0,0,0],shapes:[shape],svg:`<g class="component${carriage?' payload':''}" data-stage="${stage}" data-piece="${name}">${S(paths,{tone,inner:detail})}</g>`});
  }
  function round(name,x,y,r,z,h,stage=-1){
    const shape=R.solid(A.cylinder(x,y,r,z,h,{name,owner:name}));
    R.put({name,piece:name,at:[x,y,z+h/2],shapes:[shape],svg:`<g class="component" data-stage="${stage}">${S(k.cylinder(x,y,r,z,h,P,32,.35),{tone:'mid',inner:L(k.ring(x,y,r-1,z+h,P,32),'lo')+k.dotsSvg([k.iso([x,y,z+h],P)],{size:.6})})}</g>`});
  }
  for(const [i,[x,y]] of k.corners(base,23).entries()){
    slab('stand.foot'+i,{x:x-8,y:y-7,w:16,d:14,r:3},-18,3,{tone:'lo'});
    slab('stand.leg'+i,{x:x-5,y:y-4,w:10,d:8,r:1},-15,6,{tone:'mid'});
  }
  slab('stand.base',base,-9,9,{tone:'lo',bevel:1.2,detail:L(k.planOutline(k.insetPlan(base,5),0,P),'faint')+screws(base,0,11)});
  for(const y of [4,38]){
    slab('stand.rail-bed'+y,{x:-169,y:y-2,w:338,d:8,r:2},0,3,{tone:'lo'});
    const rail={x:-169,y,w:338,d:4,r:.7};
    slab('rail'+y,rail,3,5,{tone:'hi',detail:L(k.planOutline(k.insetPlan(rail,.75),8,P),'faint')});
  }
  for(const x of [-174,169])slab('stop'+x,{x,y:2,w:5,d:44,r:1},0,11,{detail:screws({x,y:2,w:5,d:44,r:1},11,1.5)});
  const ruler={x:-165,y:57,w:330,d:6,r:.7};
  let ticks='';
  for(let x=-161,i=0;x<164;x+=4,i++)ticks+=L(k.lineOnTop([x,57],[x,57+(i%5===0?4:2)],.5,P),i%5===0?'mid':'lo');
  slab('ruler',ruler,0,.5,{tone:'lo',detail:ticks,bevel:0});
  const label={x:-15,y:-65,w:56,d:10,r:1};
  slab('nameplate',label,0,.8,{tone:'lo',detail:screws(label,.8,2)+k.faceTextSvg(k.topMatrix([-10,-59],.8,P),'SIMPLE DOWNLOAD',{size:3,tone:'mid',anchor:'start'})});
  for(const [i,x] of positions.entries()){
    const p={x:x-24,y:-51,w:48,d:42,r:3};
    slab('station-'+i,p,0,3,{stage:i,tone:'lo',detail:screws(p,3,4)});
  }
  // Receiving tray: real paper sheets between physical side stops.
  slab('input.tray',{x:-163,y:-44,w:36,d:30,r:2},3,3,{stage:0});
  slab('input.left',{x:-163,y:-44,w:3,d:30,r:.6},6,8,{stage:0});
  slab('input.right',{x:-130,y:-44,w:3,d:30,r:.6},6,8,{stage:0});
  for(let i=0;i<3;i++){
    const p={x:-158+i*.7,y:-40+i*.7,w:25,d:22,r:.7};
    const detail=i===2?[0,1,2].map(n=>L(k.lineOnTop([p.x+3,p.y+5+n*4],[p.x+19-(n===2?5:0),p.y+5+n*4],6+(i+1)*.8,P),'lo',true)).join(''):'';
    slab('input.paper'+i,p,6+i*.8,.8,{stage:0,tone:'hi',detail,bevel:0});
  }
  // Scanner gate: bridge seated on two posts, with an optical head beneath it.
  slab('scanner.front-mount',{x:-95,y:44,w:16,d:11,r:2},0,3,{stage:1,detail:screws({x:-95,y:44,w:16,d:11,r:2},3,3)});
  for(const y of [-39,46])slab('scanner.post'+y,{x:-91,y,w:8,d:7,r:1},3,43,{stage:1,detail:L(k.sideSeam({x:-91,y,w:8,d:7,r:1},12,P,5),'faint')});
  slab('scanner.bridge',{x:-94,y:-39,w:14,d:92,r:2},46,7,{stage:1,detail:screws({x:-94,y:-39,w:14,d:92,r:2},53,4)});
  slab('scanner.head',{x:-101,y:12,w:28,d:21,r:2},35,11,{stage:1,tone:'hi'});
  slab('scanner.lens',{x:-97,y:15,w:20,d:15,r:1},33,2,{stage:1,tone:'hi',detail:L(k.planOutline({x:-94,y:18,w:14,d:9,r:.4},35,P),'mid')});
  // Scheduler cabinet with visible queue slots and a control crown.
  const control={x:-48,y:-45,w:38,d:29,r:3};
  slab('queue.case',control,3,25,{stage:2,detail:L(k.sideSeam(control,9,P,5),'lo')});
  slab('queue.lid',control,28,2,{stage:2,tone:'hi',detail:screws(control,30,4)});
  slab('queue.display',{x:-42,y:-40,w:18,d:18,r:1.5},30,.6,{stage:2,tone:'lo'});
  for(let i=0;i<3;i++)slab('queue.slot'+i,{x:-40,y:-38+i*5,w:14-i*2,d:2,r:.5},30.6,.5,{stage:2,tone:'mid',bevel:0});
  round('queue.crown',-17,-28,4,30,3,2);
  // Four removable channels are an illustration, not a claimed connection count.
  slab('transfer.deck',{x:6,y:-45,w:46,d:30,r:2},3,3,{stage:3});
  for(let i=0;i<4;i++){
    const p={x:9+i*10,y:-41,w:7,d:22,r:.8};
    const vents=[0,1,2].map(j=>L(k.planOutline({x:p.x+1.4,y:-37+j*4.5,w:4.2,d:1.5,r:.5},24,P),'lo')).join('');
    slab('transfer.channel'+i,p,6,18,{stage:3,tone:'hi',detail:vents});
  }
  slab('transfer.retainer-a',{x:8,y:-44,w:42,d:3,r:.6},6,5,{stage:3});
  slab('transfer.retainer-b',{x:8,y:-18,w:42,d:3,r:.6},6,5,{stage:3});
  slab('transfer.indicator',{x:22,y:-49,w:14,d:3,r:.5},3,2,{stage:3,tone:'hi'});
  // Media finishing press, open below the tool so the tray passes through.
  slab('processor.mount',{x:77,y:44,w:20,d:11,r:2},0,3,{stage:4,detail:screws({x:77,y:44,w:20,d:11,r:2},3,3)});
  for(const y of [-39,46])slab('processor.post'+y,{x:82,y,w:10,d:7,r:1},3,35,{stage:4});
  slab('processor.bridge',{x:78,y:-39,w:18,d:92,r:2},38,9,{stage:4,detail:screws({x:78,y:-39,w:18,d:92,r:2},47,4)});
  slab('processor.tool',{x:70,y:8,w:34,d:28,r:2},27,11,{stage:4,tone:'hi'});
  const cap={x:73,y:11,w:28,d:22,r:1};
  slab('processor.cap',cap,47,3,{stage:4,tone:'hi',detail:[0,1,2,3].map(j=>L(k.planOutline({x:77+j*5,y:14,w:2,d:16,r:.6},50,P),'lo')).join('')});
  // Archive rack: base, three walls, two shelves and one pull-out drawer.
  slab('archive.floor',{x:123,y:-45,w:44,d:32,r:1},3,3,{stage:5});
  for(const x of [123,164])slab('archive.side'+x,{x,y:-45,w:3,d:32,r:.6},6,37,{stage:5});
  slab('archive.back',{x:126,y:-45,w:38,d:3,r:.6},6,37,{stage:5});
  for(const z of [17,30])slab('archive.shelf'+z,{x:126,y:-42,w:38,d:29,r:.6},z,2,{stage:5,tone:'hi'});
  slab('archive.drawer',{x:128,y:-40,w:34,d:29,r:1},6,9,{stage:5,tone:'hi'});
  slab('archive.pull',{x:138,y:-11,w:14,d:3,r:.7},9,3,{stage:5});
  // Payload rests on the rail tops. Its whole assembly shares one translation.
  const p={x:-160,y:4,w:30,d:38,r:2};
  slab('carriage.deck',p,8,3,{carriage:true,tone:'hi',detail:screws(p,11,3)});
  for(const y of [5,38])slab('carriage.locator'+y,{x:-156,y,w:22,d:3,r:.5},11,2,{carriage:true,tone:'mid'});
  slab('carriage.paper',{x:-155,y:11,w:20,d:24,r:1},11,1,{carriage:true,tone:'hi'});
  slab('carriage.cover',{x:-154,y:12,w:18,d:22,r:1},12,.6,{carriage:true,tone:'hi',detail:[0,1,2].map(n=>L(k.lineOnTop([-151,17+n*4],[-139+(n===2?-4:0),17+n*4],12.6,P),'hi',true)).join('')});
  const states=Array.from({length:21},(_,i)=>({label:`travel-${i}`,shares:{carriage:i/20}}));
  A.settle(R,P,{states,step:.25});
  R.items.sort((a,b)=>a.key-b.key);
  if(audit)A.auditOrExit(R,P,{argv:['--audit'],frames:states,apart:states.at(-1)});
  const halo=`<path class="iso-halo" d="${k.haloOf(base,-18,16,P)}"/>`;
  const body=halo+R.items.map((item,i)=>`<g data-order="${i}" data-moving="${item.piece==='carriage'}">${item.svg}</g>`).join('');
  const svg=k.figureSvg({width:960,height:570,label:'精密下载加工台：文件托盘沿导轨经过接入、识别、调度、传输、处理和归档六个工作位',body});
  return {svg,P,positions,partCount:R.items.length,sort:R.items.map((item,i)=>({i,key:item.key,lift:item.piece==='carriage'?k.depthOf([290,0,0],P):0})),isoCss:k.ISO_CSS};
}
