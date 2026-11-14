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

init();
