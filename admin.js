const $ = id => document.getElementById(id);
const defaultVoiceSettings = { rate: 0.88, pitch: 1, voiceURI: '', autoScroll: true };
let fontSize = Number(localStorage.getItem('fontSize') || 21);
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark');
document.documentElement.style.setProperty('--font', fontSize + 'px');

function getSettings(){try{return {...defaultVoiceSettings,...JSON.parse(localStorage.getItem('voiceSettings')||'{}')}}catch{return defaultVoiceSettings}}
function saveSettings(s){localStorage.setItem('voiceSettings',JSON.stringify(s))}

function loadVoices(){
  const sel=$('voiceSelect');
  const settings=getSettings();
  const voices=speechSynthesis.getVoices();
  const ko=voices.filter(v=>(v.lang||'').toLowerCase().startsWith('ko'));
  const list=ko.length?ko:voices;
  sel.innerHTML='';
  list.forEach(v=>{
    const o=document.createElement('option');
    o.value=v.voiceURI;
    o.textContent=`${v.name} (${v.lang})`;
    sel.appendChild(o);
  });
  if(settings.voiceURI) sel.value=settings.voiceURI;
}

function loadForm(){
  const s=getSettings();
  $('rate').value=s.rate;$('pitch').value=s.pitch;$('autoScroll').checked=!!s.autoScroll;
  updateValues();
}
function updateValues(){ $('rateValue').textContent=$('rate').value; $('pitchValue').textContent=$('pitch').value; }
function currentForm(){return{voiceURI:$('voiceSelect').value,rate:Number($('rate').value),pitch:Number($('pitch').value),autoScroll:$('autoScroll').checked}}
function testVoice(){
  if(!('speechSynthesis'in window)){alert('이 브라우저는 음성을 지원하지 않아요.');return}
  speechSynthesis.cancel();
  const s=currentForm();
  const u=new SpeechSynthesisUtterance('여호와를 경외하는 것이 지식의 근본입니다.');
  u.lang='ko-KR';u.rate=s.rate;u.pitch=s.pitch;
  const v=speechSynthesis.getVoices().find(x=>x.voiceURI===s.voiceURI);
  if(v)u.voice=v;
  speechSynthesis.speak(u);
}
function exportNotes(){
  const data={favs:JSON.parse(localStorage.getItem('favs')||'[]'),notes:{}};
  Object.keys(localStorage).forEach(k=>{if(k.startsWith('note-'))data.notes[k]=localStorage.getItem(k)});
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='proverbs-notes-backup.json';a.click();URL.revokeObjectURL(a.href);
}

$('rate').oninput=updateValues;$('pitch').oninput=updateValues;
$('testVoice').onclick=testVoice;
$('saveVoice').onclick=()=>{saveSettings(currentForm());alert('음성 설정 저장 완료')};
$('fontPlus').onclick=()=>{fontSize=Math.min(28,fontSize+1);document.documentElement.style.setProperty('--font',fontSize+'px');localStorage.setItem('fontSize',fontSize)};
$('fontMinus').onclick=()=>{fontSize=Math.max(17,fontSize-1);document.documentElement.style.setProperty('--font',fontSize+'px');localStorage.setItem('fontSize',fontSize)};
$('themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('theme',document.body.classList.contains('dark')?'dark':'light')};
$('exportNotes').onclick=exportNotes;
$('resetAll').onclick=()=>{if(confirm('즐겨찾기, 노트, 설정을 모두 지울까요?')){localStorage.clear();alert('초기화 완료')}};

if('speechSynthesis'in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices} else {$('voiceSelect').innerHTML='<option>음성 지원 안 됨</option>'}
loadForm();
