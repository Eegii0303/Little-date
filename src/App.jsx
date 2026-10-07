import React,{useEffect,useMemo,useState,useRef}from'react';

import{Heart,ArrowLeft,Copy,Check,CalendarDays,MapPin,Gift,Sparkles,Lock,ExternalLink}from'lucide-react';

import{supabase}from'./supabase';

const themes=[{id:'midnight',name:'Midnight Love',emoji:'🌙',desc:'Deep plum & glowing pink'},{id:'pastel',name:'Sweet Pastel',emoji:'🧸',desc:'Soft pink & cream'},{id:'rose',name:'Rose Romance',emoji:'🌹',desc:'Burgundy & gold'},{id:'minimal',name:'Minimal',emoji:'🤍',desc:'Clean and simple'},{id:'starlight',name:'Starlight',emoji:'✨',desc:'A sky full of stars'}];

const places=['Coffee','Dinner','Movie night','A long walk'],foods=['Sushi','Pizza','Pasta','Burgers','Korean food','Dessert'],bring=['Flowers','Something sweet','A playlist','Just me'],then=['Dessert','Stargazing','A drive','Not going home'];

const id=()=>Math.random().toString(36).slice(2,10);

function readLocal(){try{return JSON.parse(localStorage.getItem('little-date')||'{}')}catch{return{}}}

async function hashToken(value){
  const bytes=new TextEncoder().encode(value);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function createManageToken(){
  const bytes=new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

export default function App(){

  const[route,setRoute]=useState(location.pathname),

  [mode,setMode]=useState('surprise'),

  [form,setForm]=useState({sender:'',recipient:'',creator_email:'',place:'Coffee',date:'',time:'7:00 PM',bring:'Flowers',then:'Stargazing',theme:'midnight'}),

  [step,setStep]=useState(0),

  [inv,setInv]=useState(null),

  [date,setDate]=useState(''),

  [planStep,setPlanStep]=useState(1),

  [planTime,setPlanTime]=useState('6:00 PM'),

  [choice,setChoice]=useState({place:'',bring:'',then:''}),

  [busy,setBusy]=useState(false),

  [msg,setMsg]=useState(''),

  [url,setUrl]=useState(''),

  [premium,setPremium]=useState(false),

  [noDodge,setNoDodge]=useState(false),

  [noPos,setNoPos]=useState({x:0,y:0}),

  [myInvites,setMyInvites]=useState([]),
  [viewUrl,setViewUrl]=useState('');



const noButtonRef=useRef(null);

const lastDodgeRef=useRef(0);

const isInvite=route.startsWith('/i/');
const isManage=route.startsWith('/v/');

const previewMode=new URLSearchParams(location.search).get('preview')==='1';

const inviteId=route.split('/')[2];
const manageSlug=isManage?route.split('/')[2]:null;
const manageToken=new URLSearchParams(location.search).get('token')||'';

const theme=themes.find(t=>t.id===(inv?.theme||form.theme))||themes[0];

const update=(k,v)=>setForm(f=>({...f,[k]:v}));useEffect(()=>{

  const pop=()=>setRoute(location.pathname);addEventListener('popstate',pop);

  return()=>removeEventListener('popstate',pop)},[]);

  useEffect(()=>{
  if(!isInvite||!inviteId||!supabase)return;
  (async()=>{
    const {data,error}=await supabase.rpc('get_invitation',{p_slug:inviteId});
    if(error){console.error('Could not load invitation:',error);setInv(null);return}
    setInv(data||null);
    if(data)supabase.rpc('log_invitation_event',{p_slug:inviteId,p_event_type:'link_opened',p_metadata:{}}).catch(()=>{});
  })();
},[route,isInvite,inviteId]);

useEffect(()=>{
  if(!isManage||!manageSlug||!manageToken||!supabase)return;
  (async()=>{
    try{
      const tokenHash=await hashToken(manageToken);
      const {data,error}=await supabase.rpc('get_manage_invitation',{p_slug:manageSlug,p_manage_token_hash:tokenHash});
      if(error||!data){setInv(null);setMsg('This response link is invalid or expired.');return}
      setInv(data);
    }catch(e){setInv(null);setMsg('Could not open the response page.')}
  })();
},[route,isManage,manageSlug,manageToken]);

useEffect(()=>{const d=readLocal();setMyInvites(Object.values(d).filter(x=>x.sender))},[route]);

useEffect(()=>{
  const q=new URLSearchParams(location.search);
  if(q.get('payment')==='success'&&q.get('slug')&&supabase){
    const slug=q.get('slug');let alive=true;
    (async()=>{
      setBusy(true);setMsg('Payment received. Confirming your invitation…');
      for(let n=0;n<12&&alive;n++){
        const {data,error}=await supabase.rpc('get_invitation',{p_slug:slug});
        if(error)break;
        if(data){
          const draft=readLocal()[slug];
          setInv(data);setUrl(`${location.origin}/i/${slug}`);
          if(draft?.manage_token)setViewUrl(`${location.origin}/v/${slug}?token=${encodeURIComponent(draft.manage_token)}`);
          setStep(9);setMsg('Your invitation is ready!');
          try{localStorage.removeItem('little-date-draft')}catch{}
          break;
        }
        await new Promise(r=>setTimeout(r,1500));
      }
      if(alive&&!readLocal()[slug])setMsg('Payment is processing. Refresh this page in a moment to see your invitation.');
      setBusy(false);
    })();
    return()=>{alive=false};
  }
  if(q.get('payment')==='cancel')setMsg('Checkout was cancelled. Your invitation was not published.');
},[]);

function nav(path){history.pushState({},'',path);setRoute(location.pathname);setMsg('');document.querySelector('main')?.scrollTo({left:0,behavior:'smooth'})}

function dodgeNo(mouseX,mouseY){

  const now=Date.now();



  if(now-lastDodgeRef.current<220)return;



  const button=noButtonRef.current;

  if(!button)return;



  const rect=button.getBoundingClientRect();

  const centerX=rect.left+rect.width/2;

  const centerY=rect.top+rect.height/2;



  let dx=centerX-mouseX;

  let dy=centerY-mouseY;



  const distance=Math.hypot(dx,dy);



  if(distance===0){

    dx=Math.random()-0.5;

    dy=Math.random()-0.5;

  }



  const length=Math.hypot(dx,dy)||1;



  const moveDistance=110;



  let x=(dx/length)*moveDistance;

  let y=(dy/length)*moveDistance;



  x=Math.max(-130,Math.min(130,x));

  y=Math.max(-80,Math.min(80,y));



  lastDodgeRef.current=now;



  setNoPos({

    x:Math.round(x),

    y:Math.round(y)

  });

}

function handleActionsMouseMove(e){

  if(!inv?.no_dodge)return;



  const button=noButtonRef.current;

  if(!button)return;



  const rect=button.getBoundingClientRect();



  const dx=Math.max(

    rect.left-e.clientX,

    0,

    e.clientX-rect.right

  );



  const dy=Math.max(

    rect.top-e.clientY,

    0,

    e.clientY-rect.bottom

  );



  const distance=Math.hypot(dx,dy);



  if(distance<=40){

    dodgeNo(e.clientX,e.clientY);

  }

}

async function saveInvitation(){
  if(busy)return;
  if(!form.sender.trim()||!form.recipient.trim()){setMsg('Please enter both names.');return}
  if(!validEmail(form.creator_email.trim())){setMsg('Please enter a valid email address.');return}
  if(mode==='custom'&&!form.place.trim()){setMsg('Please add a place for your date.');return}
  if(mode==='custom'&&!form.date){setMsg('Please choose a date.');return}
  if(!supabase){setMsg('Payment is configured on the production site. Please publish this build before testing checkout.');return}
  setBusy(true);setMsg('');
  const slug=crypto.randomUUID().replaceAll('-','').slice(0,20);
  const manageToken=createManageToken();
  const payload={slug,mode,sender:form.sender.trim(),recipient:form.recipient.trim(),creator_email:form.creator_email.trim(),manage_token:manageToken,place:mode==='custom'?form.place.trim():null,date:mode==='custom'?form.date:null,time:mode==='custom'?form.time:null,bring:mode==='custom'?form.bring:null,then:mode==='custom'?form.then:null,theme:form.theme,no_dodge:noDodge,status:'pending',response_date:null,response_time:null,response_place:null,response_bring:null,response_then:null};
  try{
    localStorage.setItem('little-date-draft',JSON.stringify(payload));
    const {data,error}=await supabase.functions.invoke('create-checkout',{body:{invitation:payload}});
    if(error)throw error;
    if(!data?.url)throw new Error(data?.error||'Checkout URL was not returned.');
    location.href=data.url;
  }catch(e){setMsg(e?.message||'Could not start secure checkout. Please try again.');setBusy(false)}
}

async function respond(answer){

  if(!inv)return;

    let p={status:answer};

  if(answer==='yes'&&inv.mode==='surprise'){

    p.status='planning';

    setPlanStep(1);

    setDate('');

    setPlanTime('6:00 PM');

    setChoice({place:'',bring:'Flowers',then:'Stargazing'});}

  if(supabase){

    const{data,error}=await supabase.rpc('submit_invitation_response',

      {p_slug:inv.slug,p_response:answer});

    if(error||!data){setMsg('Could not save response. Please try again.');

      return}}

      let next={...inv,...p};

      let d=readLocal();

      d[inv.slug]=next;

      localStorage.setItem('little-date',JSON.stringify(d));

      setInv(next);

      setMsg('');

    }

  async function savePlan(){

    if(planStep<3){

      if(planStep===1&&!date){setMsg('Please choose a date.');

      return}if(planStep===2&&!choice.place){

        setMsg('Please choose what to eat.');

      return}setMsg('');setPlanStep(n=>n+1);

      return}if(!date||!planTime||!choice.place){

        setMsg('Please complete your date details.');

      return}let p={status:'yes',

        response_date:date,

        response_time:planTime,

        response_place:choice.place,

        response_bring:choice.bring||'Just me',

        response_then:choice.then||'A little more time together'};

    if(supabase){

      const{data,error}=await supabase.rpc(

        'submit_surprise_plan',

      {p_slug:inv.slug,

        p_date:date,

        p_time:planTime,

        p_place:choice.place,

        p_bring:p.response_bring,

        p_then:p.response_then});

    if(error||!data){setMsg('Could not save your plan. Please try again.');

      return}}let next={...inv,...p};

      let d=readLocal();d[inv.slug]=next;

      localStorage.setItem('little-date',

        JSON.stringify(d));

        setInv(next);setStep(8);

        setMsg('')}

async function copy(){

  try{await navigator.clipboard.writeText(url);

    setMsg('Invitation link copied!')}

    catch{setMsg(url)}}

      return <div className={'app theme-'+theme.id}>

        <header>{!isInvite&&

          <button className="iconbtn" 

          onClick={()=>nav('/')}><ArrowLeft/></button>}

          <b>♡ LITTLE DATE</b>

          <button className="iconbtn" onClick={()=>nav('/pricing')}>    <Sparkles/></button>

        </header>

        <main>{route==='/pricing'?

        <section className="panel">

        <span className="eyebrow">MAKE IT SPECIAL</span>

        <h1>Simple plans,<br/>sweet memories.</h1>

        <p className="muted">Preview for free. Pay once to publish a shareable invitation.</p>

        <div className="pricing"><article>

        <h2>Preview</h2>

        <div className="price">$0</div>

        <p>Create and preview your invitation</p>

        <p>Choose a theme and invitation type</p>

        <p>No public link until payment</p>

        <button className="secondary" onClick={()=>nav('/')}>Create preview</button></article>

        <article className="premium">

        <span className="tag">ONE-TIME PAYMENT</span>

        <h2>Publish Invitation</h2>

        <div className="price">$1<span>/ invitation</span></div>

        <p>One personalized invitation</p>

        <p>All 5 themes</p>

        <p>Custom or surprise date flow</p>

        <p>Shareable link active for 7 days</p>

        <button onClick={()=>nav('/')} >Create invitation · $1</button>

        </article>

        </div>

        <p className="tiny">Pay $1 for one invitation link. The link is active for 7 days after payment confirmation.</p>{msg&&<p className="notice">{msg}</p>}

        </section>:isManage?<section className="panel invitation manage-panel">
<div className="eyebrow">PRIVATE RESPONSE VIEW</div>
<div className="bear">💌</div>
{!inv?<><h1>Response not found</h1><p className="muted">This response link is invalid, expired, or the invitation is not ready yet.</p></>:<>
<h1>{inv.status==='pending'?'Waiting for a response':inv.status==='planning'?'They said yes 💗':'Your invitation response'}</h1>
<p className="muted">{inv.sender} → {inv.recipient}</p>
<div className="ticket">
<p><b>Status</b> {inv.status==='yes'?'YES 💗':inv.status==='no'?'NO':inv.status==='planning'?'YES — PLANNING':'WAITING'}</p>
{inv.status==='yes'&&<><p><b>Date</b> {inv.response_date||inv.date||'To be decided'} {inv.response_time||inv.time||''}</p><p><b>Where</b> {inv.response_place||inv.place||'To be decided'}</p><p><b>Bring</b> {inv.response_bring||inv.bring||'—'}</p><p><b>Then</b> {inv.response_then||inv.then||'—'}</p></>}
{inv.status==='planning'&&<p className="muted">They accepted and are choosing the date details now.</p>}
{inv.status==='no'&&<p className="muted">They declined the invitation.</p>}
</div></>}
<button className="secondary" onClick={()=>nav('/')}>Create another invitation <Heart size={16}/></button>
{msg&&<p className="notice">{msg}</p>}
</section>:isInvite?<section className="panel invitation">

        <div className="progress">{[0,1,2,3,4,5].map((n)=><i className={(inv?.status==='yes'||inv?.status==='no'||inv?.status==='planning'||step>n)?'on':''} key={n}/>)}</div>{!inv?<>

        <div className="bear">💌</div>

        <h1>Invitation not found</h1>

        <p className="muted">This link may be invalid or the invitation is no longer available.</p>

        <button className="secondary" onClick={()=>nav('/')}>Home</button></>:<>{inv.status==='yes'?<>

        <div className="bear">💗🐻</div>

        <h1>It's a date!</h1>

        <div className="ticket">

        <div className="eyebrow">DATE PASS · ADMIT TWO</div>

        <p><b>For</b> {inv.sender} & {inv.recipient}</p><p><b>When</b> 

      {inv.response_date||inv.date||'To be decided'} 

      {inv.response_time||inv.time||''}</p><p><b>Where</b> 

      {inv.response_place||inv.place}</p><p><b>Bring</b> 

      {inv.response_bring||inv.bring}</p><p><b>Then</b> 

      {inv.response_then||inv.then}</p></div>

      <button onClick={()=>setMsg('Add this date to your calendar app using the date and time above.')}> 

        <CalendarDays size={18}/> Add to calendar</button>

        {msg&&<p className="notice">{msg}</p>}</>:inv.status==='no'?<>

      <div className="bear">🥺</div>

        <h1>Thank you for answering</h1>

        <p className="muted">Your response has been saved.</p>

        </>:inv.status==='planning'?<>

        <div className="bear">💞🐻</div>

        <div className="eyebrow">STEP {planStep} OF 4 · PLAN YOUR DATE</div>

        <div className="wizard-progress">{[1,2,3,4].map(n=><i key={n} 

          className={n<=planStep?'on':''}/>)}</div>

          {planStep===1?<><h1>When are you free?</h1>

         <p className="muted">Choose a date and time that works for you.</p>

        <div className="field">

        <label>Pick a date</label>

        <input className="date-input" 

          type="date" min={new Date().toISOString().slice(0,10)} 

          value={date} 

          onChange={e=>setDate(e.target.value)}/></div>

        <div className="field">

          <label>Choose a time</label>

          <select value={planTime} 

          onChange={e=>setPlanTime(e.target.value)}>

            <option>10:00 AM</option>

            <option>12:00 PM</option>

            <option>2:00 PM</option>

            <option>4:00 PM</option>

            <option>6:00 PM</option>

            <option>7:00 PM</option>

            <option>8:00 PM</option>

            </select></div></>:planStep===2?<>

            <h1>What sounds yummy?</h1>

            <p className="muted">Choose something you would love to eat.</p>

            <Choice title="Pick your date food" items={foods} 

             value={choice.place} 

            onChange={v=>setChoice(c=>({...c,place:v}))}/>

            </>:planStep===3?<>

            <h1>Our little date 💗</h1>

            <p className="muted">Here is what you picked. You can go back to change it.</p>

            <div className="ticket summary-ticket">

              <p><b>📅 Date</b>{date}</p>

              <p><b>⏰ Time</b>{planTime}</p>

              <p><b>🍓 Food</b>{choice.place}</p>

              <p><b>💐 Bring</b>{choice.bring||'Just me'}</p>

              <p><b>✨ Then</b>{choice.then||'A little more time together'}</p>

            </div>

          </>:<>

            <div className="bear">💌</div>

            <h1>It's a date!</h1>

            <p className="muted">Your date plan is saved.</p>

          </>}

            <div className="wizard-actions">{planStep>1&&

      <button className="secondary" 

      onClick={()=>{setMsg('');setPlanStep(n=>n-1)}}>

      <ArrowLeft size={16}/> Back</button>}

      <button onClick={savePlan} disabled={busy}>

      {planStep===3?'Confirm date plan':'Continue'} 

      <Heart size={17}/></button></div>

      {msg&&<p className="notice">{msg}</p>}</>:<>

      <div className="bear">🐻‍❄️💕🐻</div>

      <h1>Will you go out<br/>with me?</h1>

      <p className="muted"> 

      {inv.sender} has a little question for you.</p>

      {inv.mode==='custom'&&

      <div className="ticket">

      <p><b>When</b> 

      {inv.date||'Date to be confirmed'} · {inv.time}</p>

      <p><b>Where</b> {inv.place}</p>

      <p><b>Bring</b> {inv.bring}</p>

      <p><b>Then</b> {inv.then}</p></div>}

      <p className="muted">There is only one right answer.</p>

      {previewMode?<p className="preview-note">Preview only · Responses are disabled</p>:

    <div

  className="actions"

  onMouseMove={inv.no_dodge?handleActionsMouseMove:undefined}

>

  <button onClick={()=>respond('yes')}>

    Yes! 💗

  </button>



  <button

    ref={noButtonRef}

    className="secondary no-answer"

    style={

      inv.no_dodge

        ? {

            transform:`translate(${noPos.x}px,${noPos.y}px)`,

            transition:'transform 0.18s ease'

          }

        : undefined

    }

    onTouchStart={()=>{

      if(inv.no_dodge)dodgeNo(

        window.innerWidth/2,

        window.innerHeight/2

      );

    }}

    onClick={()=>respond('no')}

  >

    No

  </button>

  </div>}

    {msg&&<p className="notice">{msg}</p>}</>}</>}

    </section>:step===7?<section className="panel invitation">

    <div className="eyebrow">PREVIEW · NOT PUBLISHED</div>

    <div className="bear">💌</div>

    <h1>Hey {form.recipient||'someone special'} 💗</h1>

    <p className="muted">{form.sender||'Someone special'} has a little question for you.</p>{mode==='custom'&&<div className="ticket"><p><b>When</b> {form.date||'To be decided'} · {form.time}</p><p><b>Where</b> {form.place||'Your chosen place'}</p><p><b>Bring</b> {form.bring}</p><p><b>Then</b> {form.then}</p></div>}<p className="preview-note">Preview only · No invitation link is live yet.</p><div className="actions"><button className="secondary" onClick={()=>setStep(0)}>Edit details <ArrowLeft size={16}/></button><button onClick={saveInvitation} disabled={busy}>{busy?'Opening checkout…':'Pay $1 & publish'} <Heart size={17}/></button></div>{msg&&<p className="notice">{msg}</p>}</section>:step===9?<section className="panel"><div className="bear">💌</div><h1>Your invitation is ready!</h1><p className="muted">Your payment is confirmed. Send this invitation link to {inv?.recipient||form.recipient}.</p><div className="linkbox">{url}</div><button onClick={copy}><Copy size={17}/> Copy invitation link</button>{viewUrl&&<><div className="linkbox">{viewUrl}</div><button className="secondary" onClick={()=>location.href=viewUrl}>View response <ExternalLink size={16}/></button></>}<button className="secondary" onClick={()=>nav('/i/'+inv.slug+'?preview=1')}>Preview invitation <ExternalLink size={16}/></button>{msg&&<p className="notice">{msg}</p>}<p className="tiny">This invitation link expires 7 days after payment confirmation. Anyone with the link can respond; avoid sensitive personal information.</p></section>:<><section className="hero"><span className="eyebrow"><Sparkles size={14}/> A LITTLE LOVE, A LOT OF MAGIC</span><div className="heroart">💌<span>💗</span></div><h1>Make a little<br/><em>date magic.</em></h1><p className="muted">Create a sweet invitation they’ll remember.</p><button onClick={()=>{setStep(0);document.getElementById('create')?.scrollIntoView({behavior:'smooth'})}}>Create an invitation <Heart size={17}/></button><p className="tiny">Free to start · No account required</p></section><section id="create" className="panel"><div className="eyebrow">01 / CREATE YOUR INVITATION</div><h2>How would you like to invite?</h2><div className="modegrid"><button className={mode==='custom'?'selected':''} onClick={()=>setMode('custom')}><span>💐</span><b>Custom invitation</b><small>You plan every detail</small></button><button className={mode==='surprise'?'selected':''} onClick={()=>setMode('surprise')}><span>🎀</span><b>Surprise invitation</b><small>Let them plan the date</small></button></div><div className="field"><label>Your name</label><input value={form.sender} onChange={e=>update('sender',e.target.value)} placeholder="Your name" maxLength="60"/></div><div className="field"><label>Their name</label><input value={form.recipient} onChange={e=>update('recipient',e.target.value)} placeholder="Their name" maxLength="60"/></div><div className="field"><label>Your email</label><input type="email" value={form.creator_email} onChange={e=>update('creator_email',e.target.value)} placeholder="you@example.com" maxLength="120" autoComplete="email"/><small>We will email you the invitation link and private response link after payment.</small></div>{mode==='custom'&&<><div className="field"><label>Where are you going?</label><input value={form.place} onChange={e=>update('place',e.target.value)} placeholder="Coffee shop, park…" maxLength="100"/></div><div className="split"><div className="field"><label>Date</label><input type="date" min={new Date().toISOString().slice(0,10)} value={form.date} onChange={e=>update('date',e.target.value)}/></div><div className="field"><label>Time</label><input value={form.time} onChange={e=>update('time',e.target.value)} placeholder="7:00 PM" maxLength="30"/></div></div><Choice title="What to bring?" items={bring} value={form.bring} onChange={v=>update('bring',v)}/><Choice title="And then?" items={then} value={form.then} onChange={v=>update('then',v)}/></>}<div className="field dodge-setting"><label>NO button behavior</label><label className="toggleline"><input type="checkbox" checked={noDodge} onChange={e=>setNoDodge(e.target.checked)}/> Make the No button dodge (cannot be selected)</label><small>Recipients can still choose Yes. Use this as a playful effect, not to pressure someone.</small></div><div className="eyebrow">02 / PICK A THEME</div><div className="themegrid">{themes.map(t=><button key={t.id} onClick={()=>update('theme',t.id)} className={'themechoice swatch-'+t.id+(form.theme===t.id?' selected':'')}><span>{t.emoji}</span><b>{t.name}</b>{form.theme===t.id&&<Check size={15}/>}</button>)}</div><button className="wide" onClick={()=>{setMsg('');setStep(7)}}>Preview invitation <ExternalLink size={17}/></button>{msg&&<p className="notice">{msg}</p>}<p className="tiny">By creating a link, you agree to use it respectfully. Recipients can decline.</p></section><section className="panel"><div className="eyebrow">MADE FOR YOUR MOMENT</div><h2>Small details. Sweet memories.</h2><div className="feature"><span>💌</span><div><b>One easy link</b><p className="muted">Share your invitation by text or social media.</p></div></div><div className="feature"><span>💞</span><div><b>Made personal</b><p className="muted">Names, date plans and themes that feel like you.</p></div></div><div className="feature"><span>🔒</span><div><b>Private by link</b><p className="muted">Only people with the invitation link can open it.</p></div></div><button className="secondary wide" onClick={()=>nav('/pricing')}>Invitation pricing <Lock size={15}/></button></section></>}</main><footer>♡ LITTLE DATE <span>Made for moments that matter.</span></footer></div>}

function Choice({title,items,value,onChange}){return <div className="field"><label>{title}</label><div className="choicegrid">{items.map((x,i)=><button type="button" key={x} className={value===x?'selected':''} onClick={()=>onChange(x)}><span>{['✿','♡','♫','✧'][i%4]}</span>{x}</button>)}</div></div>}