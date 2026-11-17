import { supabase } from './supabase.js';
const $ = (id) => document.getElementById(id);

async function saveSettings(patch) {
  const { error } = await supabase.from('site_settings')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
  $('mMsg').textContent = error ? error.message : 'Сохранено';
}

$('mStart').onclick = () => saveSettings({
  maintenance: true,
  reason: $('mReason').value.trim() || null,
  until: $('mUntil').value ? new Date($('mUntil').value).toISOString() : null,
  announcement: $('mAnnounce').value.trim() || null,
});
$('mStop').onclick = () => saveSettings({ maintenance: false });
$('mSaveAnn').onclick = () => saveSettings({ announcement: $('mAnnounce').value.trim() || null });
