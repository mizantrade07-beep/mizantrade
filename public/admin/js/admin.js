(function () {
    var sidebar = document.getElementById("adminSidebar");
    var toggle = document.getElementById("sidebarToggle");

    if (!sidebar || !toggle) return;

    toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        sidebar.classList.toggle("open");
    });

    document.addEventListener("click", function (event) {
        if (window.innerWidth > 900) return;
        if (!sidebar.classList.contains("open")) return;
        if (sidebar.contains(event.target) || toggle.contains(event.target)) return;
        sidebar.classList.remove("open");
    });
})();
