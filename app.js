/* مسار — منصة متابعة الرسالة */
(() => {
'use strict';

const SUPABASE_URL = 'https://pmrhacdlyiarslekrzta.supabase.co';
const SUPABASE_KEY = 'sb_publishable_IwqBjhHKPUao1LXiKVLXsw_8-aiPU4D';
const OWNER_EMAIL = 'nalameen99@gmail.com';
const BUCKET = 'masar-files';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });

const STATUS = {
  draft:    { label: 'مسودة', cls: 'st-draft' },
  review:   { label: 'بانتظار المراجعة', cls: 'st-review' },
  changes:  { label: 'يحتاج تعديل', cls: 'st-changes' },
  approved: { label: 'معتمد', cls: 'st-approved' },
};

const S = {
  mode: null,            // 'student' | 'supervisor'
  sv: { token: null, pin: null },
  settings: {}, sections: [], comments: [], tasks: [], files: [], activity: [],
  prevSeen: null,
  view: 'home', sel: null, collapsed: new Set(),
};

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
};
const fmtDate = (d) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtShort = (d) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }) : '';
const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`;
  const dd = Math.round(h / 24); if (dd < 30) return `قبل ${dd} يوم`;
  return fmtShort(d);
};
const today = () => new Date().toISOString().slice(0, 10);
const isLate = (s) => s.due_date && s.due_date < today() && !['review', 'approved'].includes(s.status);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const clean = (html) => DOMPurify.sanitize(html || '', {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'div', 'span', 'a', 'sup', 'sub'],
  ALLOWED_ATTR: ['href', 'target', 'colspan', 'rowspan'],
});
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}
function fail(e) { console.error(e); toast('صار خطأ، حاولي مرة ثانية'); }

const I = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 7h6"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
  caret: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>',
};

/* ---------- theme ---------- */
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next; ls.set('masar_theme', next); render();
}

/* ---------- data ---------- */
const byId = (id) => S.sections.find((s) => s.id === id);
const childrenOf = (pid) => S.sections.filter((s) => (s.parent_id || null) === (pid || null)).sort((a, b) => a.position - b.position);
function ordered() { const out = []; const walk = (pid, d) => childrenOf(pid).forEach((s) => { out.push({ s, d }); walk(s.id, d + 1); }); walk(null, 0); return out; }
function pathOf(id) { const p = []; let s = byId(id); while (s) { p.unshift(s); s = byId(s.parent_id); } return p; }
const commentsOf = (id) => S.comments.filter((c) => c.section_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
const openSvComments = (id) => S.comments.filter((c) => c.section_id === id && c.author === 'supervisor' && !c.resolved).length;

async function loadStudent() {
  const [st, se, co, ta, fi, ac] = await Promise.all([
    sb.from('settings').select('*').eq('id', 1).single(),
    sb.from('sections').select('*'),
    sb.from('comments').select('*'),
    sb.from('tasks').select('*').order('position'),
    sb.from('files').select('*').order('created_at'),
    sb.from('activity').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  for (const r of [st, se, co, ta, fi, ac]) if (r.error) throw r.error;
  S.settings = st.data; S.sections = se.data; S.comments = co.data; S.tasks = ta.data; S.files = fi.data; S.activity = ac.data;
}
async function loadSupervisor() {
  const { data, error } = await sb.rpc('sv_bundle', { p_token: S.sv.token, p_pin: S.sv.pin || '' });
  if (error) throw error;
  Object.assign(S, { settings: data.settings, sections: data.sections, comments: data.comments, tasks: data.tasks, files: data.files, activity: data.activity });
}
const reload = () => (S.mode === 'student' ? loadStudent() : loadSupervisor());

async function logActivity(kind, section_id, text) {
  if (S.mode !== 'student') return;
  const { data } = await sb.from('activity').insert({ actor: 'student', kind, section_id, text }).select().single();
  if (data) S.activity.unshift(data);
}

/* ---------- boot ---------- */
async function boot() {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.get('s')) {
    ls.set('masar_sv', hash.get('s'));
    history.replaceState(null, '', location.pathname + location.search);
  }
  const { data: { session } } = await sb.auth.getSession();
  if (session && session.user.email.toLowerCase() === OWNER_EMAIL) return startStudent();
  const tok = ls.get('masar_sv');
  if (tok) return startSupervisor(tok);
  renderLogin();
}

async function startStudent() {
  S.mode = 'student';
  try {
    await loadStudent();
    S.prevSeen = S.settings.owner_last_seen;
    sb.from('settings').update({ owner_last_seen: new Date().toISOString() }).eq('id', 1).then(() => {});
    render();
  } catch (e) { fail(e); renderLogin(); }
}

async function startSupervisor(token) {
  S.sv.token = token; S.sv.pin = ls.get('masar_pin') || '';
  const { data: st, error } = await sb.rpc('sv_check', { p_token: token, p_pin: S.sv.pin });
  if (error) return renderError();
  if (st === 'bad_token') { ls.set('masar_sv', null); return renderError('هذا الرابط لم يعد صالحًا. اطلبي من الباحثة الرابط الجديد.'); }
  if (st === 'need_pin' || st === 'bad_pin') return renderPin(st === 'bad_pin' && S.sv.pin);
  S.mode = 'supervisor';
  try {
    await loadSupervisor();
    S.prevSeen = S.settings.sv_last_seen;
    sb.rpc('sv_seen', { p_token: S.sv.token, p_pin: S.sv.pin }).then(() => {});
    render();
  } catch (e) { fail(e); }
}

/* ---------- login screens ---------- */
function renderLogin(msg = '') {
  $('#app').innerHTML = `
  <div class="login"><div class="card">
    <div class="logo-mark big" style="margin:0"></div>
    <h1>مسار</h1>
    <p class="muted" style="margin-top:0">مساحة متابعة الرسالة بين الباحثة والمشرفة</p>
    <form id="lf">
      <label class="field">البريد الإلكتروني<input class="input" id="le" type="email" dir="ltr" value="${esc(OWNER_EMAIL)}" required></label>
      <label class="field">كلمة المرور<input class="input" id="lp" type="password" dir="ltr" minlength="6" required autocomplete="current-password"></label>
      <p class="small" id="lmsg" style="color:var(--danger);min-height:1.2em;margin:0 0 8px">${esc(msg)}</p>
      <div class="row">
        <button class="btn primary" type="submit">دخول</button>
        <button class="btn ghost" type="button" id="lsu">أول مرة؟ إنشاء كلمة مرور</button>
      </div>
    </form>
    <p class="small muted" style="margin:16px 0 0">المشرفة تدخل من الرابط الخاص بها مباشرة، بدون تسجيل.</p>
  </div></div>`;
  const go = async (signup) => {
    const email = $('#le').value.trim().toLowerCase(), password = $('#lp').value;
    const m = $('#lmsg');
    if (email !== OWNER_EMAIL) { m.textContent = 'هذه المنصة خاصة بالباحثة فقط.'; return; }
    if (password.length < 6) { m.textContent = 'كلمة المرور 6 أحرف على الأقل.'; return; }
    m.textContent = '…';
    if (signup) {
      const r = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
      if (r.error && !/registered/i.test(r.error.message)) { m.textContent = 'تعذّر إنشاء الحساب: ' + r.error.message; return; }
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { m.textContent = signup ? 'تم إنشاء الحساب، لكن تعذّر الدخول. جرّبي «دخول».' : 'كلمة المرور غير صحيحة.'; return; }
    startStudent();
  };
  $('#lf').onsubmit = (e) => { e.preventDefault(); go(false); };
  $('#lsu').onclick = () => go(true);
}

function renderPin(wrong) {
  $('#app').innerHTML = `
  <div class="login"><div class="card" style="text-align:center">
    <div class="logo-mark big"></div>
    <h1>مسار</h1>
    <p class="muted" style="margin-top:0">أدخلي الرمز المكوّن من 4 أرقام</p>
    <form id="pf">
      <input class="input" id="pi" inputmode="numeric" maxlength="8" dir="ltr" style="text-align:center;font-size:22px;letter-spacing:8px" autofocus>
      <p class="small" style="color:var(--danger);min-height:1.2em">${wrong ? 'الرمز غير صحيح' : ''}</p>
      <button class="btn primary" style="width:100%;justify-content:center">دخول</button>
    </form>
  </div></div>`;
  $('#pf').onsubmit = (e) => { e.preventDefault(); ls.set('masar_pin', $('#pi').value.trim()); startSupervisor(S.sv.token); };
}
function renderError(msg = 'تعذّر الاتصال، تأكدي من الإنترنت وأعيدي تحميل الصفحة.') {
  $('#app').innerHTML = `<div class="login"><div class="card" style="text-align:center"><div class="logo-mark big"></div><h1>مسار</h1><p class="muted">${esc(msg)}</p></div></div>`;
}

/* ---------- shell ---------- */
const NAV = [
  { id: 'home', label: 'الرئيسية', icon: I.home },
  { id: 'thesis', label: 'الرسالة', icon: I.book },
  { id: 'tasks', label: 'المهام', icon: I.check },
  { id: 'settings', label: 'الإعدادات', icon: I.gear, student: true },
];
function go(view, sel) {
  S.view = view; if (sel !== undefined) S.sel = sel;
  render(); window.scrollTo({ top: 0 });
}
function render() {
  const nav = NAV.filter((n) => !n.student || S.mode === 'student');
  const who = S.mode === 'supervisor' ? `مرحبًا ${esc(S.settings.supervisor_name || '')}` : esc(S.settings.thesis_title || '');
  $('#app').innerHTML = `
  <header class="topbar"><div class="topbar-inner">
    <div class="brand"><div class="logo-mark"></div><div><h1>مسار</h1><small>${who}</small></div></div>
    <nav class="tabs">${nav.map((n) => `<button class="tab ${S.view === n.id ? 'active' : ''}" data-nav="${n.id}">${n.label}</button>`).join('')}</nav>
    <button class="icon-btn" id="refresh" title="تحديث">${I.refresh}</button>
    <button class="icon-btn" id="theme" title="الوضع الداكن">${isDark() ? I.sun : I.moon}</button>
  </div></header>
  <main id="main"></main>
  <nav class="bottom-nav">${nav.map((n) => `<button class="${S.view === n.id ? 'active' : ''}" data-nav="${n.id}">${n.icon}<span>${n.label}</span></button>`).join('')}</nav>`;
  document.querySelectorAll('[data-nav]').forEach((b) => b.onclick = () => go(b.dataset.nav, b.dataset.nav === 'thesis' ? null : undefined));
  $('#theme').onclick = toggleTheme;
  $('#refresh').onclick = async () => { try { await reload(); render(); toast('تم التحديث'); } catch (e) { fail(e); } };
  const m = $('#main');
  ({ home: viewHome, thesis: viewThesis, tasks: viewTasks, settings: viewSettings }[S.view] || viewHome)(m);
}

/* ---------- home ---------- */
function viewHome(m) {
  const done = S.tasks.filter((t) => t.done).length, total = S.tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const leaves = S.sections;
  const approved = leaves.filter((s) => s.status === 'approved').length;
  const inReview = S.sections.filter((s) => s.status === 'review');
  const needChanges = S.sections.filter((s) => s.status === 'changes');
  const other = S.mode === 'student' ? 'supervisor' : 'student';
  const fresh = S.activity.filter((a) => a.actor === other && (!S.prevSeen || a.created_at > S.prevSeen));
  const recent = S.activity.slice(0, 8);
  const dues = S.sections.filter((s) => s.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date));

  const actLi = (a) => `<li class="${a.section_id ? 'link' : ''}" data-sec="${a.section_id || ''}"><span class="dot ${a.actor === 'supervisor' ? 'sv' : 'st'}"></span><div class="grow"><div class="t">${esc(a.text)}</div><div class="small muted">${ago(a.created_at)}</div></div></li>`;
  const secLi = (s) => `<li class="link" data-sec="${s.id}"><div class="grow"><div class="t">${esc(s.title)}</div><div class="small muted">آخر تحديث ${ago(s.updated_at)}</div></div><span class="chip ${STATUS[s.status].cls}">${STATUS[s.status].label}</span></li>`;

  const priority = S.mode === 'supervisor'
    ? `<div class="card"><h2>بانتظار مراجعتك <span class="count">${inReview.length}</span></h2>${inReview.length ? `<ul class="list">${inReview.map(secLi).join('')}</ul>` : '<p class="empty">لا يوجد شيء بانتظار المراجعة حاليًا 🌿</p>'}</div>`
    : `<div class="card"><h2>يحتاج تعديل <span class="count">${needChanges.length}</span></h2>${needChanges.length ? `<ul class="list">${needChanges.map(secLi).join('')}</ul>` : '<p class="empty">لا توجد ملاحظات معلّقة 🌿</p>'}${inReview.length ? `<h2 style="margin-top:14px">أُرسل للمراجعة <span class="count">${inReview.length}</span></h2><ul class="list">${inReview.map(secLi).join('')}</ul>` : ''}</div>`;

  m.innerHTML = `
  <section class="hero">
    <div class="eyebrow">${S.mode === 'supervisor' ? 'رسالة الباحثة ' + esc(S.settings.researcher_name || '') : 'رسالتي'}</div>
    <h2>${esc(S.settings.thesis_title)}</h2>
    <div class="progress"><span style="width:${pct}%"></span></div>
    <div class="stats"><span><b>${pct}%</b>نسبة الإنجاز</span><span><b>${done}/${total}</b>مهمة منجزة</span><span><b>${approved}</b>قسم معتمد</span><span><b>${inReview.length}</b>بانتظار المراجعة</span></div>
  </section>
  <div class="grid">
    <div class="card"><h2>الجديد منذ آخر زيارة <span class="count">${fresh.length}</span></h2>
      ${fresh.length ? `<ul class="list">${fresh.slice(0, 12).map(actLi).join('')}</ul>` : `<p class="empty">لا جديد ${S.prevSeen ? 'منذ ' + ago(S.prevSeen).replace('قبل ', '') : ''}.</p>`}
    </div>
    ${priority}
    <div class="card"><h2>المواعيد المتفق عليها</h2>
      ${dues.length ? `<div class="timeline">${dues.map((s) => `<div class="tl-item ${s.status === 'approved' ? 'done' : ''} ${isLate(s) ? 'late' : ''}" data-sec="${s.id}"><div class="d">${fmtDate(s.due_date)} ${isLate(s) ? '<span class="chip late">متأخر</span>' : ''}</div><div>${esc(s.title)} <span class="chip ${STATUS[s.status].cls}">${STATUS[s.status].label}</span></div></div>`).join('')}</div>` : '<p class="empty">لم تُحدَّد مواعيد بعد. تُضاف عند إرسال قسم للمراجعة، أو من صفحة القسم.</p>'}
    </div>
    <div class="card"><h2>آخر النشاطات</h2>${recent.length ? `<ul class="list">${recent.map(actLi).join('')}</ul>` : '<p class="empty">لا نشاطات بعد.</p>'}</div>
  </div>`;
  m.querySelectorAll('[data-sec]').forEach((el) => el.dataset.sec && (el.onclick = () => go('thesis', el.dataset.sec)));
}

/* ---------- thesis ---------- */
function treeHtml(pid) {
  const kids = childrenOf(pid);
  if (!kids.length) return '';
  return `<ul class="tree">${kids.map((s) => {
    const has = childrenOf(s.id).length > 0, closed = S.collapsed.has(s.id), c = openSvComments(s.id);
    return `<li><div class="node ${S.sel === s.id ? 'sel' : ''}" data-id="${s.id}">
      <button class="caret ${has ? (closed ? 'closed' : '') : 'none'}" data-toggle="${s.id}" aria-label="طي">${I.caret}</button>
      <span class="sdot ${s.status}"></span><span class="nt">${esc(s.title)}</span>${c ? `<span class="badge-c">${c}</span>` : ''}
    </div>${has && !closed ? treeHtml(s.id) : ''}</li>`;
  }).join('')}</ul>`;
}

function viewThesis(m) {
  if (S.sel && !byId(S.sel)) S.sel = null;
  m.innerHTML = `<div class="thesis ${S.sel ? 'has-sel' : ''}">
    <aside class="card tree-panel">
      <div class="row" style="margin-bottom:8px"><b style="font-size:14px">هيكل الرسالة</b><span class="spacer"></span>
        ${S.mode === 'student' ? '<button class="btn sm lav" id="addRoot">+ فصل</button>' : ''}</div>
      <div id="tree">${treeHtml(null)}</div>
      <div class="small muted" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
        <span><span class="sdot review" style="display:inline-block"></span> مراجعة</span>
        <span><span class="sdot changes" style="display:inline-block"></span> تعديل</span>
        <span><span class="sdot approved" style="display:inline-block"></span> معتمد</span>
      </div>
    </aside>
    <section class="detail" id="detail"></section>
  </div>`;
  $('#tree').onclick = (e) => {
    const t = e.target.closest('[data-toggle]');
    if (t) { e.stopPropagation(); const id = t.dataset.toggle; S.collapsed.has(id) ? S.collapsed.delete(id) : S.collapsed.add(id); viewThesis(m); return; }
    const n = e.target.closest('.node'); if (n) go('thesis', n.dataset.id);
  };
  if ($('#addRoot')) $('#addRoot').onclick = () => addSection(null);
  if (S.sel) renderDetail($('#detail'), byId(S.sel));
  else $('#detail').innerHTML = `<div class="card"><p class="empty">اختاري قسمًا من الهيكل لعرضه.</p></div>`;
}

async function addSection(parent_id) {
  const title = await prompt2(parent_id ? 'عنوان القسم الفرعي' : 'عنوان الفصل الجديد', '');
  if (!title) return;
  const pos = childrenOf(parent_id).length;
  const { data, error } = await sb.from('sections').insert({ parent_id, title, position: pos }).select().single();
  if (error) return fail(error);
  S.sections.push(data); if (parent_id) S.collapsed.delete(parent_id);
  go('thesis', data.id);
}

function renderDetail(el, s) {
  const st = S.mode === 'student';
  const path = pathOf(s.id);
  const kids = childrenOf(s.id);
  const files = S.files.filter((f) => f.section_id === s.id);
  const groups = {}; files.forEach((f) => (groups[f.name] = groups[f.name] || []).push(f));
  const cms = commentsOf(s.id);

  el.innerHTML = `<div class="card">
    <button class="btn ghost sm mobile-back" id="back" style="margin-bottom:6px">→ الهيكل</button>
    <div class="crumbs">${path.slice(0, -1).map((p) => `<span data-go="${p.id}">${esc(p.title)}</span>`).join(' / ') || 'الرسالة'}</div>
    ${st ? `<input class="title-input" id="ttl" value="${esc(s.title)}">` : `<h2 class="title-ro">${esc(s.title)}</h2>`}
    <div class="meta-row">
      <span class="chip ${STATUS[s.status].cls}">${STATUS[s.status].label}</span>
      ${s.due_date ? `<span class="chip ${isLate(s) ? 'late' : 'date'}">موعد التسليم: ${fmtDate(s.due_date)}</span>` : ''}
      <span class="small muted">آخر تحديث ${ago(s.updated_at)}</span>
    </div>

    ${actionBar(s)}

    <div class="section-block">
      <h3>المحتوى</h3>
      ${st ? `<div class="toolbar" id="tb">
          <button data-cmd="bold" title="غامق"><b>B</b></button>
          <button data-cmd="underline" title="تسطير"><u>U</u></button>
          <button data-block="h2" title="عنوان">عنوان</button>
          <button data-block="h3" title="عنوان فرعي">فرعي</button>
          <button data-block="p" title="فقرة">فقرة</button>
          <button data-cmd="insertUnorderedList" title="نقاط">• نقاط</button>
          <button data-cmd="insertOrderedList" title="ترقيم">1. ترقيم</button>
          <button data-block="blockquote" title="اقتباس">❝</button>
          <span class="save-state" id="ss">محفوظ</span>
        </div>
        <div class="editor" id="ed" contenteditable="true" dir="rtl" data-ph="اكتبي هنا… مثل: عنوان المحور، تعريفه، أنواعه، خصائصه">${clean(s.content)}</div>`
      : (s.content ? `<div class="content-ro">${clean(s.content)}</div>` : '<p class="empty">لم يُكتب محتوى بعد.</p>')}
    </div>

    <div class="section-block">
      <h3>الأقسام الفرعية ${st ? '<button class="btn sm ghost" id="addChild">+ إضافة</button>' : ''}</h3>
      ${kids.length ? kids.map((k) => `<div class="child" data-go="${k.id}"><span class="sdot ${k.status}"></span><span class="ct">${esc(k.title)}</span><span class="chip ${STATUS[k.status].cls}">${STATUS[k.status].label}</span></div>`).join('') : '<p class="empty">لا توجد أقسام فرعية.</p>'}
    </div>

    <div class="section-block">
      <h3>المرفقات ${st ? '<label class="btn sm ghost" style="cursor:pointer">+ رفع ملف<input type="file" id="up" hidden></label>' : ''}</h3>
      ${Object.keys(groups).length ? Object.entries(groups).map(([name, vs]) => {
        vs.sort((a, b) => b.version - a.version); const last = vs[0];
        const ext = (name.split('.').pop() || '').slice(0, 4).toUpperCase();
        return `<div class="file"><div class="fi">${esc(ext)}</div><div class="fn"><b>${esc(name)}</b>
          <span class="small muted">النسخة ${last.version} · ${ago(last.created_at)}</span>
          ${vs.length > 1 ? `<details><summary>النسخ السابقة (${vs.length - 1})</summary>${vs.slice(1).map((v) => `<div>النسخة ${v.version} · ${fmtShort(v.created_at)} <a href="#" data-dl="${v.id}">تنزيل</a></div>`).join('')}</details>` : ''}
          </div><button class="btn sm" data-dl="${last.id}">تنزيل</button></div>`;
      }).join('') : '<p class="empty">لا توجد مرفقات.</p>'}
    </div>

    <div class="section-block">
      <h3>الملاحظات والنقاش</h3>
      <div class="thread">${cms.length ? cms.map((c) => `
        <div class="cmt ${c.author} ${c.resolved ? 'resolved' : ''}">
          <div class="who">${c.author === 'supervisor' ? 'المشرفة' : 'الباحثة'} · ${ago(c.created_at)}
            ${c.resolved ? '<span class="chip st-approved">تم التعديل</span>' : ''}
            ${st && c.author === 'supervisor' && !c.resolved ? `<button class="btn sm ghost" data-res="${c.id}">✓ تم التعديل</button>` : ''}</div>
          <div class="body">${esc(c.body)}</div>
        </div>`).join('') : '<p class="empty">لا توجد ملاحظات بعد.</p>'}</div>
      <div class="composer"><textarea class="input" id="cm" placeholder="${st ? 'ردّ أو سؤال للمشرفة…' : 'اكتبي ملاحظتك…'}"></textarea><button class="btn primary" id="cms">إرسال</button></div>
    </div>

    ${st ? `<div class="menu-row">
      <button class="btn sm" id="due">${s.due_date ? 'تعديل موعد التسليم' : 'تحديد موعد التسليم'}</button>
      <button class="btn sm" id="up1">↑ لأعلى</button><button class="btn sm" id="dn1">↓ لأسفل</button>
      <button class="btn sm" id="mv">نقل إلى…</button>
      ${s.status !== 'draft' ? '<button class="btn sm" id="todraft">إرجاع لمسودة</button>' : ''}
      <span class="spacer"></span><button class="btn sm danger" id="del">حذف</button>
    </div>` : ''}
  </div>`;

  // mobile back
  const back = $('#back'); back.onclick = () => go('thesis', null);
  if (matchMedia('(min-width: 861px)').matches) back.style.display = 'none';
  el.querySelectorAll('[data-go]').forEach((x) => x.onclick = () => go('thesis', x.dataset.go));
  el.querySelectorAll('[data-dl]').forEach((x) => x.onclick = (e) => { e.preventDefault(); download(x.dataset.dl); });
  bindActionBar(s);

  $('#cms').onclick = () => sendComment(s);
  if (!st) return;

  // student bindings
  $('#ttl').onchange = async (e) => {
    const title = e.target.value.trim(); if (!title) return;
    const { error } = await sb.from('sections').update({ title, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return fail(error); s.title = title; $('#tree').innerHTML = treeHtml(null); toast('تم حفظ العنوان');
  };
  const ed = $('#ed'), ss = $('#ss');
  const save = debounce(async () => {
    const content = clean(ed.innerHTML);
    const { error } = await sb.from('sections').update({ content, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (error) { ss.textContent = 'لم يُحفظ!'; return fail(error); }
    s.content = content; s.updated_at = new Date().toISOString(); ss.textContent = 'محفوظ ✓';
  }, 1200);
  ed.addEventListener('input', () => { ss.textContent = 'جارٍ الحفظ…'; save(); });
  ed.addEventListener('paste', (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? clean(html) : esc(text).replace(/\n/g, '<br>'));
  });
  $('#tb').onmousedown = (e) => e.preventDefault();
  $('#tb').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    ed.focus();
    if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
    if (b.dataset.block) document.execCommand('formatBlock', false, b.dataset.block);
    ss.textContent = 'جارٍ الحفظ…'; save();
  };
  $('#addChild').onclick = () => addSection(s.id);
  $('#up').onchange = (e) => upload(s, e.target.files[0]);
  el.querySelectorAll('[data-res]').forEach((x) => x.onclick = async () => {
    const { error } = await sb.from('comments').update({ resolved: true }).eq('id', x.dataset.res);
    if (error) return fail(error); S.comments.find((c) => c.id === x.dataset.res).resolved = true; render();
  });
  $('#due').onclick = async () => {
    const d = await dateDialog('موعد تسليم «' + s.title + '»', s.due_date);
    if (d === undefined) return;
    const { error } = await sb.from('sections').update({ due_date: d || null }).eq('id', s.id);
    if (error) return fail(error); s.due_date = d || null;
    if (d) await logActivity('due', s.id, `حُدّد موعد تسليم «${s.title}»: ${fmtDate(d)}`);
    render();
  };
  $('#up1').onclick = () => reorder(s, -1);
  $('#dn1').onclick = () => reorder(s, 1);
  $('#mv').onclick = () => moveDialog(s);
  if ($('#todraft')) $('#todraft').onclick = async () => { await setStatus(s, 'draft'); render(); };
  $('#del').onclick = async () => {
    const n = ordered().filter((o) => pathOf(o.s.id).some((p) => p.id === s.id)).length - 1;
    if (!(await confirm2(`حذف «${s.title}»${n ? ` مع ${n} قسم فرعي` : ''} وكل مرفقاته وملاحظاته؟ لا يمكن التراجع.`, 'حذف'))) return;
    const { error } = await sb.from('sections').delete().eq('id', s.id);
    if (error) return fail(error);
    await reload(); go('thesis', s.parent_id || null); toast('تم الحذف');
  };
}

function actionBar(s) {
  if (S.mode === 'student') {
    if (s.status === 'review') return `<div class="action-bar"><span class="msg">أُرسل للمراجعة، بانتظار رد المشرفة.</span></div>`;
    if (s.status === 'approved') return `<div class="action-bar"><span class="msg">✅ اعتمدته المشرفة.</span><button class="btn sm" id="send">إعادة إرسال بعد تحديث</button></div>`;
    return `<div class="action-bar"><span class="msg">${s.status === 'changes' ? 'المشرفة طلبت تعديلات. بعد ما تعدّلين أرسليه من جديد.' : 'لما يجهز هذا القسم أرسليه للمشرفة.'}</span><button class="btn primary" id="send">إرسال للمراجعة</button></div>`;
  }
  return `<div class="action-bar"><span class="msg">${s.status === 'review' ? 'أرسلته الباحثة للمراجعة.' : 'قرارك على هذا القسم:'}</span>
    <button class="btn primary" id="approve">✓ اعتماد</button><button class="btn warn" id="changes">يحتاج تعديل</button></div>`;
}
function bindActionBar(s) {
  if ($('#send')) $('#send').onclick = () => submitDialog(s);
  if ($('#approve')) $('#approve').onclick = () => reviewDialog(s, 'approved');
  if ($('#changes')) $('#changes').onclick = () => reviewDialog(s, 'changes');
}

async function setStatus(s, status) {
  const { error } = await sb.from('sections').update({ status, updated_at: new Date().toISOString() }).eq('id', s.id);
  if (error) throw error; s.status = status;
}

async function sendComment(s) {
  const body = $('#cm').value.trim(); if (!body) return;
  $('#cms').disabled = true;
  try {
    if (S.mode === 'student') {
      const { data, error } = await sb.from('comments').insert({ section_id: s.id, author: 'student', body }).select().single();
      if (error) throw error; S.comments.push(data);
      await logActivity('comment', s.id, `ردّت الباحثة على ملاحظات «${s.title}»`);
    } else {
      const { error } = await sb.rpc('sv_comment', { p_token: S.sv.token, p_pin: S.sv.pin, p_section: s.id, p_body: body });
      if (error) throw error; await loadSupervisor();
    }
    render(); toast('تم الإرسال');
  } catch (e) { fail(e); $('#cms').disabled = false; }
}

async function reorder(s, dir) {
  const sib = childrenOf(s.parent_id); const i = sib.indexOf(s); const j = i + dir;
  if (j < 0 || j >= sib.length) return;
  [sib[i], sib[j]] = [sib[j], sib[i]];
  sib.forEach((x, k) => (x.position = k));
  const res = await Promise.all(sib.map((x) => sb.from('sections').update({ position: x.position }).eq('id', x.id)));
  if (res.some((r) => r.error)) fail(res.find((r) => r.error).error);
  render();
}

async function upload(s, file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return toast('الحد الأقصى 50 ميجا');
  toast('جارٍ الرفع…');
  const ext = (file.name.split('.').pop() || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin';
  const path = `${s.id}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream' });
  if (up.error) return fail(up.error);
  const version = S.files.filter((f) => f.section_id === s.id && f.name === file.name).length + 1;
  const { data, error } = await sb.from('files').insert({ section_id: s.id, name: file.name, path, version, size: file.size }).select().single();
  if (error) return fail(error);
  S.files.push(data);
  await sb.from('sections').update({ updated_at: new Date().toISOString() }).eq('id', s.id);
  await logActivity('file', s.id, `رفعت الباحثة ملف «${file.name}»${version > 1 ? ` (النسخة ${version})` : ''} في «${s.title}»`);
  render(); toast('تم رفع الملف');
}

async function download(id) {
  try {
    let url;
    if (S.mode === 'student') {
      const f = S.files.find((x) => x.id === id);
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.path, 300, { download: f.name });
      if (error) throw error; url = data.signedUrl;
    } else {
      const { data, error } = await sb.functions.invoke('sv-file', { body: { token: S.sv.token, pin: S.sv.pin, file_id: id } });
      if (error || !data?.url) throw error || new Error('no url'); url = data.url;
    }
    window.open(url, '_blank');
  } catch (e) { fail(e); }
}

/* ---------- dialogs ---------- */
function modal(html, onMount) {
  return new Promise((resolve) => {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog">${html}</div></div>`;
    const close = (v) => { root.innerHTML = ''; resolve(v); };
    root.querySelector('.modal-back').onclick = (e) => { if (e.target.classList.contains('modal-back')) close(undefined); };
    root.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => close(undefined));
    onMount(root.querySelector('.modal'), close);
  });
}
const prompt2 = (title, val) => modal(`<h3>${esc(title)}</h3><input class="input" id="pv" value="${esc(val)}"><div class="actions" style="margin-top:14px"><button class="btn primary" id="ok">حفظ</button><button class="btn ghost" data-close>إلغاء</button></div>`,
  (m, close) => { const i = m.querySelector('#pv'); i.focus(); const ok = () => close(i.value.trim() || undefined); m.querySelector('#ok').onclick = ok; i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); ok(); } }); });
const confirm2 = (msg, label = 'تأكيد') => modal(`<h3>تأكيد</h3><p>${esc(msg)}</p><div class="actions"><button class="btn primary" id="ok" style="background:var(--danger);border-color:var(--danger)">${esc(label)}</button><button class="btn ghost" data-close>إلغاء</button></div>`,
  (m, close) => { m.querySelector('#ok').onclick = () => close(true); });
const dateDialog = (title, val) => modal(`<h3>${esc(title)}</h3><input type="date" class="input" id="dv" value="${esc(val || '')}"><div class="actions" style="margin-top:14px"><button class="btn primary" id="ok">حفظ</button><button class="btn ghost" id="clr">إزالة الموعد</button><button class="btn ghost" data-close>إلغاء</button></div>`,
  (m, close) => { m.querySelector('#ok').onclick = () => close(m.querySelector('#dv').value || ''); m.querySelector('#clr').onclick = () => close(''); });

function sectionOptions(excludeId, selected) {
  return ordered().filter((o) => !excludeId || !pathOf(o.s.id).some((p) => p.id === excludeId))
    .map((o) => `<option value="${o.s.id}" ${o.s.id === selected ? 'selected' : ''}>${'— '.repeat(o.d)}${esc(o.s.title)}</option>`).join('');
}

async function moveDialog(s) {
  const r = await modal(`<h3>نقل «${esc(s.title)}»</h3><label class="field">تحت القسم<select class="input" id="mp"><option value="">— المستوى الأعلى (فصل) —</option>${sectionOptions(s.id, s.parent_id)}</select></label>
    <div class="actions"><button class="btn primary" id="ok">نقل</button><button class="btn ghost" data-close>إلغاء</button></div>`,
    (m, close) => { m.querySelector('#ok').onclick = () => close(m.querySelector('#mp').value); });
  if (r === undefined) return;
  const parent_id = r || null;
  const { error } = await sb.from('sections').update({ parent_id, position: childrenOf(parent_id).length }).eq('id', s.id);
  if (error) return fail(error);
  s.parent_id = parent_id; s.position = childrenOf(parent_id).length; render(); toast('تم النقل');
}

function nextSectionOf(s) {
  const o = ordered().map((x) => x.s); const i = o.indexOf(s);
  return o.slice(i + 1).find((x) => x.status !== 'approved' && !pathOf(x.id).some((p) => p.id === s.id)) || null;
}

async function submitDialog(s) {
  const nx = nextSectionOf(s);
  const r = await modal(`<h3>إرسال «${esc(s.title)}» للمراجعة</h3>
    <label class="field">رسالة للمشرفة (اختياري)<textarea class="input" id="sn" rows="3" placeholder="مثال: عدّلت المشكلة حسب ملاحظاتك…"></textarea></label>
    <label class="field">القسم التالي اللي بتشتغلين عليه<select class="input" id="sx"><option value="">— بدون —</option>${sectionOptions(null, nx && nx.id)}</select></label>
    <label class="field">موعد تسليمه المتوقع<input type="date" class="input" id="sd" min="${today()}"></label>
    <div class="actions"><button class="btn primary" id="ok">إرسال</button><button class="btn ghost" data-close>إلغاء</button></div>`,
    (m, close) => { m.querySelector('#ok').onclick = () => close({ note: m.querySelector('#sn').value.trim(), next: m.querySelector('#sx').value, date: m.querySelector('#sd').value }); });
  if (!r) return;
  try {
    await setStatus(s, 'review');
    if (r.note) {
      const { data } = await sb.from('comments').insert({ section_id: s.id, author: 'student', body: r.note }).select().single();
      if (data) S.comments.push(data);
    }
    await logActivity('review', s.id, `أرسلت الباحثة «${s.title}» للمراجعة`);
    if (r.next && r.date) {
      const n = byId(r.next);
      await sb.from('sections').update({ due_date: r.date }).eq('id', n.id); n.due_date = r.date;
      await logActivity('due', n.id, `موعد تسليم «${n.title}»: ${fmtDate(r.date)}`);
    }
    render(); toast('تم الإرسال للمشرفة');
  } catch (e) { fail(e); }
}

async function reviewDialog(s, status) {
  const ap = status === 'approved';
  const r = await modal(`<h3>${ap ? 'اعتماد' : 'طلب تعديل على'} «${esc(s.title)}»</h3>
    <label class="field">${ap ? 'ملاحظة (اختياري)' : 'ما المطلوب تعديله؟'}<textarea class="input" id="rn" rows="4"></textarea></label>
    <div class="actions"><button class="btn ${ap ? 'primary' : 'warn'}" id="ok">${ap ? '✓ اعتماد' : 'إرسال الملاحظات'}</button><button class="btn ghost" data-close>إلغاء</button></div>`,
    (m, close) => { m.querySelector('#ok').onclick = () => close({ note: m.querySelector('#rn').value.trim() }); });
  if (!r) return;
  const { error } = await sb.rpc('sv_set_status', { p_token: S.sv.token, p_pin: S.sv.pin, p_section: s.id, p_status: status, p_note: r.note });
  if (error) return fail(error);
  await loadSupervisor(); render(); toast(ap ? 'تم الاعتماد ✅' : 'تم إرسال الملاحظات');
}

/* ---------- tasks ---------- */
function viewTasks(m) {
  const st = S.mode === 'student';
  const tasks = [...S.tasks].sort((a, b) => a.position - b.position);
  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  m.innerHTML = `<div class="card">
    <h2>قائمة المهام <span class="count">${done}/${tasks.length}</span></h2>
    <div class="progress" style="margin-bottom:12px"><span style="width:${pct}%"></span></div>
    <div id="tl">${tasks.length ? tasks.map((t) => {
      const sec = t.section_id && byId(t.section_id);
      return `<div class="task ${t.done ? 'done' : ''}">
        <input type="checkbox" data-t="${t.id}" ${t.done ? 'checked' : ''} ${st ? '' : 'disabled'} aria-label="${esc(t.title)}">
        <div class="tt">${esc(t.title)}${sec && sec.title !== t.title ? `<div class="tl" data-go="${sec.id}">${esc(sec.title)}</div>` : sec ? `<div class="tl" data-go="${sec.id}">فتح القسم ←</div>` : ''}</div>
        ${st ? `<button class="btn sm ghost" data-up="${t.id}" aria-label="لأعلى">↑</button><button class="btn sm ghost danger" data-del="${t.id}" aria-label="حذف">✕</button>` : ''}
      </div>`;
    }).join('') : '<p class="empty">لا توجد مهام.</p>'}</div>
    ${st ? `<form id="tf" class="composer" style="margin-top:14px">
      <input class="input" id="tn" placeholder="مهمة جديدة… مثل: كتابة تعريف المسؤولية المجتمعية">
      <select class="input" id="ts" style="max-width:200px"><option value="">بدون ربط بقسم</option>${sectionOptions()}</select>
      <button class="btn primary">إضافة</button></form>` : ''}
  </div>`;
  m.querySelectorAll('[data-go]').forEach((x) => x.onclick = () => go('thesis', x.dataset.go));
  if (!st) return;
  m.querySelectorAll('[data-t]').forEach((c) => c.onchange = async () => {
    const t = S.tasks.find((x) => x.id === c.dataset.t); t.done = c.checked;
    const { error } = await sb.from('tasks').update({ done: t.done }).eq('id', t.id);
    if (error) return fail(error);
    if (t.done) await logActivity('task', t.section_id, `أنجزت الباحثة: ${t.title} ✓`);
    viewTasks(m); if (t.done) toast('أحسنتِ 🌿');
  });
  m.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const { error } = await sb.from('tasks').delete().eq('id', b.dataset.del);
    if (error) return fail(error); S.tasks = S.tasks.filter((t) => t.id !== b.dataset.del); viewTasks(m);
  });
  m.querySelectorAll('[data-up]').forEach((b) => b.onclick = async () => {
    const i = tasks.findIndex((t) => t.id === b.dataset.up); if (i < 1) return;
    [tasks[i - 1], tasks[i]] = [tasks[i], tasks[i - 1]]; tasks.forEach((t, k) => (t.position = k));
    await Promise.all([tasks[i - 1], tasks[i]].map((t) => sb.from('tasks').update({ position: t.position }).eq('id', t.id)));
    viewTasks(m);
  });
  $('#tf').onsubmit = async (e) => {
    e.preventDefault(); const title = $('#tn').value.trim(); if (!title) return;
    const pos = Math.max(0, ...S.tasks.map((t) => t.position)) + 1;
    const { data, error } = await sb.from('tasks').insert({ title, section_id: $('#ts').value || null, position: pos }).select().single();
    if (error) return fail(error); S.tasks.push(data); viewTasks(m);
  };
}

/* ---------- settings ---------- */
function svLink() { return `${location.origin}${location.pathname}#s=${S.settings.sv_token}`; }
function viewSettings(m) {
  if (S.mode !== 'student') return viewHome(m);
  const link = svLink();
  m.innerHTML = `<div class="grid">
  <div class="card"><h2>بيانات الرسالة</h2>
    <label class="field">عنوان الرسالة<textarea class="input" id="s_t" rows="2">${esc(S.settings.thesis_title)}</textarea></label>
    <label class="field">اسم الباحثة<input class="input" id="s_r" value="${esc(S.settings.researcher_name)}"></label>
    <label class="field">اسم المشرفة (يظهر لها في الترحيب)<input class="input" id="s_s" value="${esc(S.settings.supervisor_name)}"></label>
    <button class="btn primary" id="s_save">حفظ</button>
  </div>
  <div class="card"><h2>رابط المشرفة</h2>
    <p class="small muted" style="margin-top:0">أرسلي هذا الرابط لمشرفتك. تفتحه مباشرة بدون تسجيل. تقدر تقرأ وتعلّق وتعتمد فقط.</p>
    <div class="linkbox"><span style="flex:1">${esc(link)}</span></div>
    <div class="row" style="margin-top:10px">
      <button class="btn primary" id="cp">نسخ الرابط</button>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('السلام عليكم دكتورة، هذا رابط منصة متابعة رسالتي، تقدرين تشوفين فيه تقدمي وتضيفين ملاحظاتك مباشرة:\n' + link)}">إرسال واتساب</a>
      <button class="btn danger" id="rot">إنشاء رابط جديد</button>
    </div>
    <h2 style="margin-top:20px">رمز الدخول (اختياري)</h2>
    <p class="small muted" style="margin-top:0">${S.settings.pin_hash ? 'مفعّل ✓ تحتاج المشرفة إدخاله مرة وحدة.' : 'غير مفعّل. لو فعّلتيه تدخله المشرفة مرة وحدة ويتذكره جهازها.'}</p>
    <div class="row"><input class="input" id="pin" inputmode="numeric" maxlength="8" placeholder="4 أرقام" style="max-width:140px" dir="ltr">
      <button class="btn" id="pinset">حفظ الرمز</button>${S.settings.pin_hash ? '<button class="btn ghost" id="pinclr">إلغاء الرمز</button>' : ''}</div>
  </div>
  <div class="card"><h2>الحساب</h2>
    <p class="small muted" style="margin-top:0">مسجّلة باسم ${esc(OWNER_EMAIL)}</p>
    <button class="btn" id="out">تسجيل الخروج</button>
  </div></div>`;
  $('#s_save').onclick = async () => {
    const upd = { thesis_title: $('#s_t').value.trim() || 'عنوان الرسالة', researcher_name: $('#s_r').value.trim(), supervisor_name: $('#s_s').value.trim() };
    const { error } = await sb.from('settings').update(upd).eq('id', 1);
    if (error) return fail(error); Object.assign(S.settings, upd); render(); toast('تم الحفظ');
  };
  $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('تم نسخ الرابط'); } catch (e) { prompt2('انسخي الرابط', link); } };
  $('#rot').onclick = async () => {
    if (!(await confirm2('الرابط الحالي بيتعطل فورًا، ولازم ترسلين للمشرفة الرابط الجديد. متأكدة؟', 'إنشاء رابط جديد'))) return;
    const { data, error } = await sb.rpc('rotate_sv_token'); if (error) return fail(error);
    S.settings.sv_token = data; render(); toast('تم إنشاء رابط جديد');
  };
  $('#pinset').onclick = async () => {
    const p = $('#pin').value.trim(); if (!/^\d{4,8}$/.test(p)) return toast('الرمز 4 أرقام على الأقل');
    const { error } = await sb.rpc('set_pin', { p_pin: p }); if (error) return fail(error);
    S.settings.pin_hash = 'x'; render(); toast('تم تفعيل الرمز: ' + p);
  };
  if ($('#pinclr')) $('#pinclr').onclick = async () => { const { error } = await sb.rpc('set_pin', { p_pin: '' }); if (error) return fail(error); S.settings.pin_hash = null; render(); toast('تم إلغاء الرمز'); };
  $('#out').onclick = async () => { await sb.auth.signOut(); location.reload(); };
}

/* ---------- refresh on return ---------- */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !S.mode) return;
  if (document.activeElement && document.activeElement.closest('.editor, textarea, input')) return;
  try { await reload(); if (!$('#modal-root').innerHTML) render(); } catch (e) {}
});

boot().catch((e) => { console.error(e); renderError(); });
})();
