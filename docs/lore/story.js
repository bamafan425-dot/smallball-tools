/* SmallBall Lore story renderer. Each story folder has an index.html and a story.json.
   All text from story.json is set with textContent, never as HTML. */
{
const ROOT=new URL('.',document.currentScript.src).href;
const ARCH='https://www.archives.sbforums.org/phpBB2/viewtopic.php?t=';
const app=document.getElementById('app');
const el=(t,c,txt)=>{const e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e};
const link=(txt,href)=>{const a=el('a',null,txt);a.href=href;return a};
const thread=id=>/^\d+$/.test(String(id))?ARCH+id:String(id);
function render(s,chars){
  const root=el('div','wrap st');if(s.accent)root.style.setProperty('--ac',s.accent);
  document.title=s.title+' · SmallBall Lore';
  const hero=el('section','st-hero');
  const k=el('div','st-kick');k.append(link('← SmallBall Lore',ROOT));
  if(s.kicker)k.append(el('span',null,s.kicker));hero.append(k);
  const h=el('h1');h.append(document.createTextNode(s.title));if(s.titleAccent){const sp=el('span',null,s.titleAccent);h.append(sp)}hero.append(h);
  if(s.dates)hero.append(el('p','st-dates',s.dates));
  if(s.dek)hero.append(el('p','st-dek',s.dek));
  if(s.card){const c=el('div','st-card');c.append(el('div','num',s.card.num||''));const t=el('div');t.append(el('b',null,s.card.name),el('span',null,s.card.line||''));c.append(t);hero.append(c)}
  root.append(hero);
  if(s.stats&&s.stats.length){const g=el('div','st-stats');s.stats.forEach(([n,l])=>{const d=el('div');d.append(el('b',null,n),el('span',null,l));g.append(d)});root.append(g)}
  const sec=el('section','st-sec');sec.append(el('h2',null,s.logTitle||'The story'));
  const ol=el('ol','st-log');
  (s.chapters||[]).forEach(c=>{const li=el('li');if(c.id)li.id=c.id;li.append(el('time',null,c.date||''));
    const h3=el('h3',null,c.title||'');if(c.tag)h3.append(el('span','tag',c.tag));li.append(h3);
    (Array.isArray(c.text)?c.text:[c.text]).filter(Boolean).forEach(p=>li.append(el('p',null,p)));
    (c.quotes||[]).forEach(q=>{const b=el('blockquote');b.append(el('p',null,'“'+q[0]+'”'));if(q[1])b.append(el('cite',null,'— '+q[1]));li.append(b)});
    if(c.links&&c.links.length){const p=el('p','src');c.links.forEach(([t,u],i)=>{if(i)p.append(document.createTextNode(' · '));p.append(link(t,u))});li.append(p)}
    if(c.thread){const p=el('p','src');p.append(link('Read the original thread','https://www.archives.sbforums.org/phpBB2/viewtopic.php?t='+c.thread));li.append(p)}
    ol.append(li)});
  sec.append(ol);root.append(sec);
  if(s.cast&&s.cast.length){const cs=el('section','st-sec');cs.append(el('h2',null,'Cast'));const w=el('div','st-cast');
    s.cast.forEach(id=>{const c=chars.find(x=>x.id===id);w.append(link(c?c.name:id,ROOT+'#c-'+id))});cs.append(w);root.append(cs)}
  if(s.nav&&s.nav.length){const ns=el('section','st-sec');ns.append(el('h2',null,'Keep reading'));const w=el('div','st-nav');
    s.nav.forEach(([lab,t,u])=>{const a=link('',u);a.append(el('small',null,lab),el('b',null,t));w.append(a)});ns.append(w);root.append(ns)}
  if(s.sources&&s.sources.length){const ss=el('section','st-sec');ss.append(el('h2',null,'Sources'));const ul=el('ul','st-src');
    s.sources.forEach(([t,id])=>{const li=el('li');li.append(link(t,thread(id)));ul.append(li)});ss.append(ul);
    ss.append(el('p','st-note',s.note||'Quotes are kept short and posts are summarized. Real names, contact details and personal matters that came up in the threads are left out on purpose.'));
    root.append(ss)}
  app.replaceChildren(root);
  if(location.hash){const t=document.getElementById(location.hash.slice(1));if(t)t.scrollIntoView()}
}
Promise.all([fetch('story.json').then(r=>r.json()),fetch(ROOT+'characters.json').then(r=>r.json()).catch(()=>[])])
 .then(([s,c])=>render(s,c))
 .catch(()=>{app.replaceChildren(el('p','wrap st-load','This story didn\'t load. Refresh to try again.'))});
}
