import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);

// Регистрация
$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const pass = $("regPass").value;
  const msg = $("regMsg");

  if (pass !== $("regPass2").value) {
    msg.textContent = "Пароли не совпадают";
    return;
  }

  const { error } = await supabase.auth.signUp({
    email,
    password: pass,
    options: { data: { username } }
  });

  msg.textContent = error
    ? (error.message.includes("username") || error.message.includes("duplicate")
        ? "Этот ник уже занят" : error.message)
    : "Готово! Проверь почту и подтверди адрес.";
});

// Вход
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await supabase.auth.signInWithPassword({
    email: $("logEmail").value.trim(),
    password: $("logPass").value
  });
  $("logMsg").textContent = error ? "Неверная почта или пароль" : "";
});

// Показывать скачивание только вошедшим
function render(session) {
  $("downloadBlock").hidden = !session;
}
supabase.auth.onAuthStateChange((_event, session) => render(session));
supabase.auth.getSession().then(({ data }) => render(data.session));

// Новости
async function loadNews() {
  const { data, error } = await supabase
    .from("news").select("*").order("created_at", { ascending: false });
  if (error) return;
  $("newsList").innerHTML = data.map(n =>
    `<article><h3></h3><p></p></article>`).join("");
  [...$("newsList").children].forEach((el, i) => {
    el.querySelector("h3").textContent = data[i].title;   // textContent защищает от XSS
    el.querySelector("p").textContent = data[i].body;
  });
}
loadNews();
