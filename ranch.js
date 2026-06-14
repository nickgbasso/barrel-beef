"use strict";
/* ===========================================================================
   RANCH ENGINE — shared lobby + WebRTC netcode + 3D helpers for the whole
   game collection. A game provides a GAME object; RanchNet.start(GAME) wires
   up the home/lobby/join screens, PeerJS matchmaking (2–4 players + bots +
   solo), the host-authoritative main loop, and snapshot interpolation.
   Host simulates everything and broadcasts snapshots; clients send input.
   =========================================================================== */
window.COLORS=[{hex:0x22e3ff,css:"#22e3ff",name:"CYAN"},{hex:0xff3ea5,css:"#ff3ea5",name:"MAGENTA"},
  {hex:0xb6ff3e,css:"#b6ff3e",name:"LIME"},{hex:0xff9f1c,css:"#ff9f1c",name:"ORANGE"}];
const MAX_SLOTS=4, ALPHA="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* ---------------- shared CSS ---------------- */
(function injectCSS(){ const s=document.createElement("style"); s.textContent=`
:root{--cyan:#22e3ff;--mag:#ff3ea5;--lime:#b6ff3e;--orange:#ff9f1c;--ink:#e8ecff;--dim:#8a93b8}
*{box-sizing:border-box} html,body{height:100%;margin:0}
body{background:radial-gradient(120% 120% at 50% -10%,#161d3a 0%,#0a0d18 60%);color:var(--ink);
  font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;overflow:hidden;-webkit-user-select:none;user-select:none}
canvas{display:block;width:100vw;height:100vh;position:fixed;inset:0;cursor:crosshair}
.hidden{display:none!important}
#overlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,9,18,.82);backdrop-filter:blur(5px);z-index:10}
.panel{width:min(560px,93vw);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#141a33,#0d1226);
  border:1px solid #2a335f;border-radius:18px;padding:26px 30px 22px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.05);text-align:center}
.logo{font-weight:900;letter-spacing:2px;font-size:36px;line-height:1.05;margin:0 0 4px;
  background:linear-gradient(90deg,var(--cyan),var(--mag));-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 30px rgba(34,227,255,.25)}
.sub{color:var(--dim);font-size:13px;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px}
.btn{appearance:none;border:0;cursor:pointer;font-weight:800;letter-spacing:1px;color:#06101c;border-radius:12px;padding:14px 18px;font-size:16px;width:100%;
  background:linear-gradient(90deg,var(--cyan),#7bf0ff);box-shadow:0 10px 30px rgba(34,227,255,.25);transition:transform .06s,filter .15s;margin-top:10px}
.btn.alt{background:linear-gradient(90deg,var(--mag),#ff8ec8);box-shadow:0 10px 30px rgba(255,62,165,.25)}
.btn.lime{background:linear-gradient(90deg,var(--lime),#dcff9a);box-shadow:0 10px 30px rgba(182,255,62,.22)}
.btn.ghost{background:#1b2244;color:var(--ink);box-shadow:none;border:1px solid #2c3768}
.btn:disabled{opacity:.4;cursor:not-allowed} .btn:hover:not(:disabled){filter:brightness(1.05)} .btn:active:not(:disabled){transform:translateY(1px) scale(.995)}
input.code{width:100%;margin-top:14px;background:#0a0f22;border:1px solid #2c3768;border-radius:12px;color:var(--ink);font-size:24px;letter-spacing:8px;text-align:center;padding:14px;text-transform:uppercase;font-weight:800}
input.code:focus{outline:none;border-color:var(--cyan)}
.hint{color:var(--dim);font-size:12.5px;line-height:1.5;margin-top:14px}
.codebox{margin-top:14px;background:#0a0f22;border:1px dashed #34406f;border-radius:12px;padding:14px}
.codebig{font-size:40px;font-weight:900;letter-spacing:12px;color:var(--cyan);text-shadow:0 0 24px rgba(34,227,255,.35)}
.small{font-size:12px;color:var(--dim);letter-spacing:1px}
.link{margin-top:10px;display:flex;gap:8px;align-items:center}
.link input{flex:1;background:#0a0f22;border:1px solid #2c3768;border-radius:10px;color:var(--dim);font-size:12px;padding:9px}
.copy{cursor:pointer;border:1px solid #2c3768;background:#161d3a;color:var(--ink);border-radius:10px;padding:9px 12px;font-weight:700;font-size:12px}
.copy:hover{border-color:var(--cyan)}
.status{margin-top:14px;font-size:14px;color:var(--dim);min-height:20px}.status b{color:var(--cyan)}.err{color:#ff6b6b!important}
.keys{display:flex;gap:12px;justify-content:center;margin-top:16px;flex-wrap:wrap}.keys div{font-size:12px;color:var(--dim)}
.keys b{color:var(--ink);background:#1a2143;border:1px solid #2c3768;border-radius:6px;padding:2px 7px;font-family:ui-monospace,Consolas,monospace}
.spinner{width:20px;height:20px;border:3px solid #2c3768;border-top-color:var(--cyan);border-radius:50%;display:inline-block;vertical-align:middle;animation:spin .8s linear infinite;margin-right:8px}
@keyframes spin{to{transform:rotate(360deg)}}
.alllink{margin-top:14px;display:inline-block;color:var(--dim);font-size:12px;text-decoration:none;border-bottom:1px dotted #46507e}
.alllink:hover{color:var(--cyan)}
#slotList{margin-top:6px;display:flex;flex-direction:column;gap:8px}
.slot{display:flex;align-items:center;gap:12px;background:#0c1126;border:1px solid #232b52;border-radius:12px;padding:10px 12px}
.swatch{width:18px;height:18px;border-radius:5px;flex:0 0 auto;box-shadow:0 0 12px currentColor}
.slot .nm{font-weight:800;letter-spacing:1px;flex:1;text-align:left}.slot .tag{font-size:11px;color:var(--dim);letter-spacing:1px}
.slot .act{cursor:pointer;border:1px solid #2c3768;background:#161d3a;color:var(--ink);border-radius:8px;padding:6px 10px;font-weight:700;font-size:12px}
.slot .act:hover{border-color:var(--cyan)}
.footer{position:fixed;bottom:8px;left:0;right:0;text-align:center;color:#41496f;font-size:11px;z-index:5;letter-spacing:1px}
#topHud{position:fixed;top:0;left:0;right:0;z-index:6;display:flex;justify-content:center;pointer-events:none}
#topHud .bar{display:flex;align-items:center;gap:10px;margin-top:14px;background:rgba(8,12,26,.6);border:1px solid #232b52;border-radius:14px;padding:8px 16px;backdrop-filter:blur(3px);font-weight:800}
.scp{display:flex;align-items:center;gap:7px;font-weight:900;font-size:20px;padding:2px 8px;border-radius:8px}
.scp .dot{width:12px;height:12px;border-radius:4px;box-shadow:0 0 10px currentColor}.scp.me{outline:2px solid rgba(255,255,255,.5)}
#ping{position:fixed;top:14px;right:16px;z-index:6;font-size:12px;color:var(--dim);background:rgba(8,12,26,.6);border:1px solid #232b52;border-radius:8px;padding:6px 10px}
#botHud{position:fixed;bottom:14px;left:0;right:0;z-index:6;display:flex;justify-content:center;gap:10px;pointer-events:none}
#evt{position:fixed;top:56px;left:0;right:0;text-align:center;z-index:6;pointer-events:none}
#evt span{display:inline-block;background:rgba(20,8,30,.7);border:1px solid #5a2a6a;color:#ffd6ff;font-weight:800;letter-spacing:3px;font-size:14px;border-radius:10px;padding:6px 16px;opacity:0;transition:opacity .3s}
#evt.show span{opacity:1}
.toast{position:fixed;left:0;right:0;top:36%;text-align:center;z-index:7;pointer-events:none}
.toast span{font-weight:900;font-size:54px;letter-spacing:3px;background:linear-gradient(90deg,var(--cyan),var(--mag));-webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 0 50px rgba(34,227,255,.3);opacity:0;transition:opacity .2s,transform .2s;display:inline-block}
.toast.show span{opacity:1;transform:scale(1.04)}
`; document.head.appendChild(s); })();

/* ---------------- DOM scaffold ---------------- */
function buildDOM(GAME){
  const root=document.createElement("div"); root.innerHTML=`
  <div id="topHud" class="hidden"><div class="bar" id="topBar"></div></div>
  <div id="ping" class="hidden">connecting…</div>
  <div id="evt"><span id="evtTxt"></span></div>
  <div id="botHud" class="hidden"></div>
  <div class="toast" id="toast"><span id="toastTxt"></span></div>
  <div id="overlay">
    <div class="panel" id="screenHome">
      <h1 class="logo">${GAME.name}</h1><div class="sub">${GAME.tag||""}</div>
      <button class="btn" id="btnCreate">HOST ONLINE</button>
      <button class="btn alt" id="btnJoinScreen">JOIN A GAME</button>
      <button class="btn lime" id="btnSolo">${GAME.soloLabel||"SINGLE PLAYER"}</button>
      ${GAME.homeHint||""}
      <a class="alllink" href="index.html">← all games</a>
    </div>
    <div class="panel hidden" id="screenLobby">
      <h1 class="logo" id="lobbyTitle">LOBBY</h1><div class="sub" id="lobbySub"></div>
      <div class="codebox hidden" id="lobbyCodeBox"><div class="codebig" id="roomCode">····</div><div class="small">room code</div>
        <div class="link"><input id="shareLink" readonly value=""/><button class="copy" id="copyLink">COPY LINK</button></div></div>
      <div id="slotList"></div>
      <button class="btn" id="btnStart" style="margin-top:16px">START</button>
      <div class="status hidden" id="lobbyWait"></div>
      <button class="btn ghost" id="lobbyBack" style="margin-top:12px">← leave</button>
    </div>
    <div class="panel hidden" id="screenJoin">
      <h1 class="logo">JOIN GAME</h1><div class="sub">type the room code</div>
      <input class="code" id="joinInput" maxlength="5" placeholder="CODE" autocomplete="off"/>
      <button class="btn alt" id="btnJoin" style="margin-top:14px">CONNECT</button>
      <div class="status" id="joinStatus"></div>
      <button class="btn ghost" id="joinBack" style="margin-top:14px">← back</button>
    </div>
    <div class="panel hidden" id="screenDC">
      <h1 class="logo">DISCONNECTED</h1><div class="sub" id="dcMsg">connection lost</div>
      <button class="btn" id="dcHome" style="margin-top:20px">BACK TO MENU</button>
    </div>
  </div>
  <div class="footer">3D · peer-to-peer over WebRTC · part of THE RANCH</div>`;
  while(root.firstChild) document.body.appendChild(root.firstChild);
}

/* ===========================================================================
   RanchNet — networking + lobby + main loop
   =========================================================================== */
const RanchNet=(function(){
  let GAME=null;
  let peer=null,conns={},hostConn=null,isHost=false,online=false,connected=false,myIdx=0;
  let slots=null, gameRunning=false, last=0, netAcc=0, fdt=0, curCode="";
  let inputs=[null,null,null,null];
  let pingMs=0,lastPingSent=0,pingT0=0, wantAgain=false;
  const snap={prev:null,cur:null};
  const ICE={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"},
    {urls:"turn:openrelay.metered.ca:80",username:"openrelayproject",credential:"openrelayproject"},
    {urls:"turn:openrelay.metered.ca:443",username:"openrelayproject",credential:"openrelayproject"}]};
  function randCode(){ let s=""; for(let i=0;i<4;i++)s+=ALPHA[Math.floor(Math.random()*ALPHA.length)]; return s; }
  function newPeer(id){ return new Peer(id,{config:ICE,debug:1}); }
  function broadcast(o){ for(const k in conns){ const c=conns[k]; if(c&&c.open){try{c.send(o)}catch(e){}} } }
  function $(id){ return document.getElementById(id); }

  /* ---- HOST ---- */
  function startHost(attempt){ attempt=attempt||0; isHost=true; online=true;
    const code=randCode(); curCode=code; setCode(code);
    slots=[{kind:"human",name:"YOU"},{kind:"empty"},{kind:"empty"},{kind:"empty"}]; renderLobby();
    peer=newPeer((GAME.id||"ranch")+"-"+code);
    peer.on("error",err=>{ if(err.type==="unavailable-id"&&attempt<6){try{peer.destroy()}catch(e){}; startHost(attempt+1); return;}
      $("lobbyWait").classList.remove("hidden"); $("lobbyWait").innerHTML='<span class="err">network error: '+err.type+'</span>'; });
    peer.on("connection",c=>{ const slot=firstEmpty();
      if(slot<0){ c.on("open",()=>{try{c.send({t:"full"})}catch(e){}; setTimeout(()=>{try{c.close()}catch(e){}},300);}); return; }
      slots[slot]={kind:"human",name:COLORS[slot].name}; conns[slot]=c; c._slot=slot;
      c.on("open",()=>{ try{c.send({t:"welcome",slot})}catch(e){}; pushLobby(); });
      c.on("data",d=>onHostData(slot,d)); c.on("close",()=>clientGone(slot)); c.on("error",()=>clientGone(slot));
      renderLobby(); });
  }
  function firstEmpty(){ for(let i=1;i<MAX_SLOTS;i++) if(slots[i].kind==="empty")return i; return -1; }
  function onHostData(slot,d){ if(d.t==="in"){ inputs[slot]=d; }
    else if(d.t==="ping"){ const c=conns[slot]; if(c&&c.open)try{c.send({t:"pong",id:d.id})}catch(e){} }
    else if(d.t==="again"){ if(GAME.snapshotPhase&&GAME.snapshotPhase()!=="play") doRematch(); } }
  function clientGone(slot){ if(conns[slot]){try{conns[slot].close()}catch(e){} delete conns[slot];}
    if(gameRunning && GAME.onPlayerLeft) GAME.onPlayerLeft(slot);
    if(gameRunning){ slots[slot]={kind:"bot",name:COLORS[slot].name}; } else { slots[slot]={kind:"empty"}; pushLobby(); }
    renderLobby(); }
  function pushLobby(){ broadcast({t:"lobby",slots}); renderLobby(); }

  /* ---- CLIENT ---- */
  function joinGame(code){ isHost=false; online=true; curCode=code;
    $("joinStatus").innerHTML='<span class="spinner"></span>connecting to room <b>'+code+'</b>…';
    peer=newPeer(undefined); let opened=false;
    peer.on("open",()=>{ const c=peer.connect((GAME.id||"ranch")+"-"+code,{reliable:true}); hostConn=c;
      const ft=setTimeout(()=>{ if(!opened)$("joinStatus").innerHTML='<span class="err">no answer. check the code & that your friend hosted.</span>'; },9000);
      c.on("open",()=>{ opened=true; clearTimeout(ft); connected=true; });
      c.on("data",onClientData); c.on("close",onDisconnect); c.on("error",()=>{ if(!opened)$("joinStatus").innerHTML='<span class="err">couldn\'t reach that room.</span>'; }); });
    peer.on("error",err=>{ if(err.type==="peer-unavailable")$("joinStatus").innerHTML='<span class="err">room not found. double-check the code.</span>';
      else $("joinStatus").innerHTML='<span class="err">network error: '+err.type+'</span>'; });
  }
  function onClientData(d){ if(d.t==="welcome")myIdx=d.slot;
    else if(d.t==="full")$("joinStatus").innerHTML='<span class="err">room is full (4 players).</span>';
    else if(d.t==="lobby"){ slots=d.slots; showScreen("screenLobby"); renderLobby(); }
    else if(d.t==="start"){ slots=d.slots; beginMatch(); }
    else if(d.t==="state"){ d.rt=performance.now(); snap.prev=snap.cur; snap.cur=d; if(GAME.ingest)GAME.ingest(d); }
    else if(d.t==="pong"){ if(d.id===lastPingSent)pingMs=Math.round(performance.now()-pingT0); }
  }
  function sendHost(o){ if(hostConn&&hostConn.open){try{hostConn.send(o)}catch(e){}} }
  setInterval(()=>{ if(!isHost&&connected&&hostConn&&hostConn.open){ lastPingSent=(lastPingSent+1)%1e5; pingT0=performance.now(); sendHost({t:"ping",id:lastPingSent}); } },1500);
  function onDisconnect(){ if(!connected&&!gameRunning)return; connected=false; gameRunning=false;
    $("dcMsg").textContent="connection to host lost"; hideHUD(); $("overlay").classList.remove("hidden"); showScreen("screenDC"); }

  /* ---- lobby UI ---- */
  function setCode(code){ $("roomCode").textContent=code; $("shareLink").value=location.origin+location.pathname+"?room="+code; }
  function renderLobby(){
    const list=$("slotList"); list.innerHTML=""; const amHost=(isHost||!online);
    for(let i=0;i<MAX_SLOTS;i++){ const s=slots?slots[i]:{kind:"empty"}; const row=document.createElement("div"); row.className="slot";
      const sw=document.createElement("div"); sw.className="swatch"; sw.style.background=COLORS[i].css; sw.style.color=COLORS[i].css;
      const nm=document.createElement("div"); nm.className="nm"; nm.style.color=COLORS[i].css;
      const tag=document.createElement("div"); tag.className="tag";
      if(s.kind==="human"){ nm.textContent=(i===0&&amHost)?"YOU":(i===myIdx&&!isHost&&online?"YOU":COLORS[i].name); tag.textContent="player"; }
      else if(s.kind==="bot"){ nm.textContent=COLORS[i].name; tag.textContent="bot"; }
      else { nm.textContent="empty"; nm.style.color="#566"; tag.textContent=""; }
      row.appendChild(sw); row.appendChild(nm); row.appendChild(tag);
      if(amHost&&i!==0){ const b=document.createElement("button"); b.className="act";
        if(s.kind==="empty"){ b.textContent="+ BOT"; b.onclick=()=>{ slots[i]={kind:"bot",name:COLORS[i].name}; online?pushLobby():renderLobby(); }; row.appendChild(b); }
        else if(s.kind==="bot"){ b.textContent="REMOVE"; b.onclick=()=>{ slots[i]={kind:"empty"}; online?pushLobby():renderLobby(); }; row.appendChild(b); } }
      list.appendChild(row); }
    const start=$("btnStart"), wait=$("lobbyWait");
    $("lobbyCodeBox").classList.toggle("hidden", !(online&&isHost));
    const minS=GAME.minStart||2;
    if(amHost){ start.classList.remove("hidden"); wait.classList.add("hidden");
      const n=slots.filter(s=>s.kind!=="empty").length; start.disabled=n<minS;
      start.textContent=n<minS?("NEED "+minS+"+"):(GAME.startLabel||"START");
      $("lobbyTitle").textContent= online?(GAME.lobbyTitle||"LOBBY"):(GAME.soloTitle||"SOLO");
      $("lobbySub").textContent= online?(GAME.lobbySub||"add bots or wait for friends"):(GAME.soloSub||"add bots, then start");
    } else { start.classList.add("hidden"); wait.classList.remove("hidden");
      wait.innerHTML='<span class="spinner"></span>'+(GAME.waitText||"waiting for the host to start…");
      $("lobbyTitle").textContent=GAME.lobbyTitle||"LOBBY"; $("lobbySub").textContent="you're in — get ready"; }
  }
  function activeSlots(){ return slots.map((s,i)=>(s.kind==="human"||s.kind==="bot")?i:-1).filter(i=>i>=0); }

  /* ---- match flow ---- */
  function beginMatch(){
    inputs=[null,null,null,null]; snap.prev=snap.cur=null; wantAgain=false;
    const meta={ slots:slots.map(s=>({kind:s.kind})), myIdx, isHost:(isHost||!online), online, colors:COLORS };
    if(isHost||!online) GAME.buildState(meta); GAME.onStart&&GAME.onStart(meta);
    $("overlay").classList.add("hidden"); $("topHud").classList.remove("hidden"); $("ping").classList.remove("hidden"); $("botHud").classList.remove("hidden");
    gameRunning=true; last=performance.now(); requestAnimationFrame(loop);
  }
  function hostStart(){ const minS=GAME.minStart||2; if(slots.filter(s=>s.kind!=="empty").length<minS)return;
    if(online){ broadcast({t:"start",slots}); } beginMatch(); }
  function doRematch(){ if(!(isHost||!online))return; GAME.rematch&&GAME.rematch(); }

  function loop(ts){ if(!gameRunning)return; const dt=Math.min(0.05,(ts-last)/1000)||0; last=ts; fdt=dt;
    if(isHost||!online){
      inputs[myIdx]=GAME.input();
      const act=activeSlots();
      for(const i of act){ if(slots[i].kind==="bot") inputs[i]=GAME.botInput?GAME.botInput(i):null; }
      const sshot=GAME.step(dt,inputs);
      netAcc+=dt*1000; if(netAcc>=33){ netAcc=0; if(online)broadcast(sshot); }
      GAME.render(sshot,{myIdx,isHost:true,online}); handleEnd(sshot);
    } else {
      sendHost(Object.assign({t:"in"},GAME.input()));
      const f=interp(); if(f){ GAME.render(f,{myIdx,isHost:false,online}); handleEnd(f); }
    }
    $("ping").textContent=(online?(pingMs?("ping "+pingMs+"ms"):"online"):"local")+((isHost||!online)?" · host":" · guest");
    requestAnimationFrame(loop);
  }
  function interp(){ const a=snap.prev,b=snap.cur; if(!b)return null; if(!a)return b;
    const rt=performance.now()-95; let t=(rt-a.rt)/((b.rt-a.rt)||1); t=Math.max(0,Math.min(1,t));
    return GAME.interp?GAME.interp(a,b,t):b; }
  let endShown=false;
  function handleEnd(f){ const ph=f.ph||"play";
    if(ph!=="play"&&!endShown){ endShown=true; toast(GAME.endText?GAME.endText(f,myIdx):"GAME OVER");
      setTimeout(()=>{ if(GAME.snapshotPhase&&GAME.snapshotPhase()!=="play") toast((isHost||!online)?(GAME.againText||"SPACE = AGAIN"):"waiting for host…",true); },1500); }
    if(ph==="play"&&endShown){ endShown=false; }
    if(ph!=="play"&&wantAgain){ wantAgain=false; if(isHost||!online)doRematch(); else sendHost({t:"again"}); }
  }

  /* ---- helpers exposed ---- */
  function showScreen(id){ ["screenHome","screenLobby","screenJoin","screenDC"].forEach(s=>$(s).classList.toggle("hidden",s!==id)); }
  function hideHUD(){ $("topHud").classList.add("hidden"); $("ping").classList.add("hidden"); $("botHud").classList.add("hidden"); }
  function cleanup(){ gameRunning=false; connected=false; online=false; for(const k in conns){try{conns[k].close()}catch(e){}} conns={};
    try{if(hostConn)hostConn.close()}catch(e){} try{if(peer)peer.destroy()}catch(e){} hostConn=null; peer=null; hideHUD(); }
  let toastTimer=null;
  function toast(text,sticky){ const t=$("toast"),s=$("toastTxt"); s.textContent=text; t.classList.add("show"); clearTimeout(toastTimer);
    if(!sticky)toastTimer=setTimeout(()=>t.classList.remove("show"),1300); }
  function event(text){ const e=$("evt"),t=$("evtTxt"); if(text){ t.textContent=text; e.classList.add("show"); } else e.classList.remove("show"); }

  function start(game){ GAME=game; buildDOM(game);
    addEventListener("keydown",e=>{ if(e.code==="Space"||e.code==="Enter") wantAgain=true; });
    if(game.init) game.init();
    let AC=null; const ac=()=>{ if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}} window.__AC=AC; };
    $("btnCreate").onclick=()=>{ ac(); myIdx=0; conns={}; showScreen("screenLobby"); startHost(); };
    $("btnSolo").onclick=()=>{ ac(); isHost=true; online=false; myIdx=0; conns={};
      slots=[{kind:"human",name:"YOU"},{kind:(game.minStart||2)>1?"bot":"empty",name:COLORS[1].name},{kind:"empty"},{kind:"empty"}];
      showScreen("screenLobby"); renderLobby(); };
    $("btnJoinScreen").onclick=()=>{ ac(); showScreen("screenJoin"); $("joinInput").focus(); };
    $("btnStart").onclick=()=>hostStart();
    $("lobbyBack").onclick=()=>{ cleanup(); showScreen("screenHome"); };
    $("joinBack").onclick=()=>{ cleanup(); showScreen("screenHome"); };
    $("dcHome").onclick=()=>{ cleanup(); showScreen("screenHome"); };
    $("btnJoin").onclick=doJoin; $("joinInput").addEventListener("keydown",e=>{ if(e.key==="Enter")doJoin(); });
    function doJoin(){ const code=$("joinInput").value.trim().toUpperCase(); if(code.length<4){ $("joinStatus").innerHTML='<span class="err">enter the 4-character code.</span>'; return; } ac(); joinGame(code); }
    $("copyLink").onclick=()=>{ const inp=$("shareLink"); inp.select(); inp.setSelectionRange(0,999);
      navigator.clipboard?.writeText(inp.value).then(()=>{ const b=$("copyLink"); b.textContent="COPIED!"; setTimeout(()=>b.textContent="COPY LINK",1400); }).catch(()=>{try{document.execCommand("copy")}catch(e){}}); };
    const room=new URLSearchParams(location.search).get("room");
    if(room){ showScreen("screenJoin"); $("joinInput").value=room.toUpperCase(); $("joinStatus").innerHTML='room ready — hit <b>CONNECT</b>'; }
  }
  return { start, toast, event, slots:()=>slots, fdt:()=>fdt, game:()=>GAME };
})();

/* ===========================================================================
   Ranch3D — shared Three.js helpers (fixed angled cam, particles, shake, ground ray)
   =========================================================================== */
function Ranch3D(canvas, opt){
  opt=opt||{}; const W=opt.W||1200, D=opt.D||720;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2)); renderer.setSize(innerWidth,innerHeight);
  const scene=new THREE.Scene(); scene.background=new THREE.Color(opt.bg!=null?opt.bg:0x0a0d18);
  scene.fog=new THREE.Fog(opt.bg!=null?opt.bg:0x0a0d18, opt.fogNear||1300, opt.fogFar||2800);
  const camera=new THREE.PerspectiveCamera(opt.fov||55, innerWidth/innerHeight, 1, 7000);
  const camBase=new THREE.Vector3(W/2, opt.camH||1080, D/2+(opt.camZ||640));
  camera.position.copy(camBase); camera.lookAt(W/2,0,D/2);
  const ray=new THREE.Raycaster(), plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  scene.add(new THREE.HemisphereLight(opt.hemiTop||0x88aaff,opt.hemiBot||0x0a0d18,0.95));
  const dl=new THREE.DirectionalLight(opt.dirCol||0xffffff,1.1); dl.position.set(W*0.25,1400,D*0.1); scene.add(dl);
  let shake=0; const particles=[], ppool=[];
  for(let i=0;i<160;i++){ const m=new THREE.Mesh(new THREE.BoxGeometry(5,5,5),new THREE.MeshBasicMaterial({color:0xffffff})); m.visible=false; scene.add(m); ppool.push(m); }
  addEventListener("resize",()=>{ renderer.setSize(innerWidth,innerHeight); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); });
  function floorGrid(fc,g1,g2){ const f=new THREE.Mesh(new THREE.BoxGeometry(W+8,20,D+8),new THREE.MeshStandardMaterial({color:fc!=null?fc:0x0c1124,roughness:0.95,metalness:0.05}));
    f.position.set(W/2,-10,D/2); scene.add(f);
    const g=new THREE.GridHelper(Math.max(W,D),Math.round(Math.max(W,D)/40),g1!=null?g1:0x2c3768,g2!=null?g2:0x1a2244); g.position.set(W/2,1.2,D/2); scene.add(g); return f; }
  function walls(obs,col,emis,edge){ const wm=new THREE.MeshStandardMaterial({color:col!=null?col:0x141b38,roughness:0.75,metalness:0.15,emissive:emis!=null?emis:0x14304a,emissiveIntensity:0.3});
    function box(x,z,w,d,h){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wm); m.position.set(x+w/2,h/2,z+d/2); scene.add(m);
      const e=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),new THREE.LineBasicMaterial({color:edge!=null?edge:0x3aa7ff,transparent:true,opacity:0.45})); e.position.copy(m.position); scene.add(e); }
    const t=24; box(-t,-t,W+2*t,t,60); box(-t,D,W+2*t,t,60); box(-t,0,t,D,60); box(W,0,t,D,60);
    if(obs)for(const o of obs)box(o.x,o.z,o.w,o.d,55); }
  function boom(x,z,css,rad){ const col=new THREE.Color(css), n=Math.min(40,12+Math.floor(rad/4));
    for(let i=0;i<n;i++){ const a=Math.random()*6.28, e=Math.random()*1.4, sp=60+Math.random()*(rad*4+120);
      particles.push({x,y:14,z,vx:Math.cos(a)*Math.cos(e)*sp,vy:Math.sin(e)*sp*1.3+90,vz:Math.sin(a)*Math.cos(e)*sp,life:0.5+Math.random()*0.4,age:0,col}); }
    shake=Math.max(shake,Math.min(16,rad/6+6)); }
  function groundPoint(ms){ const ndc=new THREE.Vector2((ms.x/innerWidth)*2-1, -(ms.y/innerHeight)*2+1); ray.setFromCamera(ndc,camera);
    const hit=ray.ray.intersectPlane(plane,new THREE.Vector3()); return hit?{x:hit.x,z:hit.z}:{x:W/2,z:D/2}; }
  function render(dt){ // step particles + shake + draw
    dt=dt||0.016;
    for(let k=particles.length-1;k>=0;k--){ const p=particles[k]; p.age+=dt; if(p.age>=p.life){particles.splice(k,1);continue;}
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; p.vy-=440*dt; p.vx*=0.96; p.vz*=0.96; if(p.y<2){p.y=2;p.vy*=-0.4;} }
    let qi=0; for(const p of particles){ if(qi>=ppool.length)break; const m=ppool[qi++]; m.visible=true; m.position.set(p.x,p.y,p.z); m.scale.setScalar((1-p.age/p.life)*6+1); m.material.color.copy(p.col); }
    for(;qi<ppool.length;qi++)ppool[qi].visible=false;
    let sx=0,sy=0; if(shake>0){ sx=(Math.random()*2-1)*shake; sy=(Math.random()*2-1)*shake; shake*=0.86; if(shake<0.4)shake=0; }
    camera.position.set(camBase.x+sx,camBase.y+sy,camBase.z+sx); camera.lookAt(W/2,0,D/2);
    renderer.render(scene,camera);
  }
  function idle(){ camera.position.set(W/2+Math.sin(performance.now()/4000)*140,camBase.y,camBase.z); camera.lookAt(W/2,0,D/2); renderer.render(scene,camera); }
  return { scene, camera, renderer, W, D, floorGrid, walls, boom, groundPoint, render, idle, setShake:v=>{shake=Math.max(shake,v)}, fog:scene.fog };
}
window.Ranch3D=Ranch3D; window.RanchNet=RanchNet;
