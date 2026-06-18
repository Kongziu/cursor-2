/* Logika quizu PKM II */
(function(){
  "use strict";
  const TOPICS = window.TOPICS, QUESTIONS = window.QUESTIONS;
  const $ = id => document.getElementById(id);
  const screens = {setup:$('setup'), quiz:$('quiz'), results:$('results')};
  const LETTERS = ['A','B','C','D'];
  const BEST_KEY = 'pkm_quiz_best_v1';

  const state = {
    selected: new Set(Object.keys(TOPICS)),
    count: 20,          // 0 == wszystkie
    instant: true,
    shuffle: true,
  };
  let game = null, timerId = null;

  /* ---------- ekran startowy ---------- */
  function buildTopics(){
    const list = $('topicList'); list.innerHTML = '';
    Object.entries(TOPICS).forEach(([k,v])=>{
      const cnt = QUESTIONS.filter(q=>q.t===k).length;
      const d = document.createElement('div');
      d.className = 'topic sel'; d.dataset.k = k;
      d.innerHTML = '<span class="ico">'+v.ico+'</span>'+
        '<span class="meta"><b>'+v.name+'</b><span>'+cnt+' pytań</span></span>'+
        '<span class="chk">\u2713</span>';
      d.onclick = ()=>{
        if(state.selected.has(k)){ state.selected.delete(k); d.classList.remove('sel'); }
        else{ state.selected.add(k); d.classList.add('sel'); }
        refreshSetup();
      };
      list.appendChild(d);
    });
  }

  function poolSize(){ return QUESTIONS.filter(q=>state.selected.has(q.t)).length; }

  function buildCountSeg(){
    const seg = $('countSeg'); seg.innerHTML = '';
    [10,20,30,0].forEach(n=>{
      const b = document.createElement('button');
      b.textContent = n===0 ? 'Wszystkie' : n;
      b.dataset.n = n;
      b.onclick = ()=>{ state.count = n; refreshSetup(); };
      seg.appendChild(b);
    });
  }

  function refreshSetup(){
    const pool = poolSize();
    // dezaktywuj opcje liczby > pula
    $('countSeg').querySelectorAll('button').forEach(b=>{
      const n = +b.dataset.n;
      const disabled = n!==0 && n>pool;
      b.disabled = disabled;
      b.classList.toggle('on', n===state.count && !disabled);
    });
    // jeśli wybrana liczba > pula, zejdź do "Wszystkie"
    if(state.count!==0 && state.count>pool){ state.count = 0; refreshSetup(); return; }
    const eff = state.count===0 ? pool : Math.min(state.count, pool);
    $('poolCount').textContent = pool;
    $('effCount').textContent = eff;
    $('startBtn').disabled = pool===0;
  }

  function shuffleArr(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

  function showScreen(name){
    Object.values(screens).forEach(s=>s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function loadBest(){
    try{ return JSON.parse(localStorage.getItem(BEST_KEY)); }catch(e){ return null; }
  }
  function renderBest(){
    const b = loadBest();
    $('bestBox').innerHTML = b
      ? 'Najlepszy wynik: <b>'+b.pct+'%</b> ('+b.score+'/'+b.total+')'
      : 'Brak zapisanego wyniku — zagraj pierwszy raz!';
  }

  /* ---------- przebieg quizu ---------- */
  function startQuiz(){
    let pool = QUESTIONS.filter(q=>state.selected.has(q.t)).map(q=>{
      let opts = q.a.map((text,i)=>({text, correct:i===q.c}));
      if(state.shuffle) shuffleArr(opts);
      return {t:q.t, q:q.q, e:q.e, opts};
    });
    if(state.shuffle) shuffleArr(pool);
    const n = state.count===0 ? pool.length : Math.min(state.count, pool.length);
    pool = pool.slice(0, n);
    game = {pool, idx:0, score:0, answers:[], instant:state.instant, startTs:Date.now()};
    $('qTot').textContent = pool.length;
    showScreen('quiz');
    startTimer();
    renderQ();
  }

  function startTimer(){
    stopTimer();
    timerId = setInterval(()=>{
      const s = Math.floor((Date.now()-game.startTs)/1000);
      const m = String(Math.floor(s/60)).padStart(2,'0');
      const ss = String(s%60).padStart(2,'0');
      $('timer').textContent = m+':'+ss;
    }, 500);
  }
  function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }

  function renderQ(){
    const g = game, item = g.pool[g.idx];
    $('qNum').textContent = g.idx+1;
    $('liveScore').textContent = g.score;
    $('progBar').style.width = (g.idx/g.pool.length*100)+'%';
    $('qTopic').textContent = TOPICS[item.t].name;
    $('qText').textContent = item.q;
    const fb = $('feedback'); fb.className = 'feedback'; fb.innerHTML = '';
    const hb = $('hintBox'); hb.className = 'hintbox'; hb.innerHTML = '';
    const hbtn = $('hintBtn');
    hbtn.style.display = item.h ? 'inline-block' : 'none';
    hbtn.disabled = false;
    const wrap = $('answers'); wrap.innerHTML = '';
    item.opts.forEach((o,i)=>{
      const el = document.createElement('div');
      el.className = 'ans'; el.dataset.i = i;
      el.style.animationDelay = (i*0.04)+'s';
      el.innerHTML = '<span class="lt">'+LETTERS[i]+'</span><span class="atext">'+o.text+'</span>';
      el.onclick = ()=>choose(i);
      wrap.appendChild(el);
    });
    const last = g.idx===g.pool.length-1;
    $('nextBtn').disabled = true;
    $('nextBtn').innerHTML = last ? 'Zakończ \u2713' : 'Dalej \u2192';
  }

  function choose(i){
    const g = game, item = g.pool[g.idx];
    if(item._answered) return;
    item._answered = true;
    const correctIdx = item.opts.findIndex(o=>o.correct);
    const isCorrect = item.opts[i].correct;
    if(isCorrect) g.score++;
    g.answers.push({t:item.t, q:item.q, e:item.e,
      pickText:item.opts[i].text, corrText:item.opts[correctIdx].text, ok:isCorrect});
    const nodes = $('answers').children;
    for(const n of nodes) n.classList.add('locked');
    if(g.instant){
      nodes[i].classList.add(isCorrect?'correct':'wrong');
      nodes[correctIdx].classList.add('correct');
      const fb = $('feedback');
      fb.className = 'feedback show '+(isCorrect?'ok':'no');
      fb.innerHTML = '<div class="ftitle">'+(isCorrect?'\u2714 Poprawna odpowiedź!':'\u2717 Niepoprawnie')+'</div>'+
        '<div class="fexp">'+item.e+'</div>';
    }else{
      nodes[i].classList.add('sel');
    }
    $('liveScore').textContent = g.score;
    $('nextBtn').disabled = false;
    $('nextBtn').focus();
  }

  function nextQ(){
    const g = game;
    if(g.idx===g.pool.length-1) return showResults();
    g.idx++; renderQ();
  }

  function showHint(){
    const g = game; if(!g) return;
    const item = g.pool[g.idx];
    if(!item || !item.h) return;
    const hb = $('hintBox');
    hb.className = 'hintbox show';
    hb.innerHTML = '<b>\uD83D\uDCA1 Wskazówka:</b> ' + item.h;
    $('hintBtn').disabled = true;
  }

  /* ---------- wyniki ---------- */
  function showResults(){
    stopTimer();
    const g = game;
    const tot = g.pool.length, sc = g.score, pct = tot?Math.round(sc/tot*100):0;
    const secs = Math.floor((Date.now()-g.startTs)/1000);
    const tstr = String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
    showScreen('results');

    const ring = $('ring');
    ring.style.setProperty('--p', 0);
    requestAnimationFrame(()=>requestAnimationFrame(()=>ring.style.setProperty('--p', pct)));
    $('ringPct').textContent = pct+'%';
    $('finalScore').textContent = sc+' / '+tot+' pkt';
    $('finalTime').textContent = 'Czas: '+tstr;

    let grade, color, oc;
    if(pct>=90){grade='5,0 — Doskonale! \uD83C\uDFC6';color='#22c55e';}
    else if(pct>=75){grade='4,0 — Bardzo dobrze \uD83D\uDC4D';color='#4ade80';}
    else if(pct>=60){grade='3,5 — Dobrze \uD83D\uDC4C';color='#a3e635';}
    else if(pct>=50){grade='3,0 — Dostatecznie \uD83D\uDCD8';color='#fbbf24';}
    else{grade='2,0 — Wymaga powtórki \uD83D\uDCDA';color='#f43f5e';}
    const gEl=$('finalGrade'); gEl.textContent=grade; gEl.style.color=color;

    // best score
    const prev = loadBest();
    const isBest = !prev || pct>prev.pct;
    $('newBest').style.display = isBest ? 'inline-block' : 'none';
    if(isBest){ try{ localStorage.setItem(BEST_KEY, JSON.stringify({pct,score:sc,total:tot})); }catch(e){} }

    // breakdown per topic
    const bd = {};
    g.answers.forEach(a=>{ bd[a.t]=bd[a.t]||{ok:0,n:0}; bd[a.t].n++; if(a.ok)bd[a.t].ok++; });
    const bdEl = $('breakdown'); bdEl.innerHTML = '<div class="section-label">Wyniki wg tematów</div>';
    Object.keys(TOPICS).forEach(k=>{
      if(!bd[k]) return;
      const p = Math.round(bd[k].ok/bd[k].n*100);
      const row = document.createElement('div'); row.className='brow';
      row.innerHTML = '<div class="bname">'+TOPICS[k].ico+' '+TOPICS[k].name+'</div>'+
        '<div class="btrack"><div class="bfill" style="width:0"></div></div>'+
        '<div class="bval">'+bd[k].ok+'/'+bd[k].n+'</div>';
      bdEl.appendChild(row);
      requestAnimationFrame(()=>{ row.querySelector('.bfill').style.width = p+'%'; });
    });

    // review wrong answers
    const rev = $('review');
    const wrong = g.answers.filter(a=>!a.ok);
    if(wrong.length===0){
      rev.innerHTML = '<div class="allgood">\uD83C\uDF89 Komplet! Wszystkie odpowiedzi poprawne.</div>';
    }else{
      let html = '<h3>Pytania do powtórki ('+wrong.length+')</h3>';
      wrong.forEach(a=>{
        html += '<div class="ritem">'+
          '<div class="rtopic">'+TOPICS[a.t].name+'</div>'+
          '<div class="rq">'+a.q+'</div>'+
          '<div class="ra bad">Twoja odpowiedź: '+a.pickText+'</div>'+
          '<div class="ra corr">Poprawnie: '+a.corrText+'</div>'+
          '<div class="rexp">'+a.e+'</div>'+
        '</div>';
      });
      rev.innerHTML = html;
    }
  }

  /* ---------- klawiatura ---------- */
  document.addEventListener('keydown', e=>{
    if(screens.quiz.classList.contains('hidden')) return;
    const g = game; if(!g) return;
    const item = g.pool[g.idx];
    const key = e.key.toLowerCase();
    const map = {a:0,b:1,c:2,d:3,'1':0,'2':1,'3':2,'4':3};
    if(key==='h'){ e.preventDefault(); showHint(); return; }
    if(!item._answered && key in map){
      const idx = map[key];
      if(idx < item.opts.length){ e.preventDefault(); choose(idx); }
    }else if(item._answered && (e.key==='Enter'||e.key===' '||e.key==='ArrowRight')){
      e.preventDefault(); nextQ();
    }
  });

  /* ---------- podpięcie zdarzeń ---------- */
  $('startBtn').onclick = startQuiz;
  $('nextBtn').onclick = nextQ;
  $('hintBtn').onclick = showHint;
  $('quitBtn').onclick = ()=>{ if(game){ showResults(); } };
  $('againBtn').onclick = startQuiz;
  $('setupBtn').onclick = ()=>{ showScreen('setup'); renderBest(); };
  $('tInstant').onchange = e=>state.instant = e.target.checked;
  $('tShuffle').onchange = e=>state.shuffle = e.target.checked;
  $('tInstant').checked = state.instant;
  $('tShuffle').checked = state.shuffle;

  buildTopics();
  buildCountSeg();
  refreshSetup();
  renderBest();
})();
