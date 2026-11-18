
import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

/* ---------- Модальное окно ---------- */
const modal = $("authModal");
const tabs = { login: $("tabLogin"), register: $("tabRegister") };
const forms = {
    login: $("loginForm"),
    register: $("registerForm"),
    reset: $("resetForm"),
    newpass: $("newPassForm"),
};

function showTab(name) {
    Object.keys(tabs).forEach((key) => {
        const active = key === name;
        tabs[key].classList.toggle("active", active);
        tabs[key].setAttribute("aria-selected", active);
    });

    Object.keys(forms).forEach((key) => {
        forms[key].hidden = key !== name;
    });

    $("modalTabs").hidden = name === "reset" || name === "newpass";

    ["loginMsg", "registerMsg", "resetMsg", "newPassMsg"].forEach((id) => {
        setMsg($(id), "");
    });
}

function openModal(tab = "login") {
    showTab(tab);
    modal.hidden = false;
    document.body.style.overflow = "hidden";

    const first = forms[tab].querySelector("input");
    if (first) first.focus();
}

function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = "";
}

tabs.login.addEventListener("click", () => showTab("login"));
tabs.register.addEventListener("click", () => showTab("register"));

$("modalClose").addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeModal();
});

$("navLogin").addEventListener("click", () => openModal("login"));

$("navLogout").addEventListener("click", async () => {
    await supabase.auth.signOut();
});

/* ---------- Сообщения ---------- */
function setMsg(el, text, ok = false) {
    if (!el) return;

    el.textContent = text;
    el.classList.toggle("ok", ok);
}

function translateError(error) {
    const m = (error.message || "").toLowerCase();

    if (m.includes("already registered") || m.includes("already been registered"))
        return "Эта почта уже зарегистрирована";

    if (m.includes("database error") || m.includes("duplicate") || m.includes("username"))
        return "Этот ник уже занят или недопустим";

    if (m.includes("invalid login"))
        return "Неверная почта или пароль";

    if (m.includes("email not confirmed"))
        return "Сначала подтверди почту — проверь письмо";

    if (m.includes("rate limit"))
        return "Слишком много попыток. Попробуй чуть позже";

    if (m.includes("different from the old") || m.includes("same password"))
        return "Новый пароль должен отличаться от старого";

    if (m.includes("session missing") || m.includes("expired") || m.includes("invalid token"))
        return "Ссылка устарела. Запроси сброс пароля ещё раз";

    if (m.includes("password"))
        return "Пароль слишком простой (минимум 8 символов)";

    return "Не получилось: " + error.message;
}

/* ---------- Регистрация ---------- */
forms.register.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = $("registerMsg");
    const username = $("regName").value.trim();
    const email = $("regEmail").value.trim();
    const pass = $("regPass").value;
    const pass2 = $("regPass2").value;

    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) {
        return setMsg(msg, "Ник: 3–16 символов, только латиница, цифры и _");
    }

    if (pass.length < 8) {
        return setMsg(msg, "Пароль должен быть не короче 8 символов");
    }

    if (pass !== pass2) {
        return setMsg(msg, "Пароли не совпадают");
    }

    const btn = forms.register.querySelector("button[type=submit]");
    btn.disabled = true;
    setMsg(msg, "Создаём аккаунт…");

    const { data, error } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
            data: { username },
        },
    });

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));

    if (data.session) {
        setMsg(msg, "Готово! Аккаунт создан", true);
        setTimeout(closeModal, 800);
    } else {
        setMsg(
            msg,
            "Почти готово! Мы отправили письмо — подтверди почту и войди.",
            true
        );
    }

    forms.register.reset();
});

/* ---------- Вход ---------- */
forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = $("loginMsg");
    const btn = forms.login.querySelector("button[type=submit>");

    btn.disabled = true;
    setMsg(msg, "Входим…");

    const { error } = await supabase.auth.signInWithPassword({
        email: $("logEmail").value.trim(),
        password: $("logPass").value,
    });

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));

    forms.login.reset();
    setMsg(msg, "");
    closeModal();
});

/* ---------- Сброс пароля ---------- */
$("forgotLink").addEventListener("click", () => {
    const email = $("logEmail").value.trim();

    showTab("reset");

    if (email) $("resetEmail").value = email;

    $("resetEmail").focus();
});

$("backToLogin").addEventListener("click", () => showTab("login"));

forms.reset.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = $("resetMsg");
    const btn = forms.reset.querySelector("button[type=submit]");

    btn.disabled = true;
    setMsg(msg, "Отправляем…");

    const { error } = await supabase.auth.resetPasswordForEmail(
        $("resetEmail").value.trim(),
        {
            redirectTo: window.location.origin + window.location.pathname,
        }
    );

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));

    setMsg(
        msg,
        "Если такой аккаунт есть, мы отправили письмо со ссылкой. Проверь почту и папку «Спам».",
        true
    );
});

forms.newpass.addEventListener("submit", async (e) => {
    e.preventDefault();

    const msg = $("newPassMsg");
    const pass = $("newPass").value;

    if (pass.length < 8) {
        return setMsg(msg, "Пароль должен быть не короче 8 символов");
    }

    if (pass !== $("newPass2").value) {
        return setMsg(msg, "Пароли не совпадают");
    }

    const btn = forms.newpass.querySelector("button[type=submit]");

    btn.disabled = true;
    setMsg(msg, "Сохраняем…");

    const { error } = await supabase.auth.updateUser({
        password: pass,
    });

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));

    forms.newpass.reset();
    setMsg(msg, "Пароль изменён!", true);

    history.replaceState(null, "", window.location.pathname);

    setTimeout(closeModal, 1200);
});

/* ---------- Предзаказы ---------- */

const preorderButton = $("preorderButton");
const preorderStatus = $("preorderStatus");

let preorderBusy = false;

function preorderStatusText(status) {
    const statuses = {
        new: "Ожидает подтверждения",
        approved: "Подтверждён",
        rejected: "Отклонён",
    };

    return statuses[status] || "Статус неизвестен";
}

function showPreorderMessage(message, ok = false) {
    if (!preorderStatus) return;

    preorderStatus.textContent = message;
    preorderStatus.classList.toggle("ok", ok);
}

async function loadPreorderStatus(session = currentSession) {
    if (!preorderStatus || !preorderButton) return;

    if (!session) {
        preorderButton.disabled = false;
        showPreorderMessage("");
        return;
    }

    const { data, error } = await supabase
        .from("preorders")
        .select("status")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (error) {
        showPreorderMessage("Не удалось проверить предзаказ.");
        return;
    }

    if (data) {
        preorderButton.textContent = "Предзаказ оформлен";
        preorderButton.disabled = true;

        showPreorderMessage(
            "Твой предзаказ: " + preorderStatusText(data.status),
            true
        );
    } else {
        preorderButton.textContent = "Сделать бесплатный предзаказ";
        preorderButton.disabled = false;
        showPreorderMessage("");
    }
}

async function createPreorder() {
    if (preorderBusy) return;

    if (!currentSession) {
        showPreorderMessage("Сначала войди в аккаунт, чтобы оформить предзаказ.");
        openModal("login");
        return;
    }

    preorderBusy = true;
    preorderButton.disabled = true;

    const originalText = preorderButton.textContent;
    preorderButton.textContent = "Оформляем предзаказ…";

    showPreorderMessage("Отправляем заявку…");

    try {
        const { data, error } = await supabase.rpc("create_preorder");

        if (error) {
            console.error("Preorder error:", error);

            preorderButton.disabled = false;
            preorderButton.textContent = originalText;

            if (
                error.message?.includes("not_authenticated") ||
                error.message?.includes("account_data_missing")
            ) {
                showPreorderMessage(
                    "Не удалось получить данные аккаунта. Попробуй выйти и войти снова."
                );
            } else if (
                error.message?.includes("Could not find the function") ||
                error.message?.includes("does not exist")
            ) {
                showPreorderMessage(
                    "Функция предзаказов ещё не настроена в Supabase. Сначала выполни SQL-код."
                );
            } else {
                showPreorderMessage("Не удалось оформить предзаказ: " + error.message);
            }

            return;
        }

        const preorder = Array.isArray(data) ? data[0] : data;

        preorderButton.textContent = "Предзаказ оформлен";
        preorderButton.disabled = true;

        showPreorderMessage(
            "Бесплатный предзаказ успешно оформлен! Статус: " +
                preorderStatusText(preorder?.status || "new"),
            true
        );
    } catch (error) {
        console.error("Preorder error:", error);

        preorderButton.disabled = false;
        preorderButton.textContent = originalText;

        showPreorderMessage("Произошла ошибка. Попробуй ещё раз.");
    } finally {
        preorderBusy = false;
    }
}

if (preorderButton) {
    preorderButton.addEventListener("click", createPreorder);
}

/* ---------- Состояние: вошёл / не вошёл ---------- */
let currentSession = null;

function render(session) {
    currentSession = session;

    const loggedIn = Boolean(session);

    $("navLogin").hidden = loggedIn;
    $("navUser").hidden = !loggedIn;

    if (loggedIn) {
        const name = session.user.user_metadata?.username || session.user.email;

        $("navUserName").textContent = name;
        $("downloadHint").textContent = "Ты вошёл как " + name;
    } else {
        $("downloadHint").textContent =
            "Чтобы скачать лаунчер, нужно войти в аккаунт.";
    }

    loadPreorderStatus(session);
}

// Проверяем профиль: забанен ли человек и админ ли он
async function applySession(session) {
    if (!session) {
        $("navAdmin").hidden = true;
        return;
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role, banned, ban_reason")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profile?.banned) {
        await supabase.auth.signOut();
        openModal("login");

        setMsg(
            $("loginMsg"),
            "Аккаунт заблокирован. Причина: " +
                (profile.ban_reason || "не указана")
        );

        return;
    }

    $("navAdmin").hidden = profile?.role !== "admin";
}

supabase.auth.onAuthStateChange((event, session) => {
    render(session);

    if (event === "PASSWORD_RECOVERY") {
        openModal("newpass");
    }

    setTimeout(() => applySession(session), 0);
});

supabase.auth.getSession().then(({ data }) => {
    render(data.session);
});

/* ---------- Релизы и скачивание ---------- */
const PLATFORM_NAMES = {
    android: "Android",
    windows: "Windows",
};

const PLATFORM_ELEMENTS = {
    android: ["dlAndroid", "metaAndroid"],
    windows: ["dlWindows", "metaWindows"],
};

const latest = {
    android: null,
    windows: null,
};

function formatSize(bytes) {
    return bytes ? (bytes / 1024 / 1024).toFixed(1) + " МБ" : "";
}

function renderReleases() {
    let any = false;

    const notes = $("releaseNotes");
    notes.replaceChildren();

    Object.keys(latest).forEach((platform) => {
        const r = latest[platform];
        const [btnId, metaId] = PLATFORM_ELEMENTS[platform];

        const btn = $(btnId);
        const meta = $(metaId);

        if (!r) {
            btn.disabled = true;
            meta.textContent = "Скоро";
            return;
        }

        any = true;
        btn.disabled = false;

        const parts = ["Версия " + r.version];
        const size = formatSize(r.file_size);

        if (size) parts.push(size);

        parts.push(new Date(r.created_at).toLocaleDateString("ru-RU"));

        meta.textContent = parts.join(" · ");

        if (r.changelog) {
            const box = document.createElement("div");

            const title = document.createElement("strong");
            title.textContent =
                `Что нового в ${PLATFORM_NAMES[platform]} ${r.version}`;

            const text = document.createElement("p");
            text.textContent = r.changelog;

            box.append(title, text);
            notes.append(box);
        }
    });

    if (any) {
        $("downloadStatus").textContent = "✅ Доступно для скачивания";
        $("downloadText").textContent =
            "Выбери версию для своего устройства.";
    }
}

async function loadReleases() {
    const { data, error } = await supabase
        .from("releases")
        .select(
            "id, platform, version, changelog, file_path, external_url, file_size, created_at"
        )
        .eq("published", true)
        .order("created_at", { ascending: false });

    if (error || !data) return;

    data.forEach((r) => {
        if (r.platform in latest && !latest[r.platform]) {
            latest[r.platform] = r;
        }
    });

    renderReleases();
}

async function download(platform) {
    const r = latest[platform];

    if (!r) return;

    if (!currentSession) {
        openModal("login");
        return;
    }

    const hint = $("downloadHint");

    if (r.file_path) {
        hint.textContent = "Готовим ссылку…";

        const { data, error } = await supabase.storage
            .from("releases")
            .createSignedUrl(r.file_path, 120, {
                download: true,
            });

        if (error || !data) {
            hint.textContent =
                "Не удалось начать скачивание. Попробуй ещё раз позже.";
            return;
        }

        hint.textContent = "Скачивание началось…";
        window.location.href = data.signedUrl;
    } else if (r.external_url) {
        window.open(r.external_url, "_blank", "noopener");
    }
}

$("dlAndroid").addEventListener("click", () => download("android"));
$("dlWindows").addEventListener("click", () => download("windows"));

loadReleases();

/* ---------- Новости из Supabase ---------- */
async function loadNews() {
    const { data, error } = await supabase
        .from("news")
        .select("title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(6);

    if (error || !data || data.length === 0) return;

    const grid = $("newsGrid");
    grid.replaceChildren();

    data.forEach((item) => {
        const card = document.createElement("div");
        card.className = "news-card";

        const date = document.createElement("div");
        date.className = "date";
        date.textContent = new Date(item.created_at).toLocaleDateString("ru-RU");

        const title = document.createElement("h3");
        title.textContent = item.title;

        const text = document.createElement("p");
        text.textContent = item.body;

        card.append(date, title, text);
        grid.append(card);
    });
}

loadNews();
