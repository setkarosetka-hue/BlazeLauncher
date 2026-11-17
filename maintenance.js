// Заглушка техработ + баннер объявления на главной странице.
// Подключить в index.html:  <script type="module" src="maintenance.js"></script>
import { supabase } from './supabase.js';

const style = document.createElement('style');
style.textContent = `
.mt-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;background:radial-gradient(circle at top,#28170c,#090909 70%);color:#fff;font-family:'Onest',sans-serif}
.mt-box{max-width:520px}
.mt-box h1{font-size:clamp(28px,5vw,44px);margin:16px 0 12px}
.mt-box p{color:#bdbdbd;line-height:1.7;margin-top:10px;white-space:pre-line}
.mt-box .mt-until{color:#ffb52e}
.mt-admin{margin-top:28px;background:none;border:none;color:#666;font:inherit;font-size:12px;cursor:pointer}
.mt-banner{padding:10px 7%;text-align:center;font-size:14px;font-weight:600;color:#111;background:linear-gradient(135deg,#ff7518,#ffb52e);white-space:pre-line}
`;
document.head.append(style);

function make(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
}

function showBanner(text) {
    document.body.prepend(make('div', 'mt-banner', text));
}

function showOverlay(s, until) {
    const overlay = make('div', 'mt-overlay');
    const box = make('div', 'mt-box');

    const icon = make('div', '', '🚧');
    icon.style.fontSize = '56px';
    box.append(icon, make('h1', '', 'Технические работы'),
        make('p', '', 'Сайт сейчас чинится. Скоро вернёмся!'));

    if (s.maintenance_reason) box.append(make('p', '', 'Причина: ' + s.maintenance_reason));
    if (until) {
        box.append(make('p', 'mt-until', 'Ориентировочно до ' +
            until.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })));
    }
    if (s.announcement) box.append(make('p', '', s.announcement));

    // Чтобы админ мог войти и открыть админку во время техработ
    const adminBtn = make('button', 'mt-admin', 'Вход для администратора');
    adminBtn.type = 'button';
    adminBtn.addEventListener('click', () => {
        overlay.remove();
        document.body.style.overflow = '';
    });
    box.append(adminBtn);

    overlay.append(box);
    document.body.append(overlay);
    document.body.style.overflow = 'hidden';
}

async function isAdmin() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return false;
    const { data: p } = await supabase
        .from('profiles').select('role, banned').eq('id', session.user.id).maybeSingle();
    return !!p && p.role === 'admin' && !p.banned;
}

async function run() {
    const { data, error } = await supabase
        .from('site_settings')
        .select('maintenance, maintenance_reason, maintenance_until, announcement')
        .eq('id', 1)
        .maybeSingle();

    if (error || !data) {
        console.warn('site_settings не прочитался:', error?.message);
        return;
    }

    const until = data.maintenance_until ? new Date(data.maintenance_until) : null;
    const active = data.maintenance && (!until || until > new Date());

    if (active) {
        if (await isAdmin()) {
            showBanner('🚧 Техработы включены: посетители видят заглушку. Ты видишь сайт как админ.');
        } else {
            showOverlay(data, until);
        }
    } else if (data.announcement) {
        showBanner('📢 ' + data.announcement);
    }
}

run();
