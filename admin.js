
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let me = null;
let users = [];
let banTarget = null;
let busy = false;

/* ---------- Сообщения ---------- */

const ERRORS = {
    "forbidden": "Нет прав администратора",
    "cannot change yourself": "Нельзя менять самого себя",
    "reason required": "Укажи причину бана",
    "cannot ban admin": "Нельзя забанить админа: сначала сними с него админку",
    "user is banned": "Пользователь забанен: сначала разбань его",
};

function errText(error) {
    const m = error?.message || "";
    const key = Object.keys(ERRORS).find((k) => m.includes(k));
    return key ? ERRORS[key] : "Ошибка: " + m;
}

function setStatus(text, ok = false) {
    const el = $("status");
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

function showGate(text) {
    $("gateText").textContent = text;
    $("gate").hidden = false;
    $("panel").hidden = true;
}

function td(text, className) {
    const el = document.createElement("td");
    if (className) el.className = className;
    el.textContent = text;
    return el;
}

function badge(text, kind, first = false) {
    const el = document.createElement("span");
    el.className = "badge " + kind + (first ? " first" : "");
    el.textContent = text;
    return el;
}

function actionButton(label, onClick, danger = false) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "act" + (danger ? " danger" : "");
    el.textContent = label;
    el.addEventListener("click", onClick);
    return el;
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", {
        dateStyle: "short",
        timeStyle: "short",
    });
}

/* ---------- Проверка доступа ---------- */

async function init() {
    const { data, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
        return showGate("Не удалось проверить вход: " + sessionError.message);
    }

    const session = data.session;

    if (!session) {
        return showGate("Нужно войти в аккаунт администратора. Войди на главной странице и вернись сюда.");
    }

    me = session.user.id;

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, banned")
        .eq("id", me)
        .maybeSingle();

    if (error || !profile || profile.role !== "admin" || profile.banned) {
        return showGate("У тебя нет доступа к этой странице.");
    }

    $("gate").hidden = true;
    $("panel").hidden = false;

    await loadUsers();
}

/* ---------- Пользователи ---------- */

async function loadUsers() {
    setStatus("Загружаем…", true);

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, role, banned, ban_reason, banned_at, created_at")
        .order("created_at", { ascending: false });

    if (error) return setStatus(errText(error));

    users = data || [];
    setStatus("");
    renderUsers();
}

function userRow(u) {
    const tr = document.createElement("tr");
    const isMe = u.id === me;
    const isAdmin = u.role === "admin";

    const nameCell = document.createElement("td");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = u.username || "—";
    nameCell.append(name);

    if (isAdmin) nameCell.append(badge("админ", "admin"));
    tr.append(nameCell);

    tr.append(td(u.email || "—", "muted"));
    tr.append(td(formatDate(u.created_at), "muted"));

    const statusCell = document.createElement("td");
    statusCell.append(
        u.banned
            ? badge("Забанен", "banned", true)
            : badge("Активен", "ok", true)
    );

    if (u.banned) {
        const reason = document.createElement("div");
        reason.className = "reason";
        reason.textContent = "Причина: " + (u.ban_reason || "не указана");
        statusCell.append(reason);
    }

    tr.append(statusCell);

    const actions = document.createElement("td");

    if (isMe) {
        actions.className = "muted";
        actions.textContent = "Это ты";
    } else {
        if (u.banned) {
            actions.append(actionButton("Разбанить", () => setBan(u, false)));
        } else if (!isAdmin) {
            actions.append(actionButton("Забанить", () => openBanModal(u), true));
        }

        if (isAdmin) {
            actions.append(actionButton("Снять админа", () => setRole(u, false), true));
        } else if (!u.banned) {
            actions.append(actionButton("Выдать админку", () => setRole(u, true)));
        }
    }

    tr.append(actions);
    return tr;
}

function renderUsers() {
    $("statTotal").textContent = users.length;
    $("statActive").textContent = users.filter((u) => !u.banned).length;
    $("statBanned").textContent = users.filter((u) => u.banned).length;
    $("statAdmins").textContent = users.filter((u) => u.role === "admin").length;

    const q = $("search").value.trim().toLowerCase();
    const f = $("filter").value;

    const list = users.filter((u) => {
        if (f === "active" && u.banned) return false;
        if (f === "banned" && !u.banned) return false;
        if (f === "admin" && u.role !== "admin") return false;
        if (!q) return true;

        return (
            (u.username || "").toLowerCase().includes(q) ||
            (u.email || "").toLowerCase().includes(q)
        );
    });

    const tbody = $("rows");
    tbody.replaceChildren();

    if (list.length === 0) {
        const tr = document.createElement("tr");
        const cell = td("Никого не найдено", "empty");
        cell.colSpan = 5;
        tr.append(cell);
        tbody.append(tr);
        return;
    }

    list.forEach((u) => tbody.append(userRow(u)));
}

/* ---------- Действия с пользователями ---------- */

async function run(request, okText) {
    if (busy) return false;

    busy = true;
    const { error } = await request;
    busy = false;

    if (error) {
        setStatus(errText(error));
        return false;
    }

    await loadUsers();
    setStatus(okText, true);
    return true;
}

function setBan(u, doBan, reason = null) {
    return run(
        supabase.rpc("admin_set_ban", {
            target: u.id,
            do_ban: doBan,
            reason,
        }),
        doBan ? `Забанен: ${u.username}` : `Разбанен: ${u.username}`
    );
}

function setRole(u, makeAdmin) {
    const question = makeAdmin
        ? `Выдать админку пользователю ${u.username}? Он сможет банить людей и выдавать админку другим.`
        : `Снять админку с ${u.username}?`;

    if (!window.confirm(question)) return;

    return run(
        supabase.rpc("admin_set_role", {
            target: u.id,
            make_admin: makeAdmin,
        }),
        makeAdmin
            ? `${u.username} теперь админ`
            : `${u.username} больше не админ`
    );
}

/* ---------- Окно бана ---------- */

function openBanModal(u) {
    banTarget = u;
    $("banUser").textContent = `${u.username} · ${u.email || "без почты"}`;
    $("banReason").value = "";
    $("banMsg").textContent = "";
    $("banModal").hidden = false;
    $("banReason").focus();
}

function closeBanModal() {
    $("banModal").hidden = true;
    banTarget = null;
}

$("banCancel").addEventListener("click", closeBanModal);

$("banModal").addEventListener("click", (e) => {
    if (e.target === $("banModal")) closeBanModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("banModal").hidden) closeBanModal();
});

$("banConfirm").addEventListener("click", async () => {
    const reason = $("banReason").value.trim();

    if (!reason) {
        $("banMsg").textContent = "Укажи причину бана";
        return;
    }

    if (!banTarget) return;

    const target = banTarget;
    const ok = await setBan(target, true, reason);

    if (ok) closeBanModal();
    else $("banMsg").textContent = $("status").textContent;
});

/* ---------- Поиск и фильтры ---------- */

$("search").addEventListener("input", renderUsers);
$("filter").addEventListener("change", renderUsers);
$("refreshBtn").addEventListener("click", loadUsers);

/* ---------- Вкладки ---------- */

let releasesLoaded = false;

const SECTIONS = {
    users: { tab: "tabUsers", section: "usersSection" },
    releases: { tab: "tabReleases", section: "releasesSection" },
    ann: { tab: "tabAnn", section: "annSection" },
    maint: { tab: "tabMaint", section: "maintSection" },
    preorders: { tab: "tabPreorders", section: "preordersSection" },
};

function showSection(name) {
    Object.entries(SECTIONS).forEach(([key, ids]) => {
        const active = key === name;
        $(ids.section).hidden = !active;
        $(ids.tab).classList.toggle("active", active);
    });

    if (name === "releases" && !releasesLoaded) {
        releasesLoaded = true;
        loadReleases();
    }

    if (name === "ann") loadAnn();
    if (name === "maint") loadMaint();
    if (name === "preorders") loadPreorders();
}

$("tabUsers").addEventListener("click", () => showSection("users"));
$("tabReleases").addEventListener("click", () => showSection("releases"));
$("tabAnn").addEventListener("click", () => showSection("ann"));
$("tabMaint").addEventListener("click", () => showSection("maint"));
$("tabPreorders").addEventListener("click", () => showSection("preorders"));

/* ---------- Предзаказы ---------- */

let preorders = [];
let preorderBusy = false;

const PREORDER_STATUSES = {
    new: "Ожидает",
    approved: "Подтверждён",
    rejected: "Отклонён",
};

function preorderMsg(text, ok = false) {
    const el = $("preordersMsg");
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

async function loadPreorders() {
    preorderMsg("Загружаем предзаказы…", true);

    const { data, error } = await supabase
        .from("preorders")
        .select("id, user_id, username, email, status, created_at")
        .order("created_at", { ascending: false });

    if (error) {
        preorderMsg("Не удалось загрузить предзаказы: " + error.message);
        return;
    }

    preorders = data || [];
    renderPreorders();

    preorderMsg(
        preorders.length
            ? `Всего предзаказов: ${preorders.length}`
            : "Пока никто не оформил предзаказ",
        true
    );
}

function preorderStatusBadge(status) {
    const el = document.createElement("span");

    let kind = "badge";
    if (status === "approved") kind += " ok";
    else if (status === "rejected") kind += " banned";
    else kind += " admin";

    el.className = kind + " first";
    el.textContent = PREORDER_STATUSES[status] || status || "Неизвестно";

    return el;
}

function preorderActionButton(label, id, status, danger = false) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "act" + (danger ? " danger" : "");
    btn.textContent = label;

    btn.addEventListener("click", () => updatePreorderStatus(id, status));

    return btn;
}

function renderPreorders() {
    const tbody = $("preorderRows");
    tbody.replaceChildren();

    if (preorders.length === 0) {
        const tr = document.createElement("tr");
        const cell = td("Предзаказов пока нет", "empty");
        cell.colSpan = 5;
        tr.append(cell);
        tbody.append(tr);
        return;
    }

    preorders.forEach((p) => {
        const tr = document.createElement("tr");

        tr.append(td(p.username || "—", "name"));
        tr.append(td(p.email || "—", "muted"));
        tr.append(td(formatDate(p.created_at), "muted"));

        const statusCell = document.createElement("td");
        statusCell.append(preorderStatusBadge(p.status));
        tr.append(statusCell);

        const actions = document.createElement("td");

        if (p.status !== "approved") {
            actions.append(
                preorderActionButton("Подтвердить", p.id, "approved")
            );
        }

        if (p.status !== "rejected") {
            actions.append(
                preorderActionButton("Отклонить", p.id, "rejected", true)
            );
        }

        if (p.status !== "new") {
            actions.append(
                preorderActionButton("Вернуть в ожидание", p.id, "new")
            );
        }

        tr.append(actions);
        tbody.append(tr);
    });
}

async function updatePreorderStatus(id, status) {
    if (preorderBusy) return;

    const preorder = preorders.find((p) => p.id === id);
    if (!preorder) return;

    const statusName = PREORDER_STATUSES[status];

    if (!window.confirm(
        `Изменить статус предзаказа пользователя ${preorder.username} на «${statusName}»?`
    )) {
        return;
    }

    preorderBusy = true;
    preorderMsg("Сохраняем статус…", true);

    const { error } = await supabase.rpc("admin_set_preorder_status", {
        target: id,
        new_status: status,
    });

    preorderBusy = false;

    if (error) {
        preorderMsg("Ошибка: " + error.message);
        return;
    }

    await loadPreorders();

    preorderMsg(
        `Статус предзаказа пользователя ${preorder.username} изменён: ${statusName}`,
        true
    );
}

$("preordersRefreshBtn").addEventListener("click", loadPreorders);

/* ---------- Релизы ---------- */

const PLATFORMS = { android: "Android", windows: "Windows" };
const EXTENSIONS = {
    android: [".apk"],
    windows: [".exe", ".zip", ".msi"],
};

let releases = [];

function relStatus(text, ok = false) {
    const el = $("relStatus");
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

function uploadErrText(error) {
    const m = (error?.message || "").toLowerCase();

    if (m.includes("maximum") || m.includes("too large") || m.includes("413") || m.includes("size")) {
        return "Файл больше лимита Supabase. Загрузи его на GitHub Releases и вставь ссылку.";
    }

    if (m.includes("already exists") || m.includes("duplicate")) {
        return "Файл для этой платформы и версии уже загружен. Измени версию или удали старый релиз.";
    }

    if (m.includes("bucket not found")) {
        return "В Supabase нет хранилища releases. Выполни SQL из инструкции.";
    }

    if (m.includes("row-level security") || m.includes("unauthorized")) {
        return "Нет прав на загрузку. Проверь SQL-правила хранилища.";
    }

    return errText(error);
}

function formatSize(bytes) {
    return bytes ? (bytes / 1024 / 1024).toFixed(1) + " МБ" : "";
}

function setAccept() {
    $("relFile").accept = EXTENSIONS[$("relPlatform").value].join(",");
}

$("relPlatform").addEventListener("change", () => {
    $("relFile").value = "";
    setAccept();
});

setAccept();

async function loadReleases() {
    const { data, error } = await supabase
        .from("releases")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) return relStatus(errText(error));

    releases = data || [];
    renderReleases();
}

function renderReleases() {
    const tbody = $("relRows");
    tbody.replaceChildren();

    if (releases.length === 0) {
        const tr = document.createElement("tr");
        const cell = td("Релизов пока нет", "empty");
        cell.colSpan = 6;
        tr.append(cell);
        tbody.append(tr);
        return;
    }

    releases.forEach((r) => {
        const tr = document.createElement("tr");

        tr.append(td(PLATFORMS[r.platform] || r.platform, "name"));

        const versionCell = document.createElement("td");
        const v = document.createElement("span");
        v.className = "name";
        v.textContent = r.version;
        versionCell.append(v);

        if (r.changelog) {
            const note = document.createElement("div");
            note.className = "note";
            note.textContent = r.changelog.length > 90
                ? r.changelog.slice(0, 90) + "…"
                : r.changelog;
            versionCell.append(note);
        }

        tr.append(versionCell);

        const fileText = r.file_path
            ? "Файл" + (r.file_size ? " · " + formatSize(r.file_size) : "")
            : "Ссылка";

        tr.append(td(fileText, "muted"));
        tr.append(td(formatDate(r.created_at), "muted"));

        const statusCell = document.createElement("td");
        statusCell.append(
            r.published
                ? badge("Опубликован", "ok", true)
                : badge("Скрыт", "banned", true)
        );

        tr.append(statusCell);

        const actions = document.createElement("td");
        actions.append(actionButton("Скачать", () => downloadRelease(r)));
        actions.append(actionButton(
            r.published ? "Скрыть" : "Показать",
            () => togglePublished(r)
        ));
        actions.append(actionButton("Удалить", () => deleteRelease(r), true));

        tr.append(actions);
        tbody.append(tr);
    });
}

async function downloadRelease(r) {
    if (r.file_path) {
        const { data, error } = await supabase.storage
            .from("releases")
            .createSignedUrl(r.file_path, 120, { download: true });

        if (error || !data) return relStatus(uploadErrText(error));

        window.location.href = data.signedUrl;
    } else if (r.external_url) {
        window.open(r.external_url, "_blank", "noopener");
    }
}

async function togglePublished(r) {
    const { error } = await supabase
        .from("releases")
        .update({ published: !r.published })
        .eq("id", r.id);

    if (error) return relStatus(errText(error));

    await loadReleases();
    relStatus(
        r.published ? "Релиз скрыт с сайта" : "Релиз снова виден на сайте",
        true
    );
}

async function deleteRelease(r) {
    const label = `${PLATFORMS[r.platform] || r.platform} ${r.version}`;

    if (!window.confirm(
        `Удалить релиз ${label}? Файл тоже будет удалён, это нельзя отменить.`
    )) return;

    if (r.file_path) {
        const { error: removeError } = await supabase.storage
            .from("releases")
            .remove([r.file_path]);

        if (removeError) return relStatus(uploadErrText(removeError));
    }

    const { error } = await supabase
        .from("releases")
        .delete()
        .eq("id", r.id);

    if (error) return relStatus(errText(error));

    await loadReleases();
    relStatus(`Релиз ${label} удалён`, true);
}

$("releaseForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const platform = $("relPlatform").value;
    const version = $("relVersion").value.trim();
    const notes = $("relNotes").value.trim();
    const file = $("relFile").files[0];
    const url = $("relUrl").value.trim();

    if (!version) return relStatus("Укажи версию");
    if (!file && !url) return relStatus("Выбери файл или вставь ссылку");
    if (!file && !/^https:\/\//i.test(url)) {
        return relStatus("Ссылка должна начинаться с https://");
    }

    if (file) {
        const ext = "." + file.name.split(".").pop().toLowerCase();

        if (!EXTENSIONS[platform].includes(ext)) {
            return relStatus(
                `Для ${PLATFORMS[platform]} нужен файл ${EXTENSIONS[platform].join(", ")}`
            );
        }
    }

    const btn = $("relSubmit");
    busy = true;
    btn.disabled = true;

    let filePath = null;

    if (file) {
        const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const safeVersion = version.replace(/[^A-Za-z0-9._-]/g, "_");
        filePath = `${platform}/${safeVersion}/${safeName}`;

        relStatus("Загружаем файл… не закрывай страницу", true);

        const { error } = await supabase.storage
            .from("releases")
            .upload(filePath, file, { upsert: false });

        if (error) {
            busy = false;
            btn.disabled = false;
            return relStatus(uploadErrText(error));
        }
    }

    const { error: insertError } = await supabase.from("releases").insert({
        platform,
        version,
        changelog: notes || null,
        file_path: filePath,
        external_url: file ? null : url,
        file_size: file ? file.size : null,
    });

    if (insertError) {
        if (filePath) {
            await supabase.storage.from("releases").remove([filePath]);
        }

        busy = false;
        btn.disabled = false;
        return relStatus(errText(insertError));
    }

    busy = false;
    btn.disabled = false;

    $("releaseForm").reset();
    setAccept();

    await loadReleases();
    relStatus(`Релиз ${PLATFORMS[platform]} ${version} опубликован`, true);
});

/* ---------- Объявления ---------- */

const KINDS = {
    info: "Обычное",
    update: "Обновление",
    warning: "Важное",
};

let anns = [];

function annMsg(text, ok = false) {
    const el = $("annMsg");
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

async function loadAnn() {
    const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) return annMsg(errText(error));

    anns = data || [];
    renderAnn();
}

function renderAnn() {
    const tbody = $("annRows");
    tbody.replaceChildren();

    if (anns.length === 0) {
        const tr = document.createElement("tr");
        const cell = td("Объявлений пока нет", "empty");
        cell.colSpan = 4;
        tr.append(cell);
        tbody.append(tr);
        return;
    }

    anns.forEach((a) => {
        const tr = document.createElement("tr");

        const titleCell = document.createElement("td");
        const t = document.createElement("span");
        t.className = "name";
        t.textContent = (a.pinned ? "📌 " : "") + a.title;
        titleCell.append(t);

        const note = document.createElement("div");
        note.className = "note";
        note.textContent = (a.body || "").length > 90
            ? a.body.slice(0, 90) + "…"
            : (a.body || "");

        titleCell.append(note);
        tr.append(titleCell);

        tr.append(td(KINDS[a.kind] || a.kind, "muted"));
        tr.append(td(formatDate(a.created_at), "muted"));

        const actions = document.createElement("td");
        actions.append(actionButton(
            a.pinned ? "Открепить" : "Закрепить",
            () => toggleAnnPin(a)
        ));
        actions.append(actionButton("Удалить", () => deleteAnn(a), true));

        tr.append(actions);
        tbody.append(tr);
    });
}

async function toggleAnnPin(a) {
    const { data, error } = await supabase
        .from("announcements")
        .update({ pinned: !a.pinned })
        .eq("id", a.id)
        .select();

    if (error) return annMsg(errText(error));

    if (!data || data.length === 0) {
        return annMsg("Не сохранилось: проверь права (RLS) для announcements");
    }

    await loadAnn();
    annMsg(a.pinned ? "Объявление откреплено" : "Объявление закреплено", true);
}

async function deleteAnn(a) {
    if (!window.confirm(`Удалить объявление «${a.title}»? Это нельзя отменить.`)) {
        return;
    }

    const { data, error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", a.id)
        .select();

    if (error) return annMsg(errText(error));

    if (!data || data.length === 0) {
        return annMsg("Не удалилось: проверь права (RLS) для announcements");
    }

    await loadAnn();
    annMsg("Объявление удалено", true);
}

$("annForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const title = $("annTitle").value.trim();
    const body = $("annBody").value.trim();

    if (!title || !body) return annMsg("Заполни заголовок и текст");

    const btn = $("annSubmit");
    busy = true;
    btn.disabled = true;

    const { error } = await supabase.from("announcements").insert({
        title,
        body,
        kind: $("annKind").value,
        pinned: $("annPinned").checked,
    });

    busy = false;
    btn.disabled = false;

    if (error) return annMsg(errText(error));

    $("annForm").reset();
    await loadAnn();
    annMsg("Объявление опубликовано", true);
});

/* ---------- Технические работы ---------- */

function maintMsg(text, ok = false) {
    const el = $("mMsg");
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

async function loadMaint() {
    const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();

    if (error) return maintMsg("Ошибка: " + error.message);
    if (!data) return maintMsg("В таблице site_settings нет строки с id = 1");

    $("mReason").value = data.maintenance_reason || "";
    $("mAnnounce").value = data.announcement || "";

    if (data.maintenance_until) {
        const d = new Date(data.maintenance_until);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        $("mUntil").value = d.toISOString().slice(0, 16);
    } else {
        $("mUntil").value = "";
    }

    const state = $("mState");
    state.textContent = data.maintenance ? "Включены" : "Выключены";
    state.className = "badge first " + (data.maintenance ? "banned" : "ok");
}

async function saveMaint(patch, okText) {
    const { data, error } = await supabase
        .from("site_settings")
        .update(patch)
        .eq("id", 1)
        .select();

    if (error) return maintMsg("Ошибка: " + error.message);

    if (!data || data.length === 0) {
        return maintMsg(
            "Не сохранилось: нет строки id = 1 в site_settings или нет прав (RLS). Выполни setup.sql"
        );
    }

    maintMsg(okText, true);
    await loadMaint();
}

$("mStart").addEventListener("click", () => {
    const until = $("mUntil").value;

    saveMaint(
        {
            maintenance: true,
            maintenance_reason: $("mReason").value.trim() || null,
            maintenance_until: until ? new Date(until).toISOString() : null,
            announcement: $("mAnnounce").value.trim() || null,
        },
        "Техработы включены"
    );
});

$("mStop").addEventListener("click", () => {
    saveMaint({ maintenance: false }, "Техработы выключены");
});

$("mSaveAnn").addEventListener("click", () => {
    saveMaint(
        { announcement: $("mAnnounce").value.trim() || null },
        "Объявление сохранено"
    );
});

/* ---------- Запуск ---------- */

init().catch((error) => {
    console.error(error);
    showGate("Ошибка запуска админ-панели: " + (error?.message || error));
});
