
import { supabase } from "./supabase.js";

const form = document.getElementById("loginForm");
const email = document.getElementById("email");
const password = document.getElementById("password");
const button = document.getElementById("loginButton");
const message = document.getElementById("message");

function showMessage(text, success = false) {
    message.textContent = text;
    message.style.color = success ? "#62d994" : "#ff7777";
}

async function checkAdmin(userId) {
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, banned")
        .eq("id", userId)
        .maybeSingle();

    if (error) {
        throw new Error("Не удалось проверить права администратора: " + error.message);
    }

    if (!profile || profile.role !== "admin" || profile.banned) {
        throw new Error("У этого аккаунта нет прав администратора.");
    }

    return true;
}

// Проверяем уже существующую сессию
async function checkExistingSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) return;

    try {
        await checkAdmin(data.session.user.id);
        window.location.replace("./admin.html");
    } catch {
        // Обычный пользователь остаётся на странице входа.
    }
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "Проверяем...";
    showMessage("");

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value
        });

        if (error) {
            throw new Error("Неверная почта или пароль.");
        }

        if (!data.user) {
            throw new Error("Не удалось определить аккаунт.");
        }

        // Проверяем роль в базе данных
        await checkAdmin(data.user.id);

        showMessage("Доступ разрешён! Открываем панель...", true);

        window.location.replace("./admin.html");

    } catch (error) {
        await supabase.auth.signOut();

        showMessage(error.message || "Произошла ошибка.");

        button.disabled = false;
        button.textContent = "Войти в панель";
    }
});

checkExistingSession();
