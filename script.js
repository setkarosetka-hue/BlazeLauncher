
/* ==========================================
   BlazeLauncher
   Official Website JavaScript
   ========================================== */

"use strict";

/* ---------- DOWNLOAD ---------- */

function showDownloadMessage() {
    alert(
        "🔥 BlazeLauncher\n\n" +
        "Лаунчер находится в разработке.\n" +
        "Скачивание APK появится после первого релиза!"
    );
}

/* ---------- NOTIFICATIONS ---------- */

function showNotification(message) {
    let notification = document.getElementById("blaze-notification");

    if (!notification) {
        notification = document.createElement("div");
        notification.id = "blaze-notification";

        notification.style.cssText = `
            position: fixed;
            bottom: 25px;
            left: 50%;
            transform: translateX(-50%);
            background: #1c1c1c;
            color: white;
            border: 1px solid #ff7518;
            padding: 16px 24px;
            border-radius: 14px;
            font-family: Onest, sans-serif;
            z-index: 9999;
            box-shadow: 0 0 25px rgba(255,117,24,0.2);
            text-align: center;
            max-width: 90%;
        `;

        document.body.appendChild(notification);
    }

    notification.textContent = message;
}

/* ---------- SMOOTH SCROLL ---------- */

document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener("click", function (event) {
        const targetId = this.getAttribute("href");

        if (targetId === "#") return;

        const target = document.querySelector(targetId);

        if (target) {
            event.preventDefault();

            target.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    });
});

/* ---------- CONSOLE ---------- */

console.log(
    "%c🔥 BlazeLauncher",
    "color:#ff7518;font-size:24px;font-weight:bold;"
);

console.log(
    "%cMinecraft Java Launcher",
    "color:#ffb52e;font-size:14px;"
);
