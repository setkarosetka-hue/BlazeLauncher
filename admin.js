import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

let me = null;        // id текущего админа
let users = [];       // все пользователи
let banTarget = null; // кого сейчас банят
let busy = false;     // защита от двойных кликов

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

/* ---------- Проверка доступа ---------- */
async function init() {
    const { data } = await supabase.auth.getSession();
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

/* ---------- Список пользователей ---------- */
async function loadUsers() {
    setStatus("Загружаем…", true);

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, email, role, banned, ban_reason, banned_at, created_at")
        .order("created_at", { ascending: false });

    if (error) return setStatus(errText(error));

    users = data || [];
    setStatus("");
    render();
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

function userRow(u) {
    const tr = document.createElement("tr");
    const isMe = u.id === me;
    const isAdmin = u.role === "admin";

    // Ник
    const nameCell = document.createElement("td");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = u.username || "—";
    nameCell.append(name);
    if (isAdmin) nameCell.append(badge("админ", "admin"));
    tr.append(nameCell);

    // Почта и дата
    tr.append(td(u.email || "—", "muted"));
    tr.append(
        td(
            new Date(u.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
            "muted"
        )
    );

    // Статус
    const statusCell = document.createElement("td");
    statusCell.append(u.banned ? badge("Забанен", "banned", true) : badge("Активен", "ok", true));
    if (u.banned) {
        const reason = document.createElement("div");
        reason.className = "reason";
        reason.textContent = "Причина: " + (u.ban_reason || "не указана");
        statusCell.append(reason);
    }
    tr.append(statusCell);

    // Действия
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

function render() {
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

/* ---------- Действия ---------- */
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
        supabase.rpc("admin_set_ban", { target: u.id, do_ban: doBan, reason }),
        doBan ? `Забанен: ${u.username}` : `Разбанен: ${u.username}`
    );
}

function setRole(u, makeAdmin) {
    const question = makeAdmin
        ? `Выдать админку пользователю ${u.username}? Он сможет банить людей и выдавать админку другим.`
        : `Снять админку с ${u.username}?`;
    if (!window.confirm(question)) return;

    return run(
        supabase.rpc("admin_set_role", { target: u.id, make_admin: makeAdmin }),
        makeAdmin ? `${u.username} теперь админ` : `${u.username} больше не админ`
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
$("search").addEventListener("input", render);
$("filter").addEventListener("change", render);
$("refreshBtn").addEventListener("click", loadUsers);

/* ---------- Вкладки ---------- */
let releasesLoaded = false;

function showSection(name) {
    const isUsers = name === "users";
    $("usersSection").hidden = !isUsers;
    $("releasesSection").hidden = isUsers;
    $("tabUsers").classList.toggle("active", isUsers);
    $("tabReleases").classList.toggle("active", !isUsers);

    if (!isUsers && !releasesLoaded) {
        releasesLoaded = true;
        loadReleases();
    }
}

$("tabUsers").addEventListener("click", () => showSection("users"));
$("tabReleases").addEventListener("click", () => showSection("releases"));

/* ---------- Релизы ---------- */
const PLATFORMS = { android: "Android", windows: "Windows" };
const EXTENSIONS = { android: [".apk"], windows: [".exe", ".zip", ".msi"] };
let releases = [];

function relStatus(text, ok = false) {
    const el = $("relStatus");
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

function uploadErrText(error) {
    const m = (error?.message || "").toLowerCase();
    if (m.includes("maximum") || m.includes("too large") || m.includes("413") || m.includes("size")) {
        return "Файл больше лимита Supabase (на бесплатном плане 50 МБ). Загрузи его на GitHub Releases и вставь ссылку.";
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
            note.textContent = r.changelog.length > 90 ? r.changelog.slice(0, 90) + "…" : r.changelog;
            versionCell.append(note);
        }
        tr.append(versionCell);

        const fileText = r.file_path
            ? "Файл" + (r.file_size ? " · " + formatSize(r.file_size) : "")
            : "Ссылка";
        tr.append(td(fileText, "muted"));

        tr.append(
            td(
                new Date(r.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }),
                "muted"
            )
        );

        const statusCell = document.createElement("td");
        statusCell.append(
            r.published ? badge("Опубликован", "ok", true) : badge("Скрыт", "banned", true)
        );
        tr.append(statusCell);

        const actions = document.createElement("td");
        actions.append(actionButton("Скачать", () => downloadRelease(r)));
        actions.append(
            actionButton(r.published ? "Скрыть" : "Показать", () => togglePublished(r))
        );
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
    relStatus(r.published ? "Релиз скрыт с сайта" : "Релиз снова виден на сайте", true);
}

async function deleteRelease(r) {
    const label = `${PLATFORMS[r.platform] || r.platform} ${r.version}`;
    if (!window.confirm(`Удалить релиз ${label}? Файл тоже будет удалён, это нельзя отменить.`)) return;

    if (r.file_path) {
        const { error: removeError } = await supabase.storage.from("releases").remove([r.file_path]);
        if (removeError) return relStatus(uploadErrText(removeError));
    }

    const { error } = await supabase.from("releases").delete().eq("id", r.id);
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
    if (!file && !/^https:\/\//i.test(url)) return relStatus("Ссылка должна начинаться с https://");

    if (file) {
        const ext = "." + file.name.split(".").pop().toLowerCase();
        if (!EXTENSIONS[platform].includes(ext)) {
            return relStatus(`Для ${PLATFORMS[platform]} нужен файл ${EXTENSIONS[platform].join(", ")}`);
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
        // не оставляем в хранилище «осиротевший» файл
        if (filePath) await supabase.storage.from("releases").remove([filePath]);
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

init();
