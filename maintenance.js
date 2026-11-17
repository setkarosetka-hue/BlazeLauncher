import { supabase } from './supabase.js';

async function isAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single();
  return !!data?.is_admin;
}

function removeOverlay() {
  document.getElementById('maintOverlay')?.remove();
  document.body.style.overflow = '';
}

function showOverlay(s) {
  if (document.getElementById('maintOverlay')) return;
  const box = document.createElement('div');
  box.id = 'maintOverlay';
  box.style.cssText = 'position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;padding:20px;background:#090909;text-align:center;';
  const card = document.createElement('div');
  card.style.cssText = 'max-width:520px;padding:40px 30px;border-radius:25px;border:1px solid #49301c;background:radial-gradient(circle at top,#28170c,transparent 70%),#141414;';
  const h = document.createElement('h2');
  h.textContent = '🔧 Технические работы';
  h.style.marginBottom = '14px';
  card.append(h);
  const add = (text, color) => {
    const p = document.createElement('p');
    p.textContent = text;
    p.style.cssText = `color:${color};line-height:1.7;margin-top:10px;white-space:pre-line;`;
    card.append(p);
  };
  add(s.reason || 'Сайт временно недоступен. Скоро вернёмся.', '#bdbdbd');
  if (s.until) add('Ориентировочно до: ' + new Date(s.until).toLocaleString('ru-RU'), '#ffb52e');
  if (s.announcement) add(s.announcement, '#bdbdbd');
  box.append(card);
  document.body.append(box);
  document.body.style.overflow = 'hidden';
}

async function check() {
  const { data: s } = await supabase.from('site_settings').select('*').eq('id', 1).single();
  if (!s?.maintenance || (await isAdmin())) return removeOverlay();
  showOverlay(s);
}

check();
supabase.auth.onAuthStateChange(() => check());
