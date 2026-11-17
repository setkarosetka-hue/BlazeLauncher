// Объявления на главной странице.
// Предполагается, что supabase.js экспортирует клиент как `supabase`.
// Если у тебя другое имя, поправь эту строку.
import { supabase } from './supabase.js';

async function loadAnnouncements() {
    const section = document.getElementById('announcements');
    const list = document.getElementById('annList');
    if (!section || !list) return;

    const { data, error } = await supabase
        .from('announcements')
        .select('title, body, kind, pinned, created_at')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5);

    if (error || !data || !data.length) return;

    list.replaceChildren();

    for (const a of data) {
        const card = document.createElement('article');
        card.className = 'ann-card ' + (a.kind || 'info');

        const title = document.createElement('h3');
        title.textContent = (a.pinned ? '📌 ' : '') + a.title;

        const text = document.createElement('p');
        text.textContent = a.body;

        const date = document.createElement('div');
        date.className = 'date';
        date.textContent = new Date(a.created_at).toLocaleDateString('ru-RU');

        card.append(title, text, date);
        list.append(card);
    }

    section.hidden = false;
}

loadAnnouncements();
