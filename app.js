const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const labels = { yes: 'Будет', no: 'Не будет', pending: 'Без ответа' };
const STORAGE_KEY = 'angfunk-prototype-attendance-v1';
let saved = {};
try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); if (value && typeof value === 'object' && !Array.isArray(value)) saved = value; } catch {}
let currentDay = 15;
let currentLesson = 0;
let currentFilter = 'all';
let closeTimer;
let lastTrigger;
const dialog = $('#lesson-dialog');

// The supplied frame represents a sample October week. These are demo fixtures.
const fixtures = {
  14: [['17:00','18:00','Группа ANGFUNK','Малый зал'], ['19:00','20:00','Группа ANGFUNK','Малый зал']],
  15: [['18:00','19:00','Группа ANGFUNK','Малый зал'], ...Array.from({length:5},()=>['19:00','20:00','Группа ANGFUNK Группа ANGFUNK','Малый зал'])],
  16: [['17:00','18:00','Группа ANGFUNK','Малый зал'], ['18:30','19:30','Группа ANGFUNK','Большой зал']],
  17: [['18:00','19:00','Группа ANGFUNK','Малый зал'], ['19:00','20:00','Группа ANGFUNK','Большой зал']],
  18: [['18:00','19:00','Группа ANGFUNK','Большой зал'], ['19:30','20:30','Группа ANGFUNK','Малый зал']],
  19: [['12:00','13:00','Группа ANGFUNK','Малый зал'], ['14:00','15:00','Группа ANGFUNK','Большой зал']],
  20: [['13:00','14:00','Группа ANGFUNK','Малый зал']],
};
const lessons = () => fixtures[currentDay] || [];
function attendance(day = currentDay, lesson = currentLesson) {
  const key = `${day}-${lesson}`;
  if (!Array.isArray(saved[key]) || saved[key].length !== 16 || saved[key].some(s => !Object.hasOwn(labels, s))) {
    saved[key] = Array.from({length:16}, (_,i) => i < 12 ? 'yes' : i < 14 ? 'no' : 'pending');
  }
  return saved[key];
}
function counts(lesson = 0) {
  return attendance(currentDay, lesson).reduce((all, status) => {all[status]++; return all;}, {yes:0,no:0,pending:0});
}
function announce(message) { $('#announcement').textContent = message; }
function fadeContent(element, keyboard = false) {
  element.getAnimations().forEach(a => a.cancel());
  if (reduceMotion.matches || keyboard) return;
  element.animate([{opacity:.5, transform:'translateY(4px)'}, {opacity:1, transform:'translateY(0)'}], {duration:200, easing:'cubic-bezier(.23,1,.32,1)'});
}
function renderRows(container, items, offset = 0) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p'); empty.className = 'empty-day';
    empty.textContent = 'На этот день занятий нет.\nВыберите другой день.';
    container.append(empty); return;
  }
  items.forEach(([start,end,title,room], i) => {
    const row = document.createElement('button');
    row.className = 'lesson-row'; row.dataset.lesson = i + offset;
    row.setAttribute('aria-label', `${start} – ${end}, ${title}, ${room}`);
    // All interpolated values below are fixed, application-owned demo strings.
    row.innerHTML = `<span class="row-time"><span>${start}</span><span>${end}</span></span><span class="row-divider" aria-hidden="true"><img src="./assets/divider.svg" alt=""></span><span class="row-details"><strong>${title}</strong><small>${room}</small><small>16 учеников</small></span>`;
    row.addEventListener('click', () => openLesson(i + offset, 'all', row));
    container.append(row);
  });
}
function renderSummary() {
  const next = lessons()[0];
  $('#next-time').textContent = `${next[0]} - ${next[1]}`;
  $('#next-title').textContent = next[2];
  $('#next-room').textContent = next[3];
  const totals = counts(0);
  Object.keys(totals).forEach(key => { $(`#count-${key}`).textContent = totals[key]; });
  renderRows($('#lesson-rows'), lessons().slice(1), 1);
}
function positionDayPill(keyboard = false) {
  const button = $('.day.selected');
  $$('.day-liquid').forEach(pill => {
    if (keyboard || reduceMotion.matches) pill.style.transition = 'none';
    pill.style.transform = `translateX(${button.offsetLeft}px) scaleX(${button.offsetWidth / 80})`;
    if (keyboard || reduceMotion.matches) { void pill.offsetWidth; pill.style.transition = ''; }
  });
}
function chooseDay(day, keyboard = false, fromCalendar = false) {
  if (fromCalendar && !fixtures[day]) { renderAgenda(day); return; }
  currentDay = day;
  const rects = $$('.day').map(b => b.getBoundingClientRect());
  $$('.day').forEach(button => { const active = Number(button.dataset.day) === day; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', active); });
  positionDayPill(keyboard);
  if (!reduceMotion.matches && !keyboard) {
    $$('.day').forEach((button,i) => {
      const rect = button.getBoundingClientRect();
      button.getAnimations().forEach(a=>a.cancel());
      button.animate([{transform:`translateX(${rects[i].left - rect.left}px)`}, {transform:'translateX(0)'}], {duration:250,easing:'cubic-bezier(.77,0,.175,1)'});
    });
  }
  renderSummary(); renderAgenda(day);
  fadeContent($('#lesson-card'), keyboard);
  if (!fromCalendar) $('.day.selected').scrollIntoView({behavior:'instant',block:'nearest',inline:'nearest'});
  announce(`Выбрано ${day} октября. Занятий: ${lessons().length}`);
}
function renderAgenda(day = currentDay) {
  $('#agenda-title').textContent = `${day} октября`;
  $$('.month-day').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.day) === day));
  renderRows($('#agenda-rows'), fixtures[day] || []);
}
// October is deliberately arranged like the supplied Figma frame (14 Mon / 15 Tue).
const spacer = document.createElement('span'); spacer.setAttribute('aria-hidden','true'); $('#month-grid').append(spacer);
for (let day = 1; day <= 31; day++) {
  const button = document.createElement('button'); button.className = `month-day${fixtures[day] ? ' has-lessons' : ''}`;
  button.textContent = day; button.dataset.day = day;
  button.setAttribute('aria-label', `${day} октября${fixtures[day] ? `, ${fixtures[day].length} занятий` : ', нет занятий'}`);
  button.setAttribute('aria-pressed',day === currentDay);
  button.addEventListener('click',event=>chooseDay(day,event.detail===0,true));
  $('#month-grid').append(button);
}
$$('.day').forEach(button=>button.addEventListener('click', event=>chooseDay(Number(button.dataset.day),event.detail===0)));
$('.week').addEventListener('keydown', event => {
  if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault(); const buttons = $$('.day'); const index = buttons.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : (index + (event.key==='ArrowRight'?1:-1) + buttons.length) % buttons.length;
  buttons[next].focus(); buttons[next].click();
});
$$('.nav-button').forEach((button,i) => button.addEventListener('click', event => {
  if (button.classList.contains('active')) return;
  const keyboard = event.detail === 0;
  $$('.nav-button').forEach(b => {b.classList.toggle('active',b===button); b.removeAttribute('aria-current');});
  button.setAttribute('aria-current','page');
  // Two merging capsules travel at different speeds, giving the indicator a liquid tail.
  // CSS transitions retarget from their current positions during rapid reversals.
  $$('.nav-liquid').forEach(pill => {
    if (keyboard) pill.style.transition = 'none';
    pill.style.transform = `translateX(${i * 99.5}px)`;
    if (keyboard) { void pill.offsetWidth; pill.style.transition = ''; }
  });
  $('#today-view').hidden = i === 1; $('#calendar-view').hidden = i === 0;
  $('#scroll-content').scrollTop = 0;
  fadeContent(i ? $('#calendar-view') : $('#today-view'),keyboard);
}));
function renderStudents() {
  const container = $('#student-list'); container.replaceChildren();
  const statuses = attendance();
  const totals = counts(currentLesson);
  $$('.detail-tabs button').forEach(button=>{
    const filter = button.dataset.status;
    button.setAttribute('aria-pressed',currentFilter===filter);
    button.textContent = filter==='all' ? 'Все 16' : `${filter==='yes'?'Будут':filter==='no'?'Не будут':'Без ответа'} ${totals[filter]}`;
  });
  statuses.forEach((status,index)=>{
    if (currentFilter!=='all' && currentFilter!==status) return;
    const row = document.createElement('div'); row.className = 'student-row';
    const number = String(index + 1).padStart(2,'0');
    row.innerHTML = `<span class="student-avatar" aria-hidden="true">${number}</span><span class="student-name">Ученик ${number}</span>`;
    const select = document.createElement('select'); select.setAttribute('aria-label',`Ответ ученика ${number}`);
    Object.entries(labels).forEach(([value,label]) => select.add(new Option(label,value,false,value===status)));
    select.addEventListener('change', () => {
      statuses[index] = select.value;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch {}
      const focusIndex = [...container.children].indexOf(row);
      renderSummary(); renderStudents();
      const focusTarget = $('#student-list select') ? $$('#student-list select')[Math.min(focusIndex,$$('#student-list select').length-1)] : $(`.detail-tabs button[data-status="${currentFilter}"]`);
      focusTarget.focus({preventScroll:true});
      announce(`Ученик ${number}: ${labels[statuses[index]]}`);
    });
    row.append(select); container.append(row);
  });
  if (!container.children.length) { const empty = document.createElement('p'); empty.className='empty-day'; empty.textContent='Здесь пока никого'; container.append(empty); }
}
function openLesson(index = 0, filter = 'all', trigger = document.activeElement) {
  clearTimeout(closeTimer); currentLesson = index; currentFilter = filter; lastTrigger = trigger;
  const [start,end,title,room] = lessons()[index];
  $('#detail-date').textContent = `${currentDay} октября`;
  $('#detail-time').textContent = `${start} - ${end}`;
  $('#detail-title').textContent = title;
  $('#detail-meta').textContent = `${room} · 16 учеников`;
  renderStudents();
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop=0;
  requestAnimationFrame(()=>{dialog.dataset.visible='true';});
}
function closeLesson() {
  if (!dialog.open) return;
  dialog.dataset.visible='false'; dialog.style.transform='';
  clearTimeout(closeTimer);
  closeTimer=setTimeout(()=>{dialog.close();if(lastTrigger?.isConnected)lastTrigger.focus({preventScroll:true});},reduceMotion.matches?120:240);
}
$('#open-lesson').addEventListener('click',()=>openLesson());
$$('.counters button').forEach(button=>button.addEventListener('click',()=>openLesson(0,button.dataset.filter,button)));
$$('.detail-tabs button').forEach(button=>button.addEventListener('click',()=>{currentFilter=button.dataset.status;renderStudents();}));
$('.close-button').addEventListener('click',closeLesson);
dialog.addEventListener('cancel',event=>{event.preventDefault();closeLesson();});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeLesson();}});
let drag;
const handle=$('.drag-area');
handle.addEventListener('pointerdown',event=>{if(drag || event.button!==0)return;drag={id:event.pointerId,y:event.clientY,t:performance.now(),distance:0};handle.setPointerCapture(event.pointerId);});
handle.addEventListener('pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;drag.distance=Math.max(-16,(event.clientY-drag.y));dialog.style.transition='none';dialog.style.transform=reduceMotion.matches?'none':`translateY(${drag.distance<0?drag.distance*.2:drag.distance}px)`;});
function finishDrag(event) {
  if(!drag||event.pointerId!==drag.id)return;
  const dismiss=event.type!=='pointercancel'&&(drag.distance>90||(drag.distance>12&&drag.distance/Math.max(1,performance.now()-drag.t)>.5));
  drag=null;dialog.style.transition='';dialog.style.transform='';if(dismiss)closeLesson();
}
handle.addEventListener('pointerup',finishDrag);handle.addEventListener('pointercancel',finishDrag);
renderSummary(); renderAgenda(); positionDayPill();
