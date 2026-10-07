document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("adminSidebar");
    const toggle = document.getElementById("sidebarToggle");

    if (!sidebar || !toggle) {
        return;
    }

    toggle.addEventListener("click", () => {
        sidebar.classList.toggle("open");
    });
});