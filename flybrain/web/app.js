// app.js — draws 139,255 real neurons and the 2D arena they steer.
const $ = (s) => document.querySelector(s);
const post = (o) => fetch('/api/cmd', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(o)});

let META=null, N=0, PX=null, SUPER=null, SIDE=null;
const brain=$('#brain'), fx=$('#brainfx'), arena=$('#arena'), retina=$('#retina');
const bctx=brain.getContext('2d'), fctx=fx.getContext('2d',{willReadFrequently:false});
const actx=arena.getContext('2d'), rctx=retina.getContext('2d');
let INTENS=null, IMG=null, tool='sugar'; const COUNT={};

// FlyWire super_class -> colour
const SUPER_COL = {
  optic:[46,86,140], central:[120,96,168], sensory:[228,168,64], visual_projection:[52,132,176],
  ascending:[96,168,132], descending:[226,92,104], sensory_ascending:[208,140,80],
  visual_centrifugal:[72,112,160], motor:[240,86,120], endocrine:[150,150,150]
};
const SUPER_FA = {
  optic:'لوب بینایی', central:'مرکزی', sensory:'حسی', visual_projection:'فرافکن بینایی',
  ascending:'صعودی', descending:'نزولی (فرمان حرکت)', sensory_ascending:'حسی-صعودی',
  visual_centrifugal:'گریز از مرکز بینایی', motor:'حرکتی', endocrine:'غدد درون‌ریز'
};
const POP_FA = {
  photoreceptor:'گیرنده‌های نوری', orn:'گیرنده‌های بویایی', mechano:'مکانوحسی',
  visual_projection:'فرافکن بینایی LC', kenyon:'سلول‌های کنیون', central_complex:'کمپلکس مرکزی',
  mbon:'MBON', dan:'دوپامینرژیک', dn:'نورون‌های نزولی', motor:'نورون‌های حرکتی',
  feeding:'مدار تغذیه (کالیبره)', grooming:'مدار گرومینگ (کالیبره)'
};
const STIM_GROUPS = [
  ['sugar_grn','GRN شکر'], ['bitter_grn','GRN تلخ'], ['water_grn','GRN آب'],
  ['orn_left','بویایی چپ'], ['orn_right','بویایی راست'],
  ['mechano_left','مکانوحسی چپ'], ['mechano_right','مکانوحسی راست'],
  ['dn_left','نزولی چپ'], ['dn_right','نزولی راست'],
];
const SLIDERS = [
  ['vpn_hz','بینایی → نورون‌های فرافکن LC (Hz)',0,200,5],
  ['photo_hz','بینایی → فوتورسپتورها (Hz)',0,80,1],
  ['taste_hz','چشایی (Hz)',0,260,5],
  ['touch_hz','لامسه/موبرس (Hz)',0,200,5],
  ['olf_hz','بویایی (Hz) — هشدار: واگرایی MB',0,120,5],
  ['wind_hz','باد/جانستون (Hz)',0,150,5],
  ['noise_hz','نویز خودبه‌خودی (Hz)',0,5,0.1],
  ['adapt_mV','سازش شلیک (mV) — ۰ = دقیقاً مقالهٔ Shiu',0,0.4,0.01],
  ['walk_gain','بهرهٔ راه‌رفتن',0,2,0.05],
  ['turn_gain','بهرهٔ چرخش',0,3,0.05],
  ['turn_sign','جهت چرخش: ۱ اجتناب، ۱- نزدیک‌شدن',-1,1,2],
];

function decodeSpikes(b64){
  const bin=atob(b64), n=bin.length, out=new Int32Array(n);
  let prev=0, i=0, k=0;
  while(i<n){
    let shift=0, d=0, byte;
    do{ byte=bin.charCodeAt(i++); d |= (byte & 0x7f) << shift; shift+=7; } while(byte & 0x80);
    prev += d; out[k++] = prev;
  }
  return out.subarray(0,k);
}

async function boot(){
  META = await (await fetch('/api/meta')).json();
  const buf = await (await fetch('/api/neurons.bin')).arrayBuffer();
  const dv = new DataView(buf);
  N = buf.byteLength/8;
  $('#counts').textContent =
    `${N.toLocaleString('en')} neurons · ${META.n_edges.toLocaleString('en')} connections · ${META.n_synapses.toLocaleString('en')} synapses · FlyWire FAFB v783`;

  // pixel position of every neuron (frontal view: x mediolateral, y dorsoventral)
  const W=brain.width, H=brain.height, pad=14;
  PX = new Int32Array(N); SUPER = new Uint8Array(N); SIDE = new Uint8Array(N);
  const bg = bctx.createImageData(W,H); const d = bg.data;
  for(let i=0;i<W*H;i++){ d[i*4+3]=255; }
  for(let i=0;i<N;i++){
    const x = dv.getUint16(i*8,   true)/65535;
    const y = dv.getUint16(i*8+2, true)/65535;
    const s = dv.getUint8(i*8+4);
    SUPER[i]=s; SIDE[i]=dv.getUint8(i*8+6);
    const px = Math.round(pad + x*(W-2*pad));
    const py = Math.round(pad + y*(H-2*pad));
    const p = py*W+px; PX[i]=p;
    COUNT[s]=(COUNT[s]|0)+1;
    const c = SUPER_COL[META.labels.super_class[s]] || [90,90,90];
    const o=p*4;
    d[o]  =Math.min(255, d[o]  + c[0]*0.34);
    d[o+1]=Math.min(255, d[o+1]+ c[1]*0.34);
    d[o+2]=Math.min(255, d[o+2]+ c[2]*0.34);
  }
  bctx.putImageData(bg,0,0);
  INTENS = new Float32Array(W*H);
  IMG = fctx.createImageData(W,H);

  $('#legend').innerHTML = META.labels.super_class.map((s,i)=>{
    const c=SUPER_COL[s]||[90,90,90];
    return `<span><i style="background:rgb(${c})"></i>${SUPER_FA[s]||s} · ${(COUNT[i]||0).toLocaleString('en')}</span>`;
  }).join('');

  $('#stims').innerHTML = STIM_GROUPS.map(([g,fa])=>
    `<div class="stim"><span>${fa} <em style="color:#7a879f;font-style:normal">${(META.group_sizes[g]||0)}</em></span>
     <input type="range" min="0" max="200" step="10" value="0" data-stim="${g}">
     <em class="v" style="font-family:ui-monospace;color:#7a879f;direction:ltr">0</em></div>`).join('');
  $('#sliders').innerHTML = SLIDERS.map(([k,fa,a,b,st])=>
    `<div class="sl"><label>${fa} <b data-v="${k}">${META.cfg[k]}</b></label>
     <input type="range" min="${a}" max="${b}" step="${st}" value="${META.cfg[k]}" data-cfg="${k}"></div>`).join('')
    + `<div class="sl"><label>میلی‌ثانیهٔ مغز در هر فریم <b data-v="ms">${META.ms_per_frame}</b></label>
       <input type="range" min="4" max="80" step="2" value="${META.ms_per_frame}" data-speed="1"></div>`;
  $('#note').innerHTML = `مدل: LIF مطابق Shiu و همکاران، Nature 2024 —
    V<sub>rest</sub> ${META.params.V_rest}mV · آستانه ${META.params.V_thresh}mV ·
    τ<sub>mbr</sub> ${META.params.T_mbr}ms · τ<sub>syn</sub> ${META.params.tau}ms ·
    تأخیر ${META.params.T_dly}ms · وزن هر سیناپس ${META.params.W_syn}mV · dt ${META.dt}ms.
    علامت تحریکی/مهاری از پیش‌بینی ناقل عصبی (Eckstein و همکاران ۲۰۲۴).`;

  wire();
  stream();
}

function wire(){
  document.querySelectorAll('.tool').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.tool').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); tool=b.dataset.kind;
  });
  document.querySelectorAll('.graph').forEach(b=>b.onclick=()=>{
    document.querySelectorAll('.graph').forEach(x=>x.classList.remove('sel'));
    b.classList.add('sel'); post({cmd:'graph', value:b.dataset.g});
  });
  $('#btn-reset-obj').onclick=()=>post({cmd:'reset_objects'});
  $('#btn-clear').onclick=()=>post({cmd:'clear'});
  $('#btn-reset-brain').onclick=()=>post({cmd:'reset_brain'});
  let paused=false;
  $('#btn-pause').onclick=()=>{ paused=!paused; post({cmd:'pause', value:paused}); $('#btn-pause').textContent = paused?'ادامه':'توقف'; };

  document.body.addEventListener('input', e=>{
    const t=e.target;
    if(t.dataset.stim){ t.parentElement.querySelector('.v').textContent=t.value; post({cmd:'stim', group:t.dataset.stim, hz:+t.value}); }
    if(t.dataset.cfg){ document.querySelector(`b[data-v="${t.dataset.cfg}"]`).textContent=t.value; post({cmd:'cfg', key:t.dataset.cfg, value:+t.value}); }
    if(t.dataset.speed){ document.querySelector('b[data-v="ms"]').textContent=t.value; post({cmd:'speed', value:+t.value}); }
  });

  const toWorld = (ev)=>{
    const r=arena.getBoundingClientRect();
    return [ (ev.clientX-r.left)/r.width*META.arena[0], (ev.clientY-r.top)/r.height*META.arena[1] ];
  };
  arena.addEventListener('click', ev=>{ const [x,y]=toWorld(ev); post({cmd:'place', kind:tool, x, y}); });
  arena.addEventListener('contextmenu', ev=>{ ev.preventDefault(); const [x,y]=toWorld(ev); post({cmd:'fly', x, y}); });
}

// ------------------------------------------------------------------ drawing
function drawBrain(spk){
  const W=brain.width, H=brain.height, d=IMG.data;
  for(let i=0;i<INTENS.length;i++) INTENS[i]*=0.74;
  for(let k=0;k<spk.length;k++){
    const p=PX[spk[k]];
    INTENS[p]=Math.min(1.6, INTENS[p]+1.0);
  }
  for(let p=0,o=0;p<INTENS.length;p++,o+=4){
    const v=INTENS[p];
    if(v<0.02){ d[o]=0; d[o+1]=0; d[o+2]=0; d[o+3]=0; continue; }
    const t=Math.min(1,v);
    d[o]  = 255*Math.min(1, 0.35+t);         // white-hot core
    d[o+1] = 255*Math.min(1, 0.95*t*t+0.25*t);
    d[o+2] = 255*Math.min(1, 0.55*t*t*t+0.12*t);
    d[o+3] = 255*Math.min(1, 0.45+0.55*t);
  }
  fctx.putImageData(IMG,0,0);
}

function drawArena(f){
  const W=arena.width, H=arena.height, sx=W/META.arena[0], sy=H/META.arena[1];
  actx.fillStyle='#080b12'; actx.fillRect(0,0,W,H);
  actx.strokeStyle='#182033'; actx.lineWidth=1;
  for(let x=0;x<=META.arena[0];x+=4){ actx.beginPath(); actx.moveTo(x*sx,0); actx.lineTo(x*sx,H); actx.stroke(); }
  for(let y=0;y<=META.arena[1];y+=4){ actx.beginPath(); actx.moveTo(0,y*sy); actx.lineTo(W,y*sy); actx.stroke(); }

  // odour field from sugar sources
  for(const o of f.obj){
    if(o.k!=='sugar' || o.a<=0.01) continue;
    const g=actx.createRadialGradient(o.x*sx,o.y*sy,0,o.x*sx,o.y*sy,7*sx);
    g.addColorStop(0,'rgba(126,242,157,0.14)'); g.addColorStop(1,'rgba(126,242,157,0)');
    actx.fillStyle=g; actx.beginPath(); actx.arc(o.x*sx,o.y*sy,7*sx,0,7); actx.fill();
  }
  // trail
  actx.strokeStyle='rgba(94,224,192,0.5)'; actx.lineWidth=1.3; actx.beginPath();
  f.trail.forEach(([x,y],i)=> i?actx.lineTo(x*sx,y*sy):actx.moveTo(x*sx,y*sy));
  actx.stroke();

  const COL={sugar:'#7ef29d', bitter:'#ff5f6d', water:'#61c9ff', pillar:'#6b7590'};
  for(const o of f.obj){
    actx.globalAlpha = o.k==='pillar' ? 1 : Math.max(0.15, o.a);
    actx.fillStyle=COL[o.k]||'#888';
    actx.beginPath(); actx.arc(o.x*sx,o.y*sy,o.r*sx,0,7); actx.fill();
    actx.globalAlpha=1;
  }

  // the fly
  const {x,y,th,prob,groom}=f.fly;
  actx.save(); actx.translate(x*sx,y*sy); actx.rotate(th);
  actx.fillStyle='#e8eeff';
  actx.beginPath(); actx.moveTo(1.5*sx,0); actx.lineTo(-1.0*sx,0.62*sy); actx.lineTo(-0.55*sx,0); actx.lineTo(-1.0*sx,-0.62*sy);
  actx.closePath(); actx.fill();
  if(prob>0.05){ actx.strokeStyle='#ffb347'; actx.lineWidth=2; actx.beginPath();
    actx.moveTo(1.4*sx,0); actx.lineTo((1.4+1.5*prob)*sx,0); actx.stroke(); }
  if(groom>0.12){ actx.strokeStyle='rgba(255,179,71,'+groom+')'; actx.lineWidth=1.5;
    actx.beginPath(); actx.arc(0,0,2.2*sx,0,7); actx.stroke(); }
  actx.restore();

  // retina strip: what the eyes see, 96 azimuth columns
  const lum=f.sens.lum||[], n=lum.length, cw=retina.width/n;
  for(let i=0;i<n;i++){
    const v=Math.round(255*Math.max(0,Math.min(1,lum[i])));
    rctx.fillStyle=`rgb(${v},${v},${Math.min(255,v+18)})`;
    rctx.fillRect(i*cw,0,Math.ceil(cw),retina.height);
  }
  rctx.fillStyle='rgba(94,224,192,.85)'; rctx.fillRect(retina.width/2-1,0,2,retina.height);
}

function drawPanels(f){
  $('#pill-t').textContent = `t = ${(f.t/1000).toFixed(2)} s`;
  $('#pill-speed').textContent = `${f.wall_ms} ms/frame · ${(f.speed_ratio*100).toFixed(0)}% real-time`;
  $('#pill-spk').textContent = `${f.n_spk.toLocaleString('en')} spikes / ${f.steps} steps`;

  $('#rates').innerHTML = Object.entries(f.pops).map(([k,v])=>
    `<div class="rate"><b>${v.toFixed(1)} Hz</b><span>${POP_FA[k]||k}</span></div>`).join('')
    + `<div class="rate"><b>${f.fly.meals}</b><span>وعده‌های خورده‌شده</span></div>`
    + `<div class="rate"><b>${f.n_unique.toLocaleString('en')}</b><span>نورون فعال در فریم</span></div>`;

  const bars=[
    ['نزولی چپ', f.motor.dn_left, 20, '#5ee0c0'],
    ['نزولی راست', f.motor.dn_right, 20, '#5ee0c0'],
    ['خرطوم / تغذیه', f.motor.mn9, 25, '#ffb347'],
    ['فرمان گرومینگ', f.motor.groom, 20, '#c69cff'],
    ['سرعت (mm/s)', f.fly.v, 16, '#8fb7ff'],
    ['بوی چپ/راست', (f.sens.odour[0]-f.sens.odour[1]+1)/2*10, 10, '#7ef29d'],
  ];
  $('#motorbars').innerHTML = bars.map(([n,v,mx,c])=>
    `<div class="mb"><span>${n}</span><div class="track"><div class="fill" style="width:${Math.min(100,100*v/mx)}%;background:${c}"></div></div><em>${(+v).toFixed(1)}</em></div>`).join('');
}

function stream(){
  const es = new EventSource('/api/stream');
  es.onmessage = (e)=>{
    const f = JSON.parse(e.data);
    drawBrain(decodeSpikes(f.spk));
    drawArena(f);
    drawPanels(f);
  };
  es.onerror = ()=>{ setTimeout(()=>location.reload(), 2500); };
}

boot();
