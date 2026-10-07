(function () {
    "use strict";

    var brands = window.MT_BRANDS || [];

    /* ---------- auto slug ---------- */

    var nameInput = document.getElementById("catName");
    var slugInput = document.getElementById("catSlug");
    var slugAuto = document.getElementById("slugAuto");

    function slugify(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    if (nameInput && slugInput && slugAuto) {
        nameInput.addEventListener("input", function () {
            if (slugAuto.checked) {
                slugInput.value = slugify(nameInput.value);
            }
        });

        slugInput.addEventListener("input", function () {
            slugAuto.checked = false;
        });
    }

    /* ---------- category type hint (Main / Sub / Child) ---------- */

    var parentSelect = document.getElementById("catParent");
    var typeHint = document.getElementById("catTypeHint");

    function updateTypeHint() {
        if (!parentSelect || !typeHint) return;

        var option = parentSelect.options[parentSelect.selectedIndex];
        var parentLevel = option ? Number(option.getAttribute("data-level") || 0) : 0;
        var myLevel = parentLevel + 1;

        var labels = {
            1: { text: "Main Category", cls: "lvl-main" },
            2: { text: "Sub Category", cls: "lvl-sub" },
            3: { text: "Child Category", cls: "lvl-child" }
        };

        var info = labels[myLevel] || labels[1];

        typeHint.className = "cat-type-hint " + info.cls;
        typeHint.innerHTML =
            '<i class="fa-solid fa-circle-info"></i> এটি হবে <strong>' +
            info.text +
            "</strong>" +
            (parentSelect.value
                ? ' — প্যারেন্ট: <strong>' + option.textContent.trim() + "</strong>"
                : " — সরাসরি header menu-তে দেখাবে");
    }

    if (parentSelect) {
        parentSelect.addEventListener("change", updateTypeHint);
        updateTypeHint();
    }

    /* ---------- icon live preview ---------- */

    var iconInput = document.getElementById("catIcon");
    var iconPreview = document.getElementById("iconPreview");

    if (iconInput && iconPreview) {
        iconInput.addEventListener("input", function () {
            var value = iconInput.value.trim() || "fa-solid fa-microchip";
            iconPreview.innerHTML = '<i class="' + value.replace(/"/g, "") + '"></i>';
        });
    }

    /* ---------- brand chip builder ---------- */

    var chipList = document.getElementById("brandChips");
    var brandInput = document.getElementById("brandInput");
    var brandAddBtn = document.getElementById("brandAddBtn");

    function renderChips() {
        if (!chipList) return;

        chipList.innerHTML = "";

        brands.forEach(function (brand, index) {
            var chip = document.createElement("span");
            chip.className = "chip";

            var hidden = document.createElement("input");
            hidden.type = "hidden";
            hidden.name = "brands";
            hidden.value = brand;
            chip.appendChild(hidden);

            var label = document.createElement("span");
            label.textContent = brand;
            chip.appendChild(label);

            var remove = document.createElement("button");
            remove.type = "button";
            remove.className = "chip-remove";
            remove.title = "Remove";
            remove.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            remove.addEventListener("click", function () {
                brands.splice(index, 1);
                renderChips();
            });
            chip.appendChild(remove);

            chipList.appendChild(chip);
        });
    }

    function addBrand() {
        if (!brandInput) return;

        var value = brandInput.value.trim();

        if (!value) return;

        if (brands.indexOf(value) === -1) {
            brands.push(value);
            renderChips();
        }

        brandInput.value = "";
        brandInput.focus();
    }

    if (brandAddBtn) {
        brandAddBtn.addEventListener("click", addBrand);
    }

    if (brandInput) {
        brandInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                addBrand();
            }
        });
    }

    renderChips();
})();
