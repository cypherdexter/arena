/* CryptoProb Scout — core condiviso tra pagina (browser) e runner GitHub Actions (Node 20+). */
(function(root){
const hook={status:()=>{},progress:()=>{}};
/* ---------- manual knowledge base (editable in-app via notes) ---------- */
const KB={
 bitcoin:{n:"Riserva di valore del ciclo. Halving previsto aprile 2028; nei cicli passati il picco è arrivato 17–18 mesi dopo."},
 ethereum:{n:"Layer base per stablecoin e RWA; tesorerie societarie in accumulo. Beta moderato."},
 solana:{n:"L1 con il maggior volume retail e DEX; ricavi reali di rete. Candidato nucleo."},
 binancecoin:{n:"Legato all'ecosistema Binance: burn trimestrale, ma rischio regolatorio (nessuna licenza MiCA)."},
 hyperliquid:{n:"Perp DEX con ricavi reali usati in buyback di HYPE. Rischio: concorrenza (Aster, Lighter) e sblocchi team dal 2026.",buyback:true},
 aster:{n:"Perp DEX spinto dal network CZ/Binance. Rischio persona chiave e sblocchi elevati: valutare l'FDV, non solo il market cap.",key:true},
 zcash:{n:"Narrativa privacy in ripresa; offerta quasi tutta emessa (poca diluizione). Rischio delisting su exchange regolati."},
 ripple:{n:"Pagamenti istituzionali e ETF; grande offerta ancora in escrow."},
 chainlink:{n:"Infrastruttura oracoli per RWA e banche; adozione lenta ma strutturale."},
 sui:{n:"L1 Move con forte marketing; sblocchi ancora consistenti.",},
 "bittensor":{n:"Narrativa AI decentralizzata; emissione con halving proprio."},
 monero:{n:"Privacy, offerta stabile; poca esposizione su exchange regolati."},
 tron:{n:"Rete dominante per USDT; ricavi reali altissimi, forte dipendenza da Justin Sun.",key:true},
 dogecoin:{n:"Puro momentum/meme; nessun fondamentale, segue Musk.",key:true},
 cardano:{n:"Community solida, adozione DeFi limitata."},
 "the-open-network":{n:"Legato a Telegram; rischio persona chiave (Durov).",key:true},
 "avalanche-2":{n:"L1 enterprise/subnet; sblocchi in corso."},
 pepe:{n:"Meme ad alto beta, solo per timing tecnico."},
 "worldcoin-wld":{n:"Identità/AI (Altman); sblocchi enormi rispetto al circolante.",key:true},
};
const STABLE=new Set(["usdt","usdc","dai","usde","usds","fdusd","tusd","pyusd","usd1","usdd","frax","gusd","usdp","lusd","eurc","eurs","bsc-usd","usdtb","rlusd","susde","susds","sdai","usd0","usdx","buidl","usdy"]);
const KRAKEN_ALIAS={BTC:"XBT",DOGE:"XDG"};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const fmt=(n,d=2)=>n==null?"–":n>=1e9?(n/1e9).toFixed(1)+" mld":n>=1e6?(n/1e6).toFixed(0)+" mln":n>=1e3?(n/1e3).toFixed(0)+" k":Number(n).toFixed(d);
const px=p=>p==null?"–":p>=100?p.toFixed(0):p>=1?p.toFixed(2):p.toFixed(4);
const pc=v=>v==null?"–":(v>=0?"+":"")+v.toFixed(1)+"%";
/* ---------- data ---------- */
async function getJ(u,ms=20000){const c=new AbortController();const t=setTimeout(()=>c.abort(),ms);try{const r=await fetch(u,{signal:c.signal});if(!r.ok)throw new Error(r.status);return await r.json()}finally{clearTimeout(t)}}

async function loadMarkets(){
  const d=await getJ("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=130&page=1&price_change_percentage=7d,30d,200d,1y");
  return d.filter(isReal).slice(0,100);
}
function isReal(c){
    const s=c.symbol.toLowerCase(),n=c.name.toLowerCase(),id=c.id;
    if(STABLE.has(s)||STABLE.has(id))return false;
    if(/wrapped|staked|bridged|restak|liquid stak|tokenized|\busd\b|dollar|gold|xaut|paxg/.test(n))return false;
    if(/^w(btc|eth|bnb|sol)$|^st|^cb(btc|eth)$|^ws?e?eth$|^lbtc$|^tbtc$/.test(s))return false;
    if(c.current_price>0.98&&c.current_price<1.02&&Math.abs(c.price_change_percentage_24h||0)<0.6)return false;
    return true;
}
async function loadLlama(){
  const out={};
  try{
    const [prot,chains,fees]=await Promise.all([
      getJ("https://api.llama.fi/protocols"),getJ("https://api.llama.fi/v2/chains"),
      getJ("https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue")]);
    const byName={};
    for(const p of prot){if(p.category==="CEX")continue;const k=(p.gecko_id||"")+"|"+(p.symbol||"").toUpperCase();byName[p.name.toLowerCase()]={g:p.gecko_id,s:(p.symbol||"").toUpperCase(),tvl:p.tvl||0};
      const pk=p.gecko_id||(p.symbol&&p.symbol!=="-"?"SYM:"+p.symbol.toUpperCase():null);
      if(pk){out[pk]=out[pk]||{tvl:0,rev:0,rev1m:null};out[pk].tvl+=p.tvl||0}}
    for(const c of chains){byName[c.name.toLowerCase()]={g:c.gecko_id,s:(c.tokenSymbol||"").toUpperCase(),tvl:c.tvl||0,chain:true};
      if(c.gecko_id){out[c.gecko_id]=out[c.gecko_id]||{tvl:0,rev:0,rev1m:null};out[c.gecko_id].chainTvl=c.tvl||0}}
    out._sym={};
    for(const f of fees.protocols){const m=byName[f.name.toLowerCase()]||byName[(f.displayName||"").toLowerCase()];if(!m)continue;
      const key=m.g||("SYM:"+m.s);if(!m.g&&!m.s)continue;
      const o=out[key]=out[key]||{tvl:0,rev:0,rev1m:null};o.rev+=f.total30d||0;
      if(f.total60dto30d!=null&&f.total60dto30d>0){o.prev=(o.prev||0)+f.total60dto30d}}
    for(const k in out){if(out[k]&&out[k].prev>0)out[k].rev1m=(out[k].rev/out[k].prev-1)*100}
  }catch(e){out._err=e.message}
  return out;
}
async function candlesBinance(sym){const d=await getJ(`https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=1d&limit=400`,12000);return d.map(k=>({t:k[0],o:+k[1],h:+k[2],l:+k[3],c:+k[4],v:+k[7]}))}
async function candlesKraken(sym){const p=(KRAKEN_ALIAS[sym]||sym)+"USD";const d=await getJ(`https://api.kraken.com/0/public/OHLC?pair=${p}&interval=1440`,12000);if(d.error&&d.error.length)throw new Error(d.error[0]);const k=Object.keys(d.result).find(x=>x!=="last");return d.result[k].map(r=>({t:r[0]*1000,o:+r[1],h:+r[2],l:+r[3],c:+r[4],v:+r[6]*+r[4]}))}
async function candlesGecko(id){const d=await getJ(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=365&interval=daily`,20000);const vol=d.total_volumes;return d.prices.map((p,i)=>({t:p[0],o:p[1],h:p[1],l:p[1],c:p[1],v:vol[i]?vol[i][1]:0}))}
let geckoQ=Promise.resolve();
async function candles(c){
  const s=c.symbol.toUpperCase();
  try{return{src:"Binance",k:await candlesBinance(s)}}catch(e){}
  try{const k=await candlesKraken(s);if(k.length>60)return{src:"Kraken",k}}catch(e){}
  // CoinGecko come ultima riserva: chiamate serializzate e con attesa sul 429
  geckoQ=geckoQ.then(async()=>{for(let a=0;a<3;a++){await sleep(2600);try{return{src:"CoinGecko",k:await candlesGecko(c.id)}}catch(e){if(String(e.message)!=="429")break;await sleep(12000*(a+1))}}return null}).catch(()=>null);
  return await geckoQ;
}

/* ---------- sectors / narratives ---------- */
const SECTORS=[["privacy-coins","Privacy"],["artificial-intelligence","AI"],["real-world-assets-rwa","RWA"],["layer-1","Layer 1"],["layer-2","Layer 2"],["decentralized-perpetuals","Perp DEX"],["decentralized-exchange","DEX"],["decentralized-finance-defi","DeFi"],["meme-token","Meme"],["depin","DePIN"],["oracle","Oracoli"],["zero-knowledge-zk","ZK"],["prediction-markets","Prediction market"],["gaming","Gaming"],["payment-solutions","Pagamenti"],["centralized-exchange-token-cex","Token exchange"],["tokenized-stock","Azioni tokenizzate"]];
const LLAMA_CAT={"decentralized-perpetuals":"Derivatives","decentralized-exchange":"Dexs","real-world-assets-rwa":"RWA","prediction-markets":"Prediction Market","decentralized-finance-defi":"Lending"};
const med=a=>{if(!a.length)return null;const b=a.slice().sort((x,y)=>x-y);const m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
async function loadSectors(btc,prot){
  const out=[],member={};let i=0;
  const b7=btc.price_change_percentage_7d_in_currency||0,b30=btc.price_change_percentage_30d_in_currency||0;
  for(const [id,name] of SECTORS){
    hook.status(`Settori: ${name} (${++i}/${SECTORS.length})…`);
    const u=`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&category=${id}&order=market_cap_desc&per_page=25&page=1&price_change_percentage=7d,30d,200d`;
    let d=null;for(let a=0;a<3&&!d;a++){try{d=await getJ(u,15000)}catch(e){hook.status(`Settori: ${name}, CoinGecko limita le richieste, attendo…`);await sleep(15000*(a+1))}}
    if(!d)continue;
    await sleep(2600);
    d=d.filter(c=>c.id!=="bitcoin"&&isReal(c)&&c.market_cap>1e8);
    if(d.length<3)continue;
    const r7=med(d.map(c=>c.price_change_percentage_7d_in_currency).filter(x=>x!=null))-b7;
    const r30=med(d.map(c=>c.price_change_percentage_30d_in_currency).filter(x=>x!=null))-b30;
    const b90=btc.price_change_percentage_200d_in_currency;const r90v=d.map(c=>c.price_change_percentage_200d_in_currency).filter(x=>x!=null);
    const r90=r90v.length&&b90!=null?med(r90v)-b90:null;
    const breadth=d.filter(c=>(c.price_change_percentage_30d_in_currency||0)>b30).length/d.length*100;
    let tvl7=null;const lc=LLAMA_CAT[id];
    if(lc&&prot){let w=0,sum=0;for(const p of prot){if(p.category===lc&&p.tvl>1e7&&p.change_7d!=null){w+=p.tvl;sum+=p.tvl*p.change_7d}}if(w>0)tvl7=sum/w}
    let sc=50+Math.max(-20,Math.min(20,r30/1.5))+Math.max(-15,Math.min(15,r7*1.5))+(breadth-50)/5+(tvl7==null?0:Math.max(-6,Math.min(6,tvl7/2)));
    sc=Math.round(Math.max(0,Math.min(100,sc)));
    let phase="Neutra";
    if(r90!=null&&r90>90&&r7<0)phase="Affollata";
    else if(r30>8&&r7>=-1)phase="In rotazione";
    else if(r7>3&&r30<=8&&(r90==null||r90<30))phase="Emergente";
    else if(r30<-5&&r7<0)phase="Fuori favore";
    const sec={id,name,r7,r30,r90,breadth,tvl7,score:sc,phase,top:d.slice(0,3).map(c=>c.symbol.toUpperCase()),n:d.length};
    out.push(sec);
    for(const c of d){(member[c.id]=member[c.id]||[]).push(sec)}
  }
  out.sort((a,b)=>b.score-a.score);
  return{list:out,member};
}
/* ---------- indicators ---------- */
const ema=(a,n)=>{const k=2/(n+1);let e=a[0];const o=[e];for(let i=1;i<a.length;i++){e=a[i]*k+e*(1-k);o.push(e)}return o};
function rsi(a,n=14){if(a.length<n+2)return 50;let g=0,l=0;for(let i=1;i<=n;i++){const d=a[i]-a[i-1];d>0?g+=d:l-=d}g/=n;l/=n;for(let i=n+1;i<a.length;i++){const d=a[i]-a[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n}return l===0?100:100-100/(1+g/l)}
function atrPct(k,n){if(k.length<n+1)return null;let s=0;for(let i=k.length-n;i<k.length;i++){const tr=Math.max(k[i].h-k[i].l,Math.abs(k[i].h-k[i-1].c),Math.abs(k[i].l-k[i-1].c));s+=tr/k[i].c}return s/n*100}
const chg=(a,n)=>a.length>n?(a[a.length-1]/a[a.length-1-n]-1)*100:null;
const hi=(a,n,off=1)=>Math.max(...a.slice(Math.max(0,a.length-n-off),a.length-off));

function tech(k,btc){
  const c=k.map(x=>x.c),n=c.length,last=c[n-1];
  const e20=ema(c,20),e50=ema(c,50),e200=n>=200?ema(c,200):null;
  const E20=e20[n-1],E50=e50[n-1],E200=e200?e200[n-1]:null;
  const r=rsi(c);
  const a20=atrPct(k,20),a100=atrPct(k,100);
  const h20=hi(c,20),h55=hi(c,55);
  const bo20=last>h20,bo55=last>h55;
  let rs30=null,rs90=null,rsTrend=null;
  if(btc){const m=Math.min(n,btc.length);const rr=[];for(let i=0;i<m;i++)rr.push(c[n-m+i]/btc[btc.length-m+i]);rs30=chg(rr,30);rs90=chg(rr,90);const re=ema(rr,50);rsTrend=rr[rr.length-1]>re[re.length-1]}
  const vNow=k.slice(-20).reduce((s,x)=>s+x.v,0)/20,vOld=k.slice(-80,-20).reduce((s,x)=>s+x.v,0)/60;
  const volUp=vOld>0?vNow/vOld:1;
  const up=last>E50&&E20>E50&&(E200==null||E50>E200);
  const down=last<E50&&E20<E50;
  let s=50;
  s+=up?18:down?-18:(last>E50?6:-6);
  s+=E200==null?0:last>E200?6:-8;
  s+=rs30==null?0:Math.max(-8,Math.min(8,rs30/4));
  s+=rs90==null?0:Math.max(-8,Math.min(8,rs90/8));
  s+=rsTrend?5:-5;
  s+=bo55?10:bo20?6:0;
  s+=r>78?-8:r<30?-6:r>=45&&r<=68?4:0;
  const squeeze=a20&&a100&&a20<a100*0.75;
  s+=squeeze?4:0;
  s+=volUp>1.3?3:volUp<0.7?-3:0;
  const pull=up&&last<=E20*1.03&&last>=E50&&r>=40&&r<=62;
  return{score:Math.round(Math.max(0,Math.min(100,s))),last,E20,E50,E200,rsi:r,rs30,rs90,rsTrend,bo20,bo55,h20,h55,squeeze,volUp,up,down,pull,days:n};
}

/* ---------- fundamentals ---------- */
function fund(c,ll,S){
  const mc=c.market_cap||0,fdv=c.fully_diluted_valuation||mc;
  const circ=c.circulating_supply,tot=c.total_supply||c.max_supply||circ;
  const dil=tot&&circ?circ/tot:(mc&&fdv?mc/fdv:1);
  const a=ll[c.id]||{},b=ll["SYM:"+c.symbol.toUpperCase()]||{};
  const d={tvl:(a.tvl||0)+(b.tvl||0),chainTvl:a.chainTvl||b.chainTvl||0,rev:(a.rev||0)+(b.rev||0),prev:(a.prev||0)+(b.prev||0)};
  d.rev1m=d.prev>0?(d.rev/d.prev-1)*100:null;
  const rev=d.rev||0,tvl=Math.max(d.tvl||0,d.chainTvl||0),rev1m=d.rev1m;
  const ps=rev>0&&mc>0?mc/(rev*12):null; // capitalizzazione / ricavi annualizzati
  const kb=KB[c.id]||{};
  let s=40;
  s+=dil>=0.95?22:dil>=0.8?14:dil>=0.6?4:dil>=0.4?-8:-18;
  if(ps!=null)s+=ps<20?20:ps<60?13:ps<150?7:ps<400?2:0;
  if(rev1m!=null)s+=rev1m>25?6:rev1m>0?3:rev1m<-25?-6:-2;
  if(tvl>0&&mc>0){const r=tvl/mc;s+=r>0.5?8:r>0.15?5:r>0.03?2:0}
  s+=c.market_cap_rank<=10?8:c.market_cap_rank<=30?4:0;
  const liq=c.total_volume&&mc?c.total_volume/mc:0;s+=liq>0.08?3:liq<0.01?-6:0;
  if(kb.buyback)s+=5;if(kb.key)s-=6;
  let sec=null;if(S&&S.member[c.id]){sec=S.member[c.id].slice().sort((a,b)=>b.score-a.score)[0];s+=Math.max(-12,Math.min(12,(sec.score-50)/4))}
  if(c.id==="bitcoin")s=90;
  return{score:Math.round(Math.max(0,Math.min(100,s))),dil,rev,rev1m,tvl,ps,kb,sec};
}

/* ---------- decision ---------- */
function decide(c,f,t){
  const why=[],k=[];
  let state;
  const fOK=f.score>=55,fWeak=f.score<42;
  if(!t){state=fOK?"ATTENDI":"EVITA";why.push("Nessuna serie di prezzi disponibile: impossibile valutare il timing.");return{state,why,trig:"Riprova con l'analisi successiva.",k}}
  const strong=t.up&&t.rsTrend&&(t.rs30==null||t.rs30>-2);
  const ph=f.sec?f.sec.phase:null;
  const entry=ph==="Affollata"?(t.bo55||t.pull):(t.bo55||t.bo20||t.pull);
  if(fWeak||(t.down&&t.rs90!=null&&t.rs90<-15))state="EVITA";
  else if(fOK&&strong&&entry&&t.rsi<76)state="COMPRA";
  else if(f.score>=48)state="ATTENDI";
  else state="EVITA";
  // fundamentals text
  if(f.dil<0.6)why.push(`Solo il ${(f.dil*100).toFixed(0)}% dell'offerta è in circolazione: forte diluizione futura.`);
  else if(f.dil>=0.9)why.push(`Offerta quasi tutta emessa (${(f.dil*100).toFixed(0)}%): poca pressione da sblocchi.`);
  if(f.rev>0)why.push(`Ricavi reali 30gg ≈ $${fmt(f.rev)}${f.ps?` (cap/ricavi annui ${f.ps.toFixed(0)}x)`:""}${f.rev1m!=null?`, ${pc(f.rev1m)} sul mese precedente`:""}.`);
  else if(c.id!=="bitcoin")why.push("Nessun ricavo di protocollo rilevato su DefiLlama: valore basato solo su narrativa e domanda.");
  if(f.tvl>0)why.push(`TVL ≈ $${fmt(f.tvl)}.`);
  if(f.kb.n)why.push(f.kb.n);
  if(f.sec)why.push(`Settore ${f.sec.name}: ${f.sec.phase.toLowerCase()} (score ${f.sec.score}; ${pc(f.sec.r30)} vs BTC a 30gg, ${pc(f.sec.r7)} a 7gg, ${f.sec.breadth.toFixed(0)}% dei token batte BTC).`+(f.sec.phase==="Emergente"?" Narrativa in fase iniziale: è qui che si costruisce la posizione.":f.sec.phase==="Affollata"?" Ha già corso: serve conferma sui 55 giorni, dimensione ridotta.":""));
  // technicals text
  if(t.up)why.push("Trend rialzista confermato (prezzo sopra le medie 20/50"+(t.E200?"/200":"")+").");
  else if(t.down)why.push("Trend ribassista: prezzo sotto le medie 20 e 50.");
  else why.push("Trend laterale, medie non allineate.");
  if(t.rs30!=null)why.push(`Contro BTC: ${pc(t.rs30)} a 30gg, ${pc(t.rs90)} a 90gg${t.rsTrend?", forza relativa in salita":", forza relativa in calo"}.`);
  if(t.bo55)why.push("Breakout sul massimo di 55 giorni.");else if(t.bo20)why.push("Breakout sul massimo di 20 giorni.");
  if(t.pull)why.push("Ritracciamento sano sulla media 20 con RSI neutro: ingresso a rischio controllato.");
  if(t.squeeze)why.push("Volatilità compressa: fase di accumulo, spesso precede un movimento.");
  if(t.rsi>76)why.push(`RSI ${t.rsi.toFixed(0)}: ipercomprato, non inseguire.`);
  if(c.ath_change_percentage!=null)why.push(`${pc(c.ath_change_percentage)} dal massimo storico.`);
  // trigger
  let trig="";
  if(state==="COMPRA")trig=`Ingresso ora a ${px(t.last)}. Stop di sistema: chiusura giornaliera sotto ${px(t.E50)} (media 50). Prima presa di profitto a x2.`;
  else if(state==="ATTENDI"){
    if(!t.up)trig=`Segnale: chiusura giornaliera sopra ${px(Math.max(t.E50,t.h20))} con forza relativa contro BTC in salita.`;
    else if(!t.rsTrend)trig=`Trend ok ma perde contro BTC: segnale quando il rapporto token/BTC torna sopra la sua media 50 (oggi ${pc(t.rs30)} a 30gg).`;
    else if(t.rsi>=76)trig=`Ipercomprato: attendi ritracciamento verso ${px(t.E20)} (media 20) con RSI sotto 65, oppure nuovo breakout sopra ${px(t.h20)} dopo una pausa.`;
    else trig=`Segnale: breakout sopra ${px(t.h20)} (massimo 20gg) oppure ritracciamento a ${px(t.E20)} con RSI 40–62.`;
    if(!fOK)trig+=" Fondamentali al limite: dimensione ridotta anche al segnale.";
  }else trig=fWeak?"Fondamentali insufficienti: fuori dall'universo finché diluizione o ricavi non migliorano.":"Debolezza strutturale contro BTC: tenere BTC rende di più con meno rischio.";
  k.push(`Fond. ${f.score}`,`Tecn. ${t.score}`,`Narr. ${f.sec?f.sec.score:"–"}`,`RSI ${t.rsi.toFixed(0)}`,`Circ. ${(f.dil*100).toFixed(0)}%`,`Cap $${fmt(c.market_cap)}`,`FDV $${fmt(c.fully_diluted_valuation||c.market_cap)}`,`30gg ${pc(c.price_change_percentage_30d_in_currency)}`,`1a ${pc(c.price_change_percentage_1y_in_currency)}`,`Serie ${t.days}gg`);
  return{state,why,trig,k};
}

/* ---------- analisi completa ---------- */
async function analyze(){
  const CL={};
  hook.status("Carico la top 100 da CoinGecko…");hook.progress(0);
  const [mk,ll,prot]=await Promise.all([loadMarkets(),loadLlama(),getJ("https://api.llama.fi/protocols").catch(()=>null)]);
  const btc=mk.find(x=>x.id==="bitcoin");
  const bk=await candles(btc);const BTCC=bk?bk.k.map(x=>x.c):null;
  hook.progress(.06);
  let S=null;try{S=await loadSectors(btc,prot)}catch(e){}
  hook.progress(.12);
  const out=[];let done=0,fails=0;const queue=[...mk];
  async function worker(){while(queue.length){const c=queue.shift();let r=null;
    try{r=c.id==="bitcoin"?bk:await candles(c)}catch(e){}
    if(!r)fails++;else CL[c.id]=r.k.map(x=>x.c);
    const f=fund(c,ll,S),t=r?tech(r.k,c.id==="bitcoin"?null:BTCC):null;
    const d=decide(c,f,t);
    out.push({id:c.id,sym:c.symbol.toUpperCase(),name:c.name,rank:c.market_cap_rank,price:c.current_price,f,t,src:r?r.src:null,...d,total:Math.round(f.score*0.5+(t?t.score:35)*0.5)});
    done++;hook.progress(.12+.86*done/mk.length);hook.status(`Analizzati ${done}/${mk.length} (${fails} senza candele)…`);}}
  await Promise.all([worker(),worker(),worker(),worker()]);
  out.sort((a,b)=>(a.state==="COMPRA"?0:a.state==="ATTENDI"?1:2)-(b.state==="COMPRA"?0:b.state==="ATTENDI"?1:2)||b.total-a.total);
  return{out,btc,fails,S:S?{list:S.list}:null,CL,llamaErr:ll._err||null};
}
/* confronto con la precedente: avvisi e registro (muta PREV e LEDGER) */
function applyRun(out,btcP,PREV,LEDGER){
  const now=new Date().toISOString(),al=[];
  // isteresi: un cambio di stato vale solo se confermato alla corsa successiva,
  // salvo passaggio a Compra ora con breakout a 55 giorni (segnale forte, subito).
  for(const r of out){const p=PREV[r.id];
    if(!p){PREV[r.id]={state:r.state,price:r.price};LEDGER.push({d:now,id:r.id,sym:r.sym,state:r.state,price:r.price,btc:btcP,f:r.f.score,t:r.t?r.t.score:null});continue}
    if(p.state===r.state){p.pending=null;continue}
    const strong=r.state==="COMPRA"&&r.t&&r.t.bo55;
    if(strong||p.pending===r.state){
      al.push({sym:r.sym,name:r.name,from:p.state,to:r.state,price:r.price});
      PREV[r.id]={state:r.state,price:r.price};
      LEDGER.push({d:now,id:r.id,sym:r.sym,state:r.state,price:r.price,btc:btcP,f:r.f.score,t:r.t?r.t.score:null});
    }else p.pending=r.state;
    r.pending=PREV[r.id].state!==r.state?PREV[r.id].state:null;}
  return al;
}
const HALV_PREV=Date.UTC(2024,3,20),HALV_NEXT=Date.UTC(2028,3,15),TARGET=Date.UTC(2029,11,31);
const sma=(a,n)=>a.length>=n?a.slice(-n).reduce((x,y)=>x+y,0)/n:null;
async function btcWeekly(){try{const d=await getJ("https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=10080",15000);const k=Object.keys(d.result).find(x=>x!=="last");return d.result[k].map(r=>+r[4])}catch(e){return null}}
async function okx(inst){const o={};
  try{const f=await getJ(`https://www.okx.com/api/v5/public/funding-rate-history?instId=${inst}&limit=90`,12000);const rs=f.data.map(x=>+(x.realizedRate||x.fundingRate));o.fNow=rs[0];o.f30=rs.reduce((a,b)=>a+b,0)/rs.length}catch(e){}
  try{const i=await getJ(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${inst}`,12000);o.oi=+i.data[0].oiUsd}catch(e){}
  return o}
async function computeRegime(CL,prevReg){
  hook.status("Regime: carico dati…");
  const R={d:new Date().toISOString(),parts:[]};
  {
    const [g,fg,sc,wk,fb,fe,bd,ed]=await Promise.all([
      getJ("https://api.coingecko.com/api/v3/global").catch(()=>null),
      getJ("https://api.alternative.me/fng/?limit=1").catch(()=>null),
      getJ("https://stablecoins.llama.fi/stablecoins?includePrices=false").catch(()=>null),
      btcWeekly(),okx("BTC-USDT-SWAP"),okx("ETH-USDT-SWAP"),
      CL.bitcoin?Promise.resolve(CL.bitcoin):candles({id:"bitcoin",symbol:"btc"}).then(r=>r&&r.k.map(x=>x.c)),
      CL.ethereum?Promise.resolve(CL.ethereum):candles({id:"ethereum",symbol:"eth"}).then(r=>r&&r.k.map(x=>x.c))]);
    let exp=50;const P=R.parts;
    // 1. trend BTC
    if(bd&&bd.length>200){const last=bd[bd.length-1],m50=sma(bd,50),m200=sma(bd,200);const up=last>m50&&m50>m200,dn=last<m50&&m50<m200;const v=up?22:dn?-22:last>m200?6:-6;exp+=v;R.btcTrend=up?"rialzista":dn?"ribassista":"laterale";R.mayer=last/m200;
      P.push({k:"Trend BTC (50/200 gg)",v:R.btcTrend+`, Mayer ${R.mayer.toFixed(2)}`,e:v})}
    // 2. stablecoin
    if(sc){let now=0,wkv=0,mo=0;for(const a of sc.peggedAssets){if(a.pegType!=="peggedUSD")continue;now+=a.circulating?.peggedUSD||0;wkv+=a.circulatingPrevWeek?.peggedUSD||0;mo+=a.circulatingPrevMonth?.peggedUSD||0}
      R.stab=now;R.stabW=(now/wkv-1)*100;R.stabM=(now/mo-1)*100;const v=R.stabM>2?10:R.stabM>0.5?5:R.stabM<-1?-10:-3;exp+=v;
      P.push({k:"Offerta stablecoin USD",v:`$${fmt(now)}, ${pc(R.stabM)} sul mese, ${pc(R.stabW)} sulla settimana`,e:v})}
    // 3. altseason
    if(g){R.dom=g.data.market_cap_percentage.btc;R.ethDom=g.data.market_cap_percentage.eth}
    if(bd&&ed){const m=Math.min(bd.length,ed.length);const rr=[];for(let i=0;i<m;i++)rr.push(ed[ed.length-m+i]/bd[bd.length-m+i]);const e50=ema(rr,50);R.ethbtc30=chg(rr,30);R.ethbtcUp=rr[rr.length-1]>e50[e50.length-1];
      R.alt=R.ethbtcUp&&R.ethbtc30>0?"stagione alt in corso":R.ethbtcUp?"alt in ripresa":"BTC domina: satelliti in sofferenza";
      P.push({k:"Stagione alt (ETH/BTC, dominance)",v:`${R.alt}; ETH/BTC ${pc(R.ethbtc30)} a 30gg, dominance BTC ${R.dom?R.dom.toFixed(1)+"%":"–"}`,e:0})}
    // 4. sentiment
    if(fg){R.fg=+fg.data[0].value;const v=R.fg>=80?-10:R.fg>=65?-3:R.fg<=25?(R.btcTrend==="rialzista"?6:0):0;exp+=v;P.push({k:"Fear & Greed",v:`${R.fg} (${fg.data[0].value_classification})`,e:v})}
    // 5. derivatives
    if(fb.f30!=null){R.fund=fb.f30*3*365*100;R.fundNow=fb.fNow*3*365*100;R.oi=fb.oi;const v=R.fund>25?-12:R.fund>12?-6:R.fund<0?2:0;exp+=v;
      P.push({k:"Derivati BTC (OKX)",v:`funding medio 30gg ${R.fund.toFixed(0)}% annuo (ora ${R.fundNow.toFixed(0)}%), OI $${fmt(fb.oi)}`+(fe.f30!=null?`; ETH funding ${(fe.f30*3*365*100).toFixed(0)}%`:""),e:v});
      R.hot=R.fund>25||R.fundNow>40}
    R.exposure=Math.round(Math.max(10,Math.min(100,exp)));
    // cycle
    const now=Date.now();R.sinceH=Math.round((now-HALV_PREV)/864e5);R.toH=Math.round((HALV_NEXT-now)/864e5);
    if(wk&&wk.length>200){const last=wk[wk.length-1];R.w200=last/sma(wk,200);const m16=sma(wk,16),m50=sma(wk,50);R.pi=m16/(2*m50);R.w200v=sma(wk,200)}
    let fine=0.2,mid=0.5,ini=0.3;
    if(R.sinceH>420&&R.sinceH<720){fine+=0.2;mid+=0.1;ini-=0.3}else if(R.toH<400){ini+=0.3;fine-=0.2;mid-=0.1}
    if(R.mayer){if(R.mayer>2.2){fine+=0.25;ini-=0.15;mid-=0.1}else if(R.mayer<0.9){ini+=0.25;fine-=0.15;mid-=0.1}}
    if(R.w200){if(R.w200>3.2){fine+=0.2;ini-=0.1;mid-=0.1}else if(R.w200<1.3){ini+=0.2;fine-=0.1;mid-=0.1}}
    if(R.pi&&R.pi>0.95){fine+=0.25;ini-=0.15;mid-=0.1}
    const tot=Math.max(0.01,ini)+Math.max(0.01,mid)+Math.max(0.01,fine);R.cycle={ini:Math.max(0.01,ini)/tot,mid:Math.max(0.01,mid)/tot,fine:Math.max(0.01,fine)/tot};
    if(R.cycle.fine>0.5)R.exposure=Math.round(R.exposure*0.75);
    R.prevExp=prevReg?prevReg.exposure:null;
    return R;
  }
}
function portfolioWeights(RES,CL,sat){
  if(!RES.length)return null;
  const coreW=1-sat-0.10;
  const core=["bitcoin","ethereum","solana","binancecoin"].map(id=>RES.find(r=>r.id===id)).filter(r=>r&&r.state!=="EVITA"&&CL[r.id]);
  const cw=core.map(r=>r.id==="bitcoin"?2:1),cs=cw.reduce((a,b)=>a+b,0)||1;
  const sats=RES.filter(r=>r.state==="COMPRA"&&!core.includes(r)&&CL[r.id]).slice(0,6);
  const capEach=Math.min(0.08,sat/Math.max(sats.length,1));
  const W=[];core.forEach((r,i)=>W.push({id:r.id,sym:r.sym,w:coreW*cw[i]/cs}));sats.forEach(r=>W.push({id:r.id,sym:r.sym,w:capEach}));
  return W;
}
function monteCarlo(W,exposure,scen,CL){
  // Volatilità e correlazioni dagli ultimi ~400 giorni (rendimenti demeanati); il rendimento atteso
  // NON viene dalla finestra recente (troppo dipendente dal punto del ciclo) ma dallo scenario,
  // scalato per rischio: drift_asset = drift_scenario × (vol_asset / vol_BTC).
  const ANNUAL={storico:0.55,neutro:0.25,ribassista:0.0}[scen]??0.25;
  const days=Math.max(30,Math.round((TARGET-Date.now())/864e5));
  const n=Math.min(...W.map(x=>CL[x.id].length))-1;if(n<120)return null;
  const rets=W.map(x=>{const c=CL[x.id].slice(-n-1);const r=[];for(let i=1;i<c.length;i++)r.push(Math.log(c[i]/c[i-1]));return r});
  const mu=rets.map(r=>r.reduce((a,b)=>a+b,0)/r.length);
  const sd=rets.map((r,a)=>Math.sqrt(r.reduce((s,x)=>s+(x-mu[a])**2,0)/r.length));
  const btcC=CL.bitcoin?CL.bitcoin.slice(-n-1):null;let sdB=sd[0];
  if(btcC){const rb=[];for(let i=1;i<btcC.length;i++)rb.push(Math.log(btcC[i]/btcC[i-1]));const mb=rb.reduce((a,b)=>a+b,0)/rb.length;sdB=Math.sqrt(rb.reduce((s,x)=>s+(x-mb)**2,0)/rb.length)}
  const drift=sd.map(v=>Math.log(1+ANNUAL)/365*Math.min(1.6,v/sdB));
  const volX=scen==="ribassista"?1.2:1;
  const risky=W.reduce((a,x)=>a+x.w,0);const e=exposure/100;
  const N=1200,B=10;let hit5=0,hit10=0,dd50=0;const finals=[];
  for(let p=0;p<N;p++){let v=1,peak=1,minv=1;const vals=W.map(x=>x.w*e/risky);let cash=1-vals.reduce((a,b)=>a+b,0);
    let t=0;while(t<days){const s=Math.floor(Math.random()*(n-B));for(let b=0;b<B&&t<days;b++,t++){let tot=cash;for(let a=0;a<W.length;a++){const r=(rets[a][s+b]-mu[a])*volX+drift[a]-0.5*(sd[a]*volX)**2*0;vals[a]*=Math.exp(r);tot+=vals[a]}
        v=tot;if(v>peak)peak=v;if(v/peak<minv)minv=v/peak;
        if(t%90===0){for(let a=0;a<W.length;a++)vals[a]=W[a].w*e/risky*v;cash=v-vals.reduce((a,b)=>a+b,0)}}}
    finals.push(v);if(v>=5)hit5++;if(v>=10)hit10++;if(minv<=0.5)dd50++}
  finals.sort((a,b)=>a-b);
  return{days,scen,annual:ANNUAL,p5:hit5/N,p10:hit10/N,pdd:dd50/N,med:finals[N>>1],p10th:finals[Math.floor(N*0.1)],p90th:finals[Math.floor(N*0.9)]};
}
function kellyMult(RES,LEDGER){
  const cur={};for(const r of RES)cur[r.id]=r.price;const btc=RES.find(r=>r.id==="bitcoin");if(!btc)return{m:1,n:0};
  const ex=[];for(const x of LEDGER){if(x.state!=="COMPRA")continue;const p=cur[x.id];if(p==null)continue;const age=(Date.now()-Date.parse(x.d))/864e5;if(age<14)continue;ex.push((p/x.price-1)-(btc.price/x.btc-1))}
  if(ex.length<20)return{m:1,n:ex.length};
  const mu=ex.reduce((a,b)=>a+b,0)/ex.length,sd=Math.sqrt(ex.reduce((a,b)=>a+(b-mu)**2,0)/ex.length)||1;const k=mu/(sd*sd);
  return{m:Math.max(0.5,Math.min(1.5,1+k*0.5)),n:ex.length,mu,win:ex.filter(x=>x>0).length/ex.length};
}
/* ---------- portafoglio simulato (paper trading) ---------- */
const PAPER_CFG={start:10000,fee:0.0026,slip:0.0010,satCap:0.08,satMax:6,satBudget:0.55,coreW:0.35,tp:[[2,0.20],[3,0.25],[5,0.30]],rebalDays:30,rebalDrift:0.02};
function paperStyle(REG){
  // Lo stile lo decide il regime: inizio ciclo e trend forte → aggressivo; fine ciclo o esposizione bassa → prudente
  const c=REG&&REG.cycle||{ini:.33,mid:.34,fine:.33};const ex=REG?REG.exposure:60;
  if(c.fine>0.5||ex<45)return{name:"Prudente",sat:0.45,core:0.45};
  if(c.ini>0.5&&ex>=65&&!(REG&&REG.hot))return{name:"Aggressivo",sat:0.65,core:0.25};
  return{name:"Equilibrato",sat:0.55,core:0.35};
}
function paperInit(btcPrice){return{v:1,start:new Date().toISOString(),cash:PAPER_CFG.start,pos:{},trades:[],curve:[],btcStart:btcPrice,lastRebal:null,lastExp:null}}
function paperEquity(P,prices){let e=P.cash;for(const id in P.pos){const q=P.pos[id].qty,px=prices[id];if(px)e+=q*px}return e}
function paperTrade(P,id,sym,side,qty,price,reason,now){
  const c=PAPER_CFG;const exec=side==="BUY"?price*(1+c.slip):price*(1-c.slip);const val=qty*exec,fee=val*c.fee;
  if(side==="BUY"){if(val+fee>P.cash+1e-9)return null;P.cash-=val+fee;const p=P.pos[id]=P.pos[id]||{sym,qty:0,cost:0,qty0:0,tp:{}};p.cost=(p.cost*p.qty+val+fee)/(p.qty+qty);p.qty+=qty;if(!p.qty0)p.qty0=qty;p.entryDate=p.entryDate||now}
  else{const p=P.pos[id];if(!p||qty>p.qty*1.000001)return null;P.cash+=val-fee;p.qty-=qty;if(p.qty<=1e-9||p.qty*exec<5){delete P.pos[id]}}
  const t={d:now,sym,side,qty,price:exec,value:val,fee,reason};P.trades.push(t);if(P.trades.length>400)P.trades.splice(0,P.trades.length-400);return t;
}
/* Esegue un passo: full=true usa stati e indicatori (corsa completa), full=false controlla solo stop e prese di profitto sui prezzi correnti */
function paperStep(P,RES,PREV,REG,prices,full){
  const c=PAPER_CFG,now=new Date().toISOString(),ev=[];
  const btc=RES.find(r=>r.id==="bitcoin");if(!P){if(!full)return{P:null,ev:[]};P=paperInit(prices.bitcoin||(btc&&btc.price))}
  const byId={};for(const r of RES)byId[r.id]=r;
  const conf=id=>(PREV[id]&&PREV[id].state)||(byId[id]&&byId[id].state);
  const eq0=paperEquity(P,prices);
  // 1. stop e prese di profitto (sempre)
  for(const id of Object.keys(P.pos)){const p=P.pos[id],px=prices[id];if(!px)continue;const r=byId[id];
    if(p.core)continue;
    if(r&&r.t&&r.t.E50)p.stop=Math.max(p.stop||0,r.t.E50);
    if(p.stop&&px<p.stop){const t=paperTrade(P,id,p.sym,"SELL",p.qty,px,`stop (media 50 a ${px<p.stop?p.stop.toPrecision(4):""})`,now);if(t)ev.push(t);continue}
    if(full&&r&&(conf(id)==="EVITA"||(conf(id)==="ATTENDI"&&r.t&&!r.t.up))){const t=paperTrade(P,id,p.sym,"SELL",p.qty,px,"stato "+conf(id)+" con trend perso",now);if(t)ev.push(t);continue}
    for(const [m,f] of c.tp){if(!p.tp[m]&&px>=p.cost*m){const q=Math.min(p.qty,p.qty0*f);const t=paperTrade(P,id,p.sym,"SELL",q,px,`presa di profitto x${m}`,now);if(t){p.tp[m]=true;ev.push(t)}}}
  }
  if(!full){P.curve.push({d:now,eq:paperEquity(P,prices),btc:prices.bitcoin/P.btcStart*c.start});if(P.curve.length>3000)P.curve.splice(0,P.curve.length-3000);return{P,ev}}
  const exp=(REG&&REG.exposure||70)/100,hot=REG&&REG.hot;const sty=paperStyle(REG);P.style=sty.name;
  // 2. nucleo: ribilanciamento mensile, o quando l'esposizione cambia di 15 punti
  let eq=paperEquity(P,prices);
  const coreIds=["bitcoin","ethereum","solana","binancecoin"].filter(id=>byId[id]&&prices[id]&&conf(id)!=="EVITA");
  const cw={};let cs=0;for(const id of coreIds){cw[id]=id==="bitcoin"?2:1;cs+=cw[id]}
  const needRebal=!P.lastRebal||P.lastStyle!==sty.name||(Date.now()-Date.parse(P.lastRebal))/864e5>=c.rebalDays||(P.lastExp!=null&&Math.abs(exp*100-P.lastExp)>=15);
  if(needRebal){for(const id of coreIds){const target=eq*exp*sty.core*cw[id]/cs;const p=P.pos[id];const cur=p?p.qty*prices[id]:0;const diff=target-cur;
      if(Math.abs(diff)>eq*c.rebalDrift){if(diff>0){const t=paperTrade(P,id,byId[id].sym,"BUY",diff/prices[id]/(1+c.slip)/(1+c.fee),prices[id],"nucleo: ribilanciamento",now);if(t){P.pos[id].core=true;ev.push(t)}}
        else{const t=paperTrade(P,id,byId[id].sym,"SELL",-diff/prices[id],prices[id],"nucleo: ribilanciamento",now);if(t)ev.push(t)}}}
    for(const id of Object.keys(P.pos)){if(P.pos[id].core&&!coreIds.includes(id)){const t=paperTrade(P,id,P.pos[id].sym,"SELL",P.pos[id].qty,prices[id],"nucleo: uscito dal perimetro",now);if(t)ev.push(t)}}
    P.lastRebal=now;P.lastExp=exp*100;P.lastStyle=sty.name}
  // 3. satelliti: solo segnali confermati, mai con derivati surriscaldati
  eq=paperEquity(P,prices);
  const sats=Object.keys(P.pos).filter(id=>!P.pos[id].core);
  let satVal=sats.reduce((a,id)=>a+P.pos[id].qty*(prices[id]||0),0);
  if(!hot){const cands=RES.filter(r=>conf(r.id)==="COMPRA"&&!P.pos[r.id]&&!coreIds.includes(r.id)&&prices[r.id]&&r.t&&r.t.E50).sort((a,b)=>b.total-a.total);
    for(const r of cands){if(Object.keys(P.pos).filter(id=>!P.pos[id].core).length>=c.satMax)break;
      const room=eq*exp*sty.sat-satVal;const size=Math.min(eq*c.satCap,room,P.cash*0.98);if(size<eq*0.02)break;
      const qty=size/prices[r.id]/(1+c.slip)/(1+c.fee);const t=paperTrade(P,r.id,r.sym,"BUY",qty,prices[r.id],`segnale confermato (tot. ${r.total})`,now);
      if(t){P.pos[r.id].stop=r.t.E50;satVal+=size;ev.push(t)}}}
  const eqEnd=paperEquity(P,prices);
  P.curve.push({d:now,eq:eqEnd,btc:prices.bitcoin/P.btcStart*c.start});if(P.curve.length>3000)P.curve.splice(0,P.curve.length-3000);
  P.blocked=hot?"derivati surriscaldati: nessun nuovo acquisto":null;
  return{P,ev};
}
const API={hook,PAPER_CFG,paperStyle,paperInit,paperEquity,paperStep,KB,STABLE,SECTORS,sleep,fmt,px,pc,getJ,loadMarkets,loadLlama,candles,loadSectors,tech,fund,decide,analyze,applyRun,computeRegime,portfolioWeights,monteCarlo,kellyMult,ema,sma,med,TARGET};
if(typeof module!=="undefined"&&module.exports)module.exports=API;else root.ScoutCore=API;
})(typeof window!=="undefined"?window:globalThis);