// course.js – the simulator engine: state, render, navigation, wiring.
var S,fb,prDone,cid,curCh=0,curM=0,maxUnlocked=0,maxCompleted=0,setupDone,startCh=0;
var KEY='gitcourse.progress';

// ---- persistence (localStorage, native; no library) ----
function save(){try{localStorage.setItem(KEY,JSON.stringify({mu:maxUnlocked,mc:maxCompleted,cc:curCh}))}catch(e){}}
function load(){try{var d=JSON.parse(localStorage.getItem(KEY)||'{}');if(typeof d.mu==='number')maxUnlocked=d.mu;if(typeof d.mc==='number')maxCompleted=d.mc;if(typeof d.cc==='number')startCh=d.cc}catch(e){}}

function seed(f){if(S.working.indexOf(f)<0&&S.staging.indexOf(f)<0)S.working.push(f)}
function hl(b){return (S.local[b]||[]).length}
function newC(){cid++;return 'c'+cid}
function blank(){return {HEAD:'main',local:{main:['c0']},working:[],staging:[],origin:{},upstream:{},tags:{},stash:[],reflog:[],conflict:false}}

// ====================================================================
//  CURRICULUM
//  diff = difficulty 1-4 · show controls which visuals appear
//  blurb = chapter intro · why = the friendly explainer per mission
// ====================================================================

// ====================================================================
//  TERMINAL OUTPUT
// ====================================================================
function line(t,c){var o=document.getElementById('out'),d=document.createElement('div');if(c)d.className=c;d.innerHTML=t;o.appendChild(d);o.scrollTop=o.scrollHeight}
// note() = course teaching ("what just happened"), shown in the card's explainer – NOT the terminal.
function note(t,cls){var e=document.getElementById('expl');e.style.display='block';var d=document.createElement('div');d.className=cls||'en';d.innerHTML=(cls?'':'ℹ ')+fmt(t);e.appendChild(d)}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
// fmt(): escape, then auto-wrap code (git commands, flags, <placeholders>, .gitignore, HEAD) in <code> as a monospace tell.
var GITSUB='commit|add|status|log|diff|show|branch|switch|checkout|merge|rebase|cherry-pick|restore|reset|stash|revert|reflog|tag|remote|fetch|push|pull|clone|init|rm|mv|config';
var CODE_RE=new RegExp('\\bgit\\s+(?:'+GITSUB+')(?:\\s+--?[a-zA-Z][\\w-]*)*|&lt;[^&]{1,30}?&gt;|\\.gitignore\\b|\\bHEAD(?:~\\d+|\\^\\d*)?\\b|(^|[^\\w-])(--?[a-zA-Z][\\w-]*)','g');
function fmt(t){return esc(t).replace(CODE_RE,function(m,p1,p2){return p2!==undefined?p1+'<code>'+p2+'</code>':'<code>'+m+'</code>'})}
function dots(a){return a.map(function(){return '●'}).join('')}

// ====================================================================
//  NAVIGATION
// ====================================================================
function goCh(i){
 curCh=i;curM=0;setupDone=false;save();
 document.getElementById('navmenu').style.display='none';
 if(CH[i].selfContained){enterMission(0);return}
 S=blank();CH[i].onEnter();
 cid=0;Object.keys(S.local).forEach(function(b){S.local[b].forEach(function(x){var n=parseInt(String(x).replace(/\D/g,''),10);if(n>cid)cid=n})});
 document.getElementById('out').innerHTML='';
 var ex=document.getElementById('expl');ex.innerHTML='';ex.style.display='none';
 document.getElementById('win').style.display='none';
 document.getElementById('cmd').disabled=false;
 runSetup();syncAction();render();
}
function runSetup(){var m=CH[curCh].missions[curM];if(m&&m.setup&&!setupDone){m.setup();setupDone=true}}
function syncAction(){
 var m=CH[curCh].missions[curM],ab=document.getElementById('actbtn');
 if(m&&m.action){ab.style.display='inline-flex';ab.innerHTML=m.action.label;ab.onclick=function(){m.action.run();render();check('')}}
 else ab.style.display='none';
}

// ====================================================================
//  RENDER
// ====================================================================
function render(){
 var ch=CH[curCh],sh=ch.show;
 // chapter map, grouped by section
 var mp='',lastSec='';
 CH.forEach(function(c,i){
  if(c.sec!==lastSec){mp+='<div class="sech">'+c.sec+'</div>';lastSec=c.sec}
  var locked=i>maxUnlocked,st=locked?'disabled':'',cls=i===curCh?'ch on':'ch';
  var mark=i<maxCompleted?'<span class="cdone"><i class="ti ti-check" aria-hidden="true"></i> done</span>':(locked?'<i class="ti ti-lock" aria-hidden="true"></i> locked':'open');
  mp+='<button class="'+cls+'" '+st+' data-ch="'+i+'"><span class="diff">'+'◆'.repeat(c.diff)+'</span><span class="cn">Ch '+(i+1)+' · '+mark+'</span><span class="ct">'+c.title+'</span></button>';
 });
 document.getElementById('map').innerHTML=mp;
 document.querySelectorAll('#map .ch').forEach(function(b){b.onclick=function(){goCh(+b.dataset.ch)}});
 document.getElementById('blurb').innerHTML=fmt(ch.blurb);

 // pipeline (the three areas)
 var work=document.getElementById('a-work');work.innerHTML=S.working.length?S.working.map(function(f){return '<div class="it" style="color:var(--color-text-warning)">'+f+'</div>'}).join(''):'<span class="em">clean</span>';
 var stg=document.getElementById('a-stage');stg.innerHTML=S.staging.length?S.staging.map(function(f){return '<div class="it" style="color:var(--color-text-success)">'+f+'</div>'}).join(''):'<span class="em">empty</span>';
 document.getElementById('a-hist').innerHTML='<div class="it" style="font-family:var(--font-mono);color:var(--color-text-info)">'+dots(S.local[S.HEAD]||[])+'</div><div class="it em">on '+S.HEAD+'</div>';

 // commit graph (branch + advanced chapters) + optional target end-state
 var g=document.getElementById('graph'),mt=document.getElementById('mtarget'),tgm=CH[curCh].missions[curM];
 if(sh.graph){g.style.display='block';drawGraph()}else g.style.display='none';
 if(sh.graph&&tgm&&tgm.target){mt.style.display='block';mt.innerHTML='<div class="tglabel"><i class="ti ti-target" aria-hidden="true"></i> Reach this</div>'+graphHTML(tgm.target.local,tgm.target.HEAD,false)}
 else mt.style.display='none';

 // remotes
 var rm=document.getElementById('remotes');
 if(sh.remotes){
  rm.style.display='flex';
  var cols=[{n:'local',w:'your laptop',ic:'ti-device-laptop',d:S.local.main||S.local[S.HEAD]},{n:'origin',w:'your fork',ic:'ti-git-fork',d:S.origin.main}];
  if(sh.upstream)cols.push({n:'upstream',w:'the original',ic:'ti-brand-github',d:S.upstream.main});
  rm.innerHTML=cols.map(function(c){return '<div class="rbox"><h4><i class="ti '+c.ic+'" aria-hidden="true"></i> '+c.n+'</h4><p class="rw">'+c.w+'</p><div class="it" style="font-family:var(--font-mono)">main <span style="color:var(--color-text-info)">'+(c.d?dots(c.d):'')+'</span>'+(c.d&&c.d.length?'':' <span class="em">empty</span>')+'</div></div>'}).join('');
 } else rm.style.display='none';

 // mission card
 var mch=CH[curCh],m=mch.missions[curM],sc=!!mch.selfContained;
 if(m){
  document.getElementById('mtitle').textContent='Mission '+(curM+1)+' · '+m.t;
  renderNav(mch,sc);
  document.getElementById('mbody').innerHTML=missionBody(m);
 }
}

function tok(p){var t=esc(p.t);return p.k==='arg'?'<span class="ph">'+t+'</span>':p.k==='sh'?'<span class="shtok">'+t+'</span>':'<code>'+t+'</code>'}
function skeleton(a){return a.map(tok).join(' ')}
function missionBody(m){
 if(m.lay||m.tech){
  var h='';
  if(m.lay)h+='<p class="lay">'+fmt(m.lay)+'</p>';
  if(m.tech)h+='<p class="tech">'+fmt(m.tech)+'</p>';
  if(m.syntax&&m.syntax.length===1){var p0=m.syntax[0];
   h+='<div class="syn"><div class="synline">'+tok(p0)+(p0.note?' <span class="sx">–</span> '+fmt(p0.note):'')+'</div></div>';}
  else if(m.syntax&&m.syntax.length){h+='<div class="syn"><div class="synline">'+skeleton(m.syntax)+'</div>';
   var notes=m.syntax.filter(function(p){return p.note});
   if(notes.length)h+='<ul class="synparts">'+notes.map(function(p){return '<li>'+tok(p)+' <span class="sx">–</span> '+fmt(p.note)+'</li>'}).join('')+'</ul>';
   h+='</div>';}
  if(m.goal)h+='<div class="goalrow"><span class="goalk">Your goal</span><span class="goalv">'+fmt(m.goal)+'</span></div>';
  return h;
 }
 var hb='';
 if(m.def||m.why)hb+='<p class="lay">'+fmt(m.def||m.why)+'</p>';
 if(m.g)hb+='<div class="goalrow"><span class="goalk">Goal</span><span class="goalv">'+fmt(m.g)+'</span></div>';
 if(m.do||m.h)hb+='<p class="tech" style="margin-top:9px">Try: <code>'+esc(m.do||m.h)+'</code></p>';
 return hb;
}
function missionCmd(m){return m.cmd||(m.syntax&&m.syntax[0]&&m.syntax[0].t)||(m.do||m.h||'').replace(/\s*\(.*$/,'').split(/\s+/).slice(0,2).join(' ')}
function renderNav(ch,sc){
 var nav=document.getElementById('mnav'),menu=document.getElementById('navmenu'),n=ch.missions.length,dots='',i;
 for(i=0;i<n;i++)dots+='<span class="pdot '+(i<curM?'done':i===curM?'cur':'')+'"></span>';
 menu.style.display='none';
 if(sc){
  nav.innerHTML='<button class="navx" id="navprev"'+(curM<=0?' disabled':'')+'>‹</button><span class="pdots">'+dots+'</span><button class="navx" id="navnext"'+(curM>=n-1?' disabled':'')+'>›</button><button class="navc" id="navc">contents ▾</button>';
  document.getElementById('navprev').onclick=function(){if(curM>0)goMission(curM-1)};
  document.getElementById('navnext').onclick=function(){if(curM<n-1)goMission(curM+1)};
  document.getElementById('navc').onclick=function(){menu.style.display=menu.style.display==='block'?'none':'block'};
  menu.innerHTML=ch.missions.map(function(mi,j){return '<button class="navmi'+(j===curM?' on':'')+'" data-k="'+j+'"><span class="nm">'+(j<curM?'✓':j===curM?'◉':'○')+'</span> '+(j+1)+' · <code>'+esc(missionCmd(mi))+'</code></button>'}).join('');
  menu.querySelectorAll('.navmi').forEach(function(b){b.onclick=function(){menu.style.display='none';goMission(+b.dataset.k)}});
 }else{
  nav.innerHTML='<span class="pdots">'+dots+'</span>';
  menu.style.display='none';menu.innerHTML='';
 }
}
function enterMission(k){
 var ch=CH[curCh];curM=k;setupDone=true;
 S=blank();ch.onEnter();var mm=ch.missions[k];if(mm.setup)mm.setup();
 cid=0;Object.keys(S.local).forEach(function(b){S.local[b].forEach(function(x){var n=parseInt(String(x).replace(/\D/g,''),10);if(n>cid)cid=n})});
 document.getElementById('out').innerHTML='';
 var ex=document.getElementById('expl');ex.innerHTML='';ex.style.display='none';
 document.getElementById('win').style.display='none';
 document.getElementById('cmd').disabled=false;
 document.getElementById('navmenu').style.display='none';
 syncAction();render();
}
function goMission(k){enterMission(k)}

function gcol(id,mainArr){
 if(String(id).indexOf('M')===0)return ['var(--color-background-success)','var(--color-text-success)'];      // merge
 if(String(id).indexOf('revert')>-1)return ['var(--color-background-danger)','var(--color-text-danger)'];     // revert
 if((mainArr||[]).indexOf(id)>-1)return ['var(--color-background-secondary)','var(--color-text-secondary)'];  // shared w/ main
 return ['var(--color-background-warning)','var(--color-text-warning)'];                                       // branch-only
}
function graphHTML(local,head,leg){
 var html=Object.keys(local).map(function(br){
  var nodes=local[br].map(function(id,i){
   var c=gcol(id,local.main),label=String(id).replace(/^Mc/,'M').replace(/^c/,'').replace('revert','↺');
   return (i?'<span class="gln"></span>':'')+'<span class="gnode" style="background:'+c[0]+';color:'+c[1]+'">'+label+'</span>';
  }).join('');
  return '<div class="glane"><div class="glh"><span>'+br+'</span>'+(head&&br===head?'<span class="ghead">◀ HEAD</span>':'')+'</div><div class="gnodes">'+nodes+'</div></div>';
 }).join('');
 if(leg)html+='<div class="gleg">each ● is a commit · grey = shared with main · amber = this branch only · green = merge · HEAD = you are here</div>';
 return html;
}
function drawGraph(){document.getElementById('graph').innerHTML=graphHTML(S.local,S.HEAD,true)}

// ====================================================================
//  COMMAND SIMULATOR
//  ponytail: concept-accurate, not byte-accurate git. Each handler does
//  just enough to make the lesson land, plus a teaching note().
// ====================================================================
function run(raw){
 var c=raw.trim();if(!c)return;
 // ponytail: split chained commands like a real shell. Limitation: a ';'/'&&' inside a quoted commit message would mis-split – no course hint does that.
 if(/;|&&/.test(c)){c.split(/\s*(?:;|&&)\s*/).forEach(function(p){if(p.trim())run(p)});return}
 var _e=document.getElementById('expl');_e.innerHTML='';_e.style.display='none';   // fresh explainer per command
 line("<span class='u'>$</span> "+esc(c));var m,name;

 if(c==='help'){
  line("Try these (type, then Enter):",'di');
  line("  basics   git status · git add . · git commit -m \"..\" · git log [--oneline] · git diff [--staged]",'di');
  line("  branch   git branch · git switch -c NAME · git switch NAME · git merge NAME · git branch -d/-D NAME",'di');
  line("  undo     git restore [--staged] FILE · git reset --soft/--mixed/--hard · git commit --amend",'di');
  line("  online   git remote -v · git push [-u/--force/--force-with-lease] · git pull [--rebase] · git fetch",'di');
  line("  advanced git stash [pop] · git rebase [-i] · git cherry-pick · git revert · git reflog · git tag",'di');
  line("  also     clear",'di');
 }
 else if(c==='clear'){document.getElementById('out').innerHTML=''}

 // ---- starting a repo ----
 else if(/^git\s+init/.test(c)){S.local={main:[]};S.inited=true;line("Initialized empty Git repository in ./.git/",'ok');note("git is now watching this folder. Nothing committed yet – run git status to see “No commits yet.”")}
 else if(/^git\s+clone\s+\S/.test(c)){S.local={main:['c0','c1']};S.origin={main:['c0','c1']};line("Cloning into 'courses'...",'di');line("remote: counting objects: done.",'di');line("done – you now have a full copy + an 'origin' remote.",'ok');note("clone = init + download all history + remember the URL as 'origin', in one command.")}

 // ---- status / log / diff / show ----
 else if(/^git\s+status/.test(c)){
  if(S.inited===false||(S.local.main&&S.local.main.length===0)){line("On branch main\nNo commits yet",'di')}
  else line("On branch "+S.HEAD,'di');
  if(S.conflict===true){line("You have unmerged paths (fix conflicts then git add):",'er');line("  both modified:  title.txt",'er')}
  if(S.staging.length)line("Changes to be committed:  "+S.staging.join(', '),'ok');
  if(S.working.length)line("Changes not staged:  "+S.working.join(', '),'er');
  if(!S.staging.length&&!S.working.length&&S.conflict!==true&&!(S.local.main&&S.local.main.length===0))line("nothing to commit, working tree clean",'di');
 }
 else if(/^git\s+log\b/.test(c)){
  var commits=(S.local[S.HEAD]||[]).slice().reverse();
  if(!commits.length){line("no commits yet",'di')}
  else if(/--oneline/.test(c)){commits.forEach(function(x){line(String(x).slice(0,7)+" commit "+x,'di')});note("--oneline = the everyday view. Add --graph to draw branches in text.")}
  else commits.forEach(function(x){line("commit "+x+"\n  (author, date, message…)",'di')});
 }
 else if(/^git\s+diff\s+(--staged|--cached)/.test(c)){if(S.staging.length){line("diff – staged changes about to be committed:",'di');S.staging.forEach(function(f){line("  "+f+":  - old line\n           + new line",'ok')})}else line("(nothing staged to diff)",'di');note("diff --staged shows what's IN the box. Plain git diff shows what's still on your desk.")}
 else if(/^git\s+diff\b/.test(c)){if(S.working.length){line("diff – unstaged changes in your working folder:",'di');S.working.forEach(function(f){line("  "+f+":  - old line\n           + new line",'wn')})}else line("(no unstaged changes – try git diff --staged)",'di')}
 else if(/^git\s+show\b/.test(c)){var last=(S.local[S.HEAD]||[]).slice(-1)[0];line("commit "+(last||'–')+"\n  shows the full changes introduced by that one commit.",'di')}

 // ---- staging ----
 else if(/^git\s+add\b/.test(c)){
  if(/\s-p\b/.test(c)){line("(interactive) stage this hunk? [y,n,q,?]",'di');note("git add -p walks you through each change so you stage only the bits you mean to.");}
  else if(!S.working.length){line("nothing to add",'di')}
  else{var f=c.replace(/^git\s+add\s*/,'').replace(/-A|--all/,'').trim();
   if(f&&f!=='.'){var i=S.working.indexOf(f);if(i>-1){S.staging.push(S.working.splice(i,1)[0]);if(S.conflict===true)S.conflict='resolved';line("",'di')}else line("pathspec '"+f+"' did not match – try git add .",'er')}
   else{var ig=(S.ignored&&S.working.indexOf('debug.log')>-1)?['debug.log']:[];S.staging=S.staging.concat(S.working.filter(function(f){return ig.indexOf(f)<0}));S.working=ig;if(S.conflict===true)S.conflict='resolved';line("",'di')}
   if(S.conflict==='resolved')note("conflict marked resolved – now git commit to finish the merge.");
  }
 }

 // ---- undo: restore / reset / amend ----
 else if(/^git\s+restore\s+--staged\s+\S/.test(c)){name=c.split(/\s+/).pop();var j=S.staging.indexOf(name);if(j>-1){S.working.push(S.staging.splice(j,1)[0]);line("unstaged "+name,'ok');note("file is back on your desk, edits intact – just not packed for the next commit.")}else line("not staged: "+name,'di')}
 else if(/^git\s+restore\s+\S/.test(c)||/^git\s+checkout\s+--\s+\S/.test(c)){name=c.split(/\s+/).pop();var k=S.working.indexOf(name);if(k>-1){S.working.splice(k,1);line("restored "+name+" to last committed version",'ok');note("that working-folder edit is gone for good – restore overwrites with the committed version.")}else line("nothing to restore for "+name,'di')}
 else if(/^git\s+reset\s+(--soft|--mixed|--hard)/.test(c)){
  var mode=(c.match(/--(soft|mixed|hard)/)||[])[1];
  if((S.local[S.HEAD]||[]).length>1){var popped=S.local[S.HEAD].pop();
   if(mode==='soft'){S.staging.push(popped);line("HEAD moved back 1 – the commit's changes are back in STAGING.",'ok')}
   else if(mode==='mixed'){S.working.push(popped);line("HEAD moved back 1 – changes are back in your WORKING folder (unstaged).",'ok')}
   else{line("HEAD moved back 1 – changes DISCARDED.",'wn');note("--hard threw those changes away. If that was a mistake, the “Safe undo & recovery” chapter's reflog can usually get them back.")}
  }else line("nothing to reset past",'di')}
 else if(/^git\s+reset\s+\S/.test(c)){name=c.replace(/^git\s+reset\s+(HEAD\s+)?/,'').trim();var z=S.staging.indexOf(name);if(z>-1){S.working.push(S.staging.splice(z,1)[0]);line("unstaged "+name,'ok')}else line("(reset) nothing staged named "+name,'di');note("git reset HEAD FILE is the old way to unstage – git restore --staged FILE is the modern wording.")}
 else if(/^git\s+commit\s+--amend/.test(c)){if((S.local[S.HEAD]||[]).length){if(S.staging.length){S.staging=[]}line("amended the last commit (new message / folded-in changes).",'ok');note("--amend rewrites the most recent commit. Safe in private; never amend something you've already pushed.")}else line("no commit to amend",'er')}

 // ---- commit ----
 else if(/^git\s+commit\b/.test(c)){
  if(S.conflict==='resolved'){S.conflict=false;S.staging=[];S.working=[];if(S.local.main.indexOf('fx')<0)S.local.main.push('fx');S.local[S.HEAD].push('M'+newC());line("Merge made – conflict resolved and committed.",'ok')}
  else if(/-a(m|\s|$)/.test(c)&&S.working.length){S.staging=S.staging.concat(S.working);S.working=[];S.local[S.HEAD].push(newC());var n2=S.staging.length;S.staging=[];line("["+S.HEAD+" "+('c'+cid)+"] "+(c.match(/-m\s+"?([^"]*)"?/)||[,'commit'])[1],'ok');note("-am added tracked files AND committed in one step.")}
  else if(!S.staging.length)line("nothing to commit (stage a file first with git add)",'er');
  else{S.local[S.HEAD].push(newC());var n=S.staging.length;S.staging=[];line("["+S.HEAD+" "+('c'+cid)+"] "+(c.match(/-m\s+"?([^"]*)"?/)||[,'commit'])[1],'ok');line(" "+n+" file(s) changed",'di')}
 }

 // ---- branches ----
 else if((m=c.match(/^git\s+(?:checkout\s+-b|switch\s+-c)\s+(\S+)/))){name=m[1];if(S.local[name])line("fatal: branch '"+name+"' already exists",'er');else{S.local[name]=S.local[S.HEAD].slice();S.prev=S.HEAD;S.HEAD=name;if(name!=='main')fb=name;line("Switched to a new branch '"+name+"'",'ok')}}
 else if((m=c.match(/^git\s+branch\s+(-d|-D)\s+(\S+)/))){var force=m[1]==='-D';name=m[2];if(!S.local[name]){line("branch '"+name+"' not found",'er')}else if(name===S.HEAD){line("can't delete the branch you're on – switch away first",'er')}else{var merged=(S.local[name]||[]).every(function(x){return (S.local.main||[]).indexOf(x)>-1});if(!merged&&!force){line("error: branch '"+name+"' is not fully merged. Use -D to force.",'er')}else{delete S.local[name];line("Deleted branch "+name,'ok');note(force?"-D force-deleted it (its commits may now be unreachable – reflog could still find them).":"-d deleted it safely (it was fully merged).")}}}
 else if(/^git\s+branch\s*$/.test(c))Object.keys(S.local).forEach(function(b){line((b===S.HEAD?'* ':'  ')+b,b===S.HEAD?'ok':null)});
 else if((m=c.match(/^git\s+branch\s+(\S+)/))){name=m[1];if(!S.local[name]){S.local[name]=S.local[S.HEAD].slice();line("Created branch '"+name+"' (use git switch to move to it)",'ok')}else line("branch exists",'er')}
 else if(/^git\s+(switch|checkout)\s+-\s*$/.test(c)){if(S.prev&&S.local[S.prev]){var t=S.HEAD;S.HEAD=S.prev;S.prev=t;line("Switched to branch '"+S.HEAD+"'",'ok');note("the bare dash jumps to the branch you were just on – alt-tab for branches.")}else line("no previous branch to switch to",'di')}
 else if((m=c.match(/^git\s+(?:checkout|switch)\s+(\S+)/))){name=m[1];if(S.local[name]){S.prev=S.HEAD;S.HEAD=name;line("Switched to branch '"+name+"'",'ok')}else line("error: '"+name+"' did not match any branch",'er')}

 // ---- merge ----
 else if(/^git\s+merge\s+--abort/.test(c)){if(S.conflict){S.conflict=false;line("Merge aborted – back to where you started, no harm done.",'ok')}else line("no merge in progress",'di')}
 else if((m=c.match(/^git\s+merge\s+(?:--no-ff\s+)?(\S+)/))){name=m[1];
  if(!S.local[name]){line("merge: "+name+" - not something we can merge",'er')}
  else{
   var theirs=S.local[name],mine=S.local[S.HEAD];
   var bothMoved=theirs.some(function(x){return mine.indexOf(x)<0})&&mine.some(function(x){return theirs.indexOf(x)<0});
   var conflictPair=(name==='feature'&&S.HEAD==='main'&&mine.indexOf('mx')>-1&&theirs.indexOf('fx')>-1);
   if(conflictPair){S.conflict=true;S.working.push('title.txt');line("Auto-merging title.txt",'di');line("CONFLICT (content): both changed the same line in title.txt",'er');line("Automatic merge failed; fix conflicts then git add + git commit.",'wn');note("Not broken! Open title.txt, delete the <<< === >>> markers, keep the lines you want, then git add it.")}
   else{theirs.forEach(function(x){if(mine.indexOf(x)<0)mine.push(x)});if(bothMoved||/--no-ff/.test(c)){mine.push('M'+newC());line("Merge made by the 'ort' strategy – created a merge commit (M).",'ok')}else line("Fast-forward – "+S.HEAD+" slid forward to include "+name+".",'ok')}
  }}

 // ---- stash ----
 else if(/^git\s+stash\s+list/.test(c)){if(S.stash.length)S.stash.forEach(function(s,i){line("stash@{"+i+"}: WIP on "+S.HEAD+": "+(s.files?s.files.join(', '):s),'di')});else line("(no stashes)",'di')}
 else if(/^git\s+stash\s+(pop|apply)/.test(c)){if(!S.stash.length){line("No stash entries found.",'di')}else{var item=/pop/.test(c)?S.stash.shift():S.stash[0];S.working=S.working.concat(item.files);line((/pop/.test(c)?"Popped":"Applied")+" stash – your changes are back.",'ok');note(/pop/.test(c)?"pop also removed it from the drawer.":"apply kept a copy in the drawer (git stash drop to remove).")}}
 else if(/^git\s+stash(\s+(push|-u|--include-untracked))?\s*$/.test(c)||/^git\s+stash\s+push/.test(c)){if(!S.working.length&&!S.staging.length){line("No local changes to save",'di')}else{S.stash.unshift({files:S.working.concat(S.staging)});S.working=[];S.staging=[];line("Saved working directory and index state – desk is clean.",'ok');note("your changes are parked. git stash pop brings them back.")}}

 // ---- rebase ----
 else if(/^git\s+rebase\s+-i/.test(c)){var nm=c.match(/HEAD~(\d+)/);var nn=nm?+nm[1]:2;var b=S.local[S.HEAD];if(b.length>nn){var keep=b.slice(0,b.length-nn);keep.push('squashed');S.local[S.HEAD]=keep}line("(interactive) pick / squash / reword … – the chosen commits melted into one.",'ok');note("rebase -i rewrites the chosen commits into one tidy commit. Only on commits you haven't pushed.")}
 else if((m=c.match(/^git\s+rebase\s+(\S+)/))){name=m[1];if(!S.local[name]){line("invalid base: "+name,'er')}else{var base=S.local[name].slice(),mineOnly=S.local[S.HEAD].filter(function(x){return base.indexOf(x)<0});S.local[S.HEAD]=base.concat(mineOnly);line("Successfully rebased "+S.HEAD+" onto "+name+" – one clean line.",'ok');note("your commits were replanted on top of "+name+" (with new ids). Never do this to shared commits.")}}

 // ---- cherry-pick ----
 else if((m=c.match(/^git\s+cherry-pick\s+(\S+)/))){name=m[1];var src=null;Object.keys(S.local).forEach(function(b){if(S.local[b].indexOf(name)>-1)src=b});if(!src){line("bad revision '"+name+"'",'er')}else if(S.local[S.HEAD].indexOf(name)>-1){line("commit already on this branch",'di')}else{S.local[S.HEAD].push(name);line("[" +S.HEAD+"] cherry-picked "+name+" – copied as a new commit here.",'ok');note("just that one commit's changes came over; the rest of "+src+" stayed put.")}}

 // ---- revert ----
 else if((m=c.match(/^git\s+revert\s+(\S+)/))){name=m[1];if(S.local[S.HEAD].indexOf(name)<0){line("bad revision '"+name+"'",'er')}else{S.local[S.HEAD].push('revert-'+name);line("Created a new commit that undoes "+name+".",'ok');note("revert doesn't erase history – it adds an opposite commit. That's why it's safe on shared branches.")}}

 // ---- reflog ----
 else if(/^git\s+reflog/.test(c)){(S.reflog.length?S.reflog:['(current): here']).forEach(function(r,i){line("HEAD@{"+i+"}: "+r,'di')});note("every move HEAD makes is logged here. To recover a 'lost' commit: git reset --hard <its id>.")}

 // ---- tags ----
 else if((m=c.match(/^git\s+tag\s+-a\s+(\S+)/))){name=m[1];S.tags[name]=(S.local[S.HEAD]||[]).slice(-1)[0];line("Created annotated tag "+name+" (with message + author).",'ok');note("annotated tags are the standard for real releases – richer and signable.")}
 else if((m=c.match(/^git\s+tag\s+(\S+)/))&&!/^-/.test(m[1])){name=m[1];S.tags[name]=(S.local[S.HEAD]||[]).slice(-1)[0];line("Created lightweight tag "+name+" – a permanent bookmark on this commit.",'ok')}
 else if(/^git\s+tag\s*$/.test(c)){var tg=Object.keys(S.tags);if(tg.length)tg.forEach(function(t){line(t,'di')});else line("(no tags yet)",'di')}

 // ---- remotes / push / pull / fetch ----
 else if(/^git\s+remote/.test(c)){line("origin    https://github.com/you/project.git (fetch)");line("origin    ...(push)",'di');if(CH[curCh].show.upstream){line("upstream  https://github.com/anthropics/project.git (fetch)");line("upstream  ...(push)",'di')}}
 else if(/^git\s+fetch/.test(c)){line("Fetched new commits – downloaded, nothing merged yet.",'ok');note("fetch is the cautious half of pull. Look around, then merge when ready.")}
 else if(/^git\s+push.*(--force-with-lease)/.test(c)){name=fb||S.HEAD;S.origin[name]=S.local[name].slice();line("Force-pushed "+name+" (with lease) – remote updated safely.",'ok');note("succeeded because the remote hadn't changed since you fetched. If a teammate had pushed, this would have ABORTED instead of overwriting them.")}
 else if(/^git\s+push.*(--force|\s-f(\s|$))/.test(c)){name=fb||S.HEAD;S.origin[name]=S.local[name].slice();line("Force-updated "+name+" – remote now matches your version.",'wn');note("DANGER: --force overwrote the remote with zero checks. If anyone had pushed work you didn't have, it's gone. Prefer --force-with-lease.")}
 else if(/^git\s+push\s+(origin\s+)?--tags\b/.test(c)){line("Pushed all tags to origin.",'ok');note("git push --tags (or git push origin --tags) sends every local tag at once.")}
 else if((m=c.match(/^git\s+push(?:\s+-u)?\s+\S+\s+(\S+)/))){name=m[1];if(/^v/.test(name)&&S.tags[name]){line("Pushed tag "+name+" to origin.",'ok');note("tags don't upload with a normal push – you have to send them explicitly.")}else if(!S.local[name]){line("src refspec "+name+" does not match any",'er')}else{var ff=!S.origin[name]||S.local[name].slice(0,S.origin[name].length).join()===S.origin[name].join();if(!ff){line("! [rejected]  "+name+" -> "+name+" (non-fast-forward)",'er');line("Updates were rejected – the remote has commits you don't. Pull, or force.",'wn')}else{S.origin[name]=S.local[name].slice();line("To origin – "+name+" -> "+name+(/-u/.test(c)?'  (upstream set)':''),'ok');if(/-u/.test(c))note("-u linked local "+name+" to origin/"+name+". From now, bare git push/pull just work.")}}}
 else if(/^git\s+push\s+--tags/.test(c)){line("Pushed all tags to origin.",'ok')}
 else if(/^git\s+push\s*$/.test(c)){name=S.HEAD;var ff2=!S.origin[name]||S.local[name].slice(0,(S.origin[name]||[]).length).join()===(S.origin[name]||[]).join();if(S.origin[name]&&!ff2){line("! [rejected]  (non-fast-forward)",'er');line("The remote has diverged from you. Pull --rebase, or force-with-lease.",'wn')}else if(S.origin[name]){S.origin[name]=S.local[name].slice();line("To origin – pushed "+name,'ok')}else line("no upstream set – try git push -u origin "+name,'di')}
 else if(/^git\s+pull\s+--rebase/.test(c)){name=S.HEAD;var rem=(S.origin[name]||[]).slice();var mineO=S.local[name].filter(function(x){return rem.indexOf(x)<0});S.local[name]=rem.concat(mineO);line("Rebased your local commits on top of the latest "+name+" – straight line, no merge bubble.",'ok')}
 else if(/^git\s+pull\s+upstream\s+main/.test(c)){S.local[S.HEAD]=S.upstream.main.slice();line("From upstream – Fast-forward into "+S.HEAD,'ok')}
 else if((m=c.match(/^git\s+pull(?:\s+\S+)?\s+(\S+)/))||(m=/^git\s+pull\s*$/.test(c)?[,S.HEAD]:null)){name=m[1];if(S.origin[name]){S.local[name]=S.origin[name].slice();line("From origin – updated "+name+" (fetch + merge).",'ok')}else line("couldn't find remote ref "+name,'er')}

 else line(esc(c.split(' ')[0])+": not a command I know here – type help",'er');

 render();check(c);
}

// ====================================================================
//  PROGRESS CHECKING
// ====================================================================
function check(c){
 var ms=CH[curCh].missions;if(curM>=ms.length)return;
 if(ms[curM].chk(c)){
  note("✓ "+ms[curM].t+" – done",'erc');
  if(curM+1>=ms.length){curM++;chapterDone();return}
  if(CH[curCh].selfContained){
   var nk=curM+1,e=document.getElementById('expl'),b=document.createElement('button');
   b.className='contb';b.textContent='Continue → '+ms[nk].t;b.onclick=function(){enterMission(nk)};
   e.appendChild(b);document.getElementById('cmd').disabled=true;
  }else{curM++;setupDone=false;runSetup();syncAction();render();note("→ Next: "+ms[curM].t,'erp')}
 }
}
function chapterDone(){
 if(curCh+1>maxUnlocked)maxUnlocked=curCh+1;
 if(curCh+1>maxCompleted)maxCompleted=curCh+1;
 save();render();
 if(CH[curCh].recap)note("📝 Recap – "+CH[curCh].recap,'erp');
 if(curCh===CH.length-1){grad();return}
 var w=document.getElementById('win');w.style.display='block';
 w.innerHTML="<strong style='font-weight:500'><i class='ti ti-check' aria-hidden='true'></i> Chapter "+(curCh+1)+" complete!</strong> “"+CH[curCh+1].title+"” is unlocked.";
 var b=document.createElement('button');b.style.marginTop='10px';b.style.fontSize='13px';b.innerHTML="Start chapter "+(curCh+2)+" →";b.onclick=function(){goCh(curCh+1)};
 w.appendChild(document.createElement('br'));w.appendChild(b);
}
function grad(){
 document.getElementById('cmd').disabled=true;
 var w=document.getElementById('win');w.style.display='block';
 w.innerHTML="<strong style='font-weight:500'><i class='ti ti-trophy' aria-hidden='true'></i> Course complete.</strong><br>You went from “what's a repo?” to rebasing, force-pushing safely, and recovering lost commits with the reflog. That's the whole toolkit – go build something.";
}

// ====================================================================
//  WIRING
// ====================================================================
document.getElementById('cmd').addEventListener('keydown',function(e){if(e.key==='Enter'){run(this.value);this.value=''}});
document.getElementById('resetb').onclick=function(){goCh(curCh)};
document.addEventListener('click',function(e){var mm=document.getElementById('navmenu');if(mm&&mm.style.display==='block'&&e.target&&e.target.closest&&!e.target.closest('#navmenu')&&!e.target.closest('#navc'))mm.style.display='none'});
document.getElementById('unlockb').onclick=function(){maxUnlocked=CH.length-1;save();render();line("All chapters unlocked – jump anywhere from the map above.",'ok')};
document.getElementById('wipeb').onclick=function(){if(confirm("Wipe all saved progress and start over from Chapter 1?")){try{localStorage.removeItem(KEY)}catch(e){}maxUnlocked=0;maxCompleted=0;startCh=0;goCh(0)}};

load();
goCh(Math.min(startCh,CH.length-1));
