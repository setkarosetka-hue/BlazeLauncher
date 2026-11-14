import { supabase } from "./supabase.js";

// Ссылка на скачивание. Когда выложишь релиз на GitHub — вставь сюда, например:
// "https://github.com/setkarosetka-hue/BlazeLauncher/releases/latest"
// Пока пусто — покажется сообщение «в разработке».
const DOWNLOAD_URL = "";

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
    // Вкладки «Вход / Регистрация» не нужны на экранах сброса пароля
    $("modalTabs").hidden = name === "reset" || name === "newpass";
    ["loginMsg", "registerMsg", "resetMsg", "newPassMsg"].forEach((id) => setMsg($(id), ""));
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
    el.textContent = text;
    el.classList.toggle("ok", ok);
}

function translateError(error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("already registered") || m.includes("already been registered"))
        return "Эта почта уже зарегистрирована";
    if (m.includes("database error") || m.includes("duplicate") || m.includes("username"))
        return "Этот ник уже занят или недопустим";
    if (m.includes("invalid login")) return "Неверная почта или пароль";
    if (m.includes("email not confirmed")) return "Сначала подтверди почту — проверь письмо";
    if (m.includes("rate limit")) return "Слишком много попыток. Попробуй чуть позже";
    if (m.includes("different from the old") || m.includes("same password"))
        return "Новый пароль должен отличаться от старого";
    if (m.includes("session missing") || m.includes("expired") || m.includes("invalid token"))
        return "Ссылка устарела. Запроси сброс пароля ещё раз";
    if (m.includes("password")) return "Пароль слишком простой (минимум 8 символов)";
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
        options: { data: { username } },
    });

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));

    if (data.session) {
        // Подтверждение почты выключено — сразу вошли
        setMsg(msg, "Готово! Аккаунт создан", true);
        setTimeout(closeModal, 800);
    } else {
        setMsg(msg, "Почти готово! Мы отправили письмо — подтверди почту и войди.", true);
    }
    forms.register.reset();
});

/* ---------- Вход ---------- */
forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("loginMsg");
    const btn = forms.login.querySelector("button[type=submit]");
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

// Шаг 1: отправляем письмо со ссылкой
forms.reset.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("resetMsg");
    const btn = forms.reset.querySelector("button[type=submit]");
    btn.disabled = true;
    setMsg(msg, "Отправляем…");

    const { error } = await supabase.auth.resetPasswordForEmail(
        $("resetEmail").value.trim(),
        { redirectTo: window.location.origin + window.location.pathname }
    );

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));
    setMsg(msg, "Если такой аккаунт есть, мы отправили письмо со ссылкой. Проверь почту и папку «Спам».", true);
});

// Шаг 2: человек перешёл по ссылке из письма и задаёт новый пароль
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

    const { error } = await supabase.auth.updateUser({ password: pass });

    btn.disabled = false;

    if (error) return setMsg(msg, translateError(error));

    forms.newpass.reset();
    setMsg(msg, "Пароль изменён!", true);
    history.replaceState(null, "", window.location.pathname); // убираем токен из адреса
    setTimeout(closeModal, 1200);
});

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
        $("downloadHint").textContent = "Чтобы скачать лаунчер, нужно войти в аккаунт.";
    }
}

supabase.auth.onAuthStateChange((event, session) => {
    render(session);
    // Человек пришёл по ссылке из письма «Сброс пароля»
    if (event === "PASSWORD_RECOVERY") openModal("newpass");
});
supabase.auth.getSession().then(({ data }) => render(data.session));

/* ---------- Скачивание ---------- */
$("downloadBtn").addEventListener("click", () => {
    if (!currentSession) {
        openModal("login");
        return;
    }
    if (DOWNLOAD_URL) {
        window.open(DOWNLOAD_URL, "_blank", "noopener");
    } else {
        $("downloadHint").textContent =
            "BlazeLauncher ещё в разработке — скачивание скоро появится.";
    }
});

/* ---------- Новости из Supabase ---------- */
async function loadNews() {
    const { data, error } = await supabase
        .from("news")
        .select("title, body, created_at")
        .order("created_at", { ascending: false })
        .limit(6);

    // Если таблицы нет или она пустая — остаются новости, написанные в index.html
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
