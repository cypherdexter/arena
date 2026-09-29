/* Runner Scout per GitHub Actions. Produce scout-data.json (letto dalla pagina) e invia avvisi Telegram.
   Uso: node scout-run.js            → analisi completa + regime (ogni 6 ore)
        node scout-run.js regime     → solo regime (ogni ora) */
const fs=require("fs");
const C=require("./scout-core.js");
const FILE="scout-data.json";
let MODE=process.argv[2]||"full";
C.hook.status=m=>console.log(new Date().toISOString().slice(11,19),m);
C.hook.cgKey=process.env.COINGECKO_KEY||null;

function readPrev(){try{return JSON.parse(fs.readFileSync(FILE,"utf8"))}catch(e){return null}}
async function telegram(text){
  const tok=process.env.TELEGRAM_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  if(!tok||!chat){console.log("Telegram non configurato; messaggio:\n"+text);return}
  try{const r=await fetch(`https://api.telegram.org/bot${tok}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chat,text,parse_mode:"HTML",disable_web_page_preview:true})});console.log("Telegram",r.status)}catch(e){console.log("Telegram errore",e.message)}
}
const lbl=s=>s==="COMPRA"?"Compra ora":s==="ATTENDI"?"Attendi":"Evita";

(async()=>{
  const prev=readPrev()||{};
  // modalità auto: analisi completa se l'ultima ha più di 5,5 ore, altrimenti solo regime.
  // Serve perché le schedulazioni di GitHub Actions saltano o ritardano: ogni corsa che parte fa la cosa giusta.
  if(MODE==="auto"){const age=prev.analyzed?(Date.now()-Date.parse(prev.analyzed))/36e5:99;MODE=age>=5.5||!prev.results?"full":"regime";console.log("auto →",MODE,"(ultima analisi",age.toFixed(1),"ore fa)")}
  const data={...prev,generated:new Date().toISOString()};
  const msgs=[];
  data.lastError=null;
  if(MODE==="full"){try{
    const A=await C.analyze();
    const PREV=prev.prev||{},LEDGER=prev.ledger||[];
    const alerts=C.applyRun(A.out,A.btc.current_price,PREV,LEDGER);
    // serie prezzi compresse: solo nucleo + Compra ora + Attendi con score alto (servono al Monte Carlo)
    const keep=new Set(["bitcoin","ethereum","solana","binancecoin",...A.out.filter(r=>r.state==="COMPRA"||(r.state==="ATTENDI"&&r.total>=60)).map(r=>r.id)]);
    const CL={};for(const id of keep)if(A.CL[id])CL[id]=A.CL[id].slice(-400).map(v=>+v.toPrecision(6));
    Object.assign(data,{analyzed:new Date().toISOString(),results:A.out,sectors:A.S,prev:PREV,ledger:LEDGER,cl:CL,fails:A.fails,alerts});
    const buys=alerts.filter(a=>a.to==="COMPRA"),exits=alerts.filter(a=>a.from==="COMPRA");
    if(buys.length)msgs.push("🟢 <b>Nuovi Compra ora</b>\n"+buys.map(a=>{const r=A.out.find(x=>x.id===A.out.find(y=>y.sym===a.sym)?.id);return `• <b>${a.sym}</b> a ${C.px(a.price)} — ${r?r.trig:""}`}).join("\n"));
    if(exits.length)msgs.push("🟠 <b>Usciti da Compra ora</b>\n"+exits.map(a=>`• ${a.sym} → ${lbl(a.to)} a ${C.px(a.price)}`).join("\n"));
    const S=A.S&&A.S.list||[];const em=S.filter(s=>s.phase==="Emergente");const pe=(prev.sectors&&prev.sectors.list||[]).filter(s=>s.phase==="Emergente").map(s=>s.id);
    const newEm=em.filter(s=>!pe.includes(s.id));
    if(newEm.length)msgs.push("🔎 <b>Narrative emergenti</b>\n"+newEm.map(s=>`• ${s.name}: ${C.pc(s.r7)} vs BTC a 7gg (leader ${s.top.join(" ")})`).join("\n"));
    console.log(`Analisi: ${A.out.length} token, ${A.fails} senza candele, ${alerts.length} cambi di stato`);
  }catch(e){console.error("analisi fallita:",e);data.lastError="analisi: "+e.message;msgs.push("⚠️ Analisi completa fallita: "+e.message+". Riprovo alla prossima corsa.")}}
  // regime (sempre)
  let R;try{R=await C.computeRegime(data.cl||{},prev.regime||null)}catch(e){console.error("regime fallito:",e);data.lastError=(data.lastError?data.lastError+"; ":"")+"regime: "+e.message;R=prev.regime||{exposure:60,cycle:{ini:.33,mid:.34,fine:.33},parts:[],d:new Date().toISOString()}}
  const prevR=prev.regime;
  data.regime=R;
  if(prevR){
    if(Math.abs(R.exposure-prevR.exposure)>=15)msgs.push(`⚖️ <b>Esposizione ${prevR.exposure}% → ${R.exposure}%</b>\n`+R.parts.map(p=>`• ${p.k}: ${p.v}`).join("\n"));
    if(R.hot&&!prevR.hot)msgs.push(`🔥 <b>Derivati surriscaldati</b>: funding medio ${R.fund.toFixed(0)}% annuo. Sospendi i nuovi acquisti.`);
    if(!R.hot&&prevR.hot)msgs.push("❄️ Derivati rientrati: acquisti di nuovo consentiti.");
    if(R.cycle.fine>0.5&&!(prevR.cycle&&prevR.cycle.fine>0.5))msgs.push("⏳ <b>Fine ciclo probabile</b>: attiva le uscite anticipate.");
  }
  // portafoglio simulato (10.000 USDC): acquisti/vendite con fee e slippage
  try{
    let prices={};
    if(data.results){for(const r of data.results)prices[r.id]=r.price}
    if(MODE!=="full"&&data.paper){const ids=Object.keys(data.paper.pos).concat("bitcoin");Object.assign(prices,await C.currentPrices(ids))}
    if(data.results&&prices.bitcoin){
      const {P,ev}=C.paperStep(data.paper||null,data.results,data.prev||{},R,prices,MODE==="full");
      if(P)data.paper=P;
      if(ev.length)msgs.push("💼 <b>Portafoglio simulato</b>\n"+ev.map(t=>`• ${t.side==="BUY"?"Comprato":"Venduto"} <b>${t.sym}</b> ${t.qty.toPrecision(4)} a ${C.px(t.price)} = $${t.value.toFixed(0)} (fee $${t.fee.toFixed(2)}) — ${t.reason}`).join("\n")+`\nEquity $${C.paperEquity(P,prices).toFixed(0)} · cash $${P.cash.toFixed(0)} · BTC buy&hold $${(prices.bitcoin/P.btcStart*C.PAPER_CFG.start).toFixed(0)}`);
    }
  }catch(e){console.log("paper errore",e.message)}
  // Monte Carlo neutro sul portafoglio proposto
  if(data.results&&data.cl){const W=C.portfolioWeights(data.results,data.cl,C.paperStyle(R).sat);if(W&&W.length){data.mc=C.monteCarlo(W,R.exposure,"neutro",data.cl);if(data.mc)data.mc.W=W;
    if(prev.mc&&data.mc&&Math.abs(data.mc.p5-prev.mc.p5)>=0.08)msgs.push(`🎯 Probabilità x5 (scenario neutro): ${(prev.mc.p5*100).toFixed(0)}% → ${(data.mc.p5*100).toFixed(0)}%`)}}
  // storico compatto per il report (una riga per corsa)
  try{const H=data.hist||[];const cur=data.paper&&data.paper.curve.at(-1)||{};
    H.push({d:new Date().toISOString(),m:MODE[0],ex:R.exposure,st:data.paper&&data.paper.style||null,fine:+R.cycle.fine.toFixed(2),fg:R.fg??null,fu:R.fund!=null?+R.fund.toFixed(1):null,my:R.mayer?+R.mayer.toFixed(2):null,alt:R.alt||null,
      nb:data.results?data.results.filter(x=>x.state==="COMPRA").length:null,na:data.results?data.results.filter(x=>x.state==="ATTENDI").length:null,eq:cur.eq?+cur.eq.toFixed(0):null,btc:cur.btc?+cur.btc.toFixed(0):null,
      sec:MODE==="full"&&data.sectors?data.sectors.list.slice(0,4).map(s=>s.name+":"+s.phase[0]+s.score).join(","):undefined});
    if(H.length>2000)H.splice(0,H.length-2000);data.hist=H}catch(e){}
  data.generated=new Date().toISOString();
  fs.writeFileSync(FILE,JSON.stringify(data));
  console.log(`Regime: esposizione ${R.exposure}%, ciclo fine ${(R.cycle.fine*100).toFixed(0)}%`);
  if(msgs.length)await telegram(msgs.join("\n\n")+"\n\n"+(process.env.PAGE_URL||""));
  // riepilogo giornaliero alle 07 UTC circa (prima corsa del giorno)
  const h=new Date().getUTCHours();
  if(MODE==="full"&&h<6&&data.results){const b=data.results.filter(r=>r.state==="COMPRA").slice(0,8),w=data.results.filter(r=>r.state==="ATTENDI").slice(0,5);
    await telegram(`☀️ <b>Scout — riepilogo</b>\nEsposizione ${R.exposure}% · Ciclo fine ${(R.cycle.fine*100).toFixed(0)}% · F&amp;G ${R.fg??"–"} · funding ${R.fund!=null?R.fund.toFixed(0)+"%":"–"}\n<b>Compra ora:</b> ${b.map(r=>r.sym+" ("+r.total+")").join(", ")||"nessuno"}\n<b>Attendi:</b> ${w.map(r=>r.sym).join(", ")||"nessuno"}\n<b>Settori:</b> ${(data.sectors&&data.sectors.list||[]).slice(0,3).map(s=>s.name+" "+s.phase.toLowerCase()).join(" · ")}`+(data.paper?`\n<b>Simulato:</b> $${(data.paper.curve.at(-1)||{}).eq?.toFixed(0)} vs BTC $${(data.paper.curve.at(-1)||{}).btc?.toFixed(0)} · ${Object.keys(data.paper.pos).length} posizioni`:"")+(data.mc?`\n<b>P(x5) neutro:</b> ${(data.mc.p5*100).toFixed(0)}% · P(x10) ${(data.mc.p10*100).toFixed(0)}%`:"")+"\n"+(process.env.PAGE_URL||""))}
})().catch(e=>{console.error(e);try{const d=readPrev()||{};d.lastError="runner: "+e.message;d.generated=new Date().toISOString();fs.writeFileSync(FILE,JSON.stringify(d))}catch(x){}process.exit(0)});
