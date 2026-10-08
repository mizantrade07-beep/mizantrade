(function () {
    "use strict";

    var categories = window.MT_CATEGORIES || [];
    var selected = window.MT_SELECTED || {};

    /* ==================================================
       SLUG + SKU AUTO
    ================================================== */

    var titleInput = document.getElementById("titleInput");
    var slugInput = document.getElementById("slugInput");
    var slugAuto = document.getElementById("slugAuto");
    var skuInput = document.getElementById("skuInput");
    var skuGenBtn = document.getElementById("skuGenBtn");

    function slugify(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    function randomSku() {
        return "MT-" + String(Math.floor(100000 + Math.random() * 900000));
    }

    if (titleInput && slugInput && slugAuto) {
        titleInput.addEventListener("input", function () {
            if (slugAuto.checked) {
                slugInput.value = slugify(titleInput.value);
            }
        });

        slugInput.addEventListener("input", function () {
            slugAuto.checked = false;
        });
    }

    if (skuGenBtn && skuInput) {
        skuGenBtn.addEventListener("click", function () {
            skuInput.value = randomSku();
        });
    }

    /* ==================================================
       CASCADING CATEGORY -> SUB -> CHILD -> BRAND
    ================================================== */

    var categorySelect = document.getElementById("categorySelect");
    var subSelect = document.getElementById("subSelect");
    var childSelect = document.getElementById("childSelect");
    var brandInput = document.getElementById("brandInput");
    var brandList = document.getElementById("brandList");

    function findIn(list, value) {
        if (!value) return null;
        var arr = list || [];
        for (var i = 0; i < arr.length; i++) {
            if (arr[i].name === value || arr[i].slug === value) return arr[i];
        }
        return null;
    }

    function descendantBrands(node) {
        var out = [];
        (function walk(n) {
            if (!n) return;
            out = out.concat(n.brands || []);
            (n.children || []).forEach(walk);
        })(node);
        return out;
    }

    function fillSelect(select, nodes, placeholder, keepValue) {
        if (!select) return;

        select.innerHTML = "";

        var empty = document.createElement("option");
        empty.value = "";
        empty.textContent = (nodes && nodes.length) ? placeholder : "— none —";
        select.appendChild(empty);

        (nodes || []).forEach(function (node) {
            var option = document.createElement("option");
            option.value = node.name;
            option.textContent = node.name;
            select.appendChild(option);
        });

        if (keepValue) select.value = keepValue;
    }

    function fillBrands() {
        if (!brandList) return;

        brandList.innerHTML = "";

        var main = findIn(categories, categorySelect ? categorySelect.value : "");
        if (!main) return;

        var sub = findIn(main.children, subSelect ? subSelect.value : "");
        var child = sub ? findIn(sub.children, childSelect ? childSelect.value : "") : null;

        var deepest = child || sub || main;
        var brands = (deepest.brands && deepest.brands.length)
            ? deepest.brands.slice()
            : descendantBrands(main);

        var seen = {};
        brands.forEach(function (brand) {
            if (!brand || seen[brand]) return;
            seen[brand] = true;
            var option = document.createElement("option");
            option.value = brand;
            brandList.appendChild(option);
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener("change", function () {
            var main = findIn(categories, categorySelect.value);
            fillSelect(subSelect, main ? main.children : [], "Select sub category", "");
            fillSelect(childSelect, [], "Select child category", "");
            fillBrands();
        });
    }

    if (subSelect) {
        subSelect.addEventListener("change", function () {
            var main = findIn(categories, categorySelect.value);
            var sub = main ? findIn(main.children, subSelect.value) : null;
            fillSelect(childSelect, sub ? sub.children : [], "Select child category", "");
            fillBrands();
        });
    }

    if (childSelect) {
        childSelect.addEventListener("change", fillBrands);
    }

    /* edit মোডে পুরনো সিলেকশন বসানো */
    if (categorySelect) {
        var initMain = findIn(categories, selected.mainCategory || categorySelect.value);
        fillSelect(subSelect, initMain ? initMain.children : [], "Select sub category", selected.subCategory);

        var initSub = initMain ? findIn(initMain.children, selected.subCategory) : null;
        fillSelect(childSelect, initSub ? initSub.children : [], "Select child category", selected.childCategory);

        fillBrands();
    }

    /* ==================================================
       RICH TEXT EDITORS
    ================================================== */

    var savedRange = null;

    function saveSelection(editor) {
        var sel = window.getSelection();
        if (sel.rangeCount && editor.contains(sel.anchorNode)) {
            savedRange = sel.getRangeAt(0).cloneRange();
        }
    }

    function restoreSelection() {
        if (!savedRange) return;
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }

    var imageInput = document.getElementById("rteImageInput");
    var imageTarget = null;

    document.querySelectorAll(".rte-toolbar").forEach(function (toolbar) {
        var editor = document.getElementById(toolbar.dataset.editor);
        var source = editor && editor.nextElementSibling;

        if (!editor) return;

        if (editor.id === "shortEditor") {
            source = document.getElementById("shortDescSource");
        } else {
            source = document.getElementById("longDescSource");
        }

        if (source && source.value) {
            editor.innerHTML = source.value;
        }

        ["keyup", "mouseup", "focus"].forEach(function (evt) {
            editor.addEventListener(evt, function () {
                saveSelection(editor);
            });
        });

        toolbar.querySelectorAll(".rte-btn").forEach(function (btn) {
            btn.addEventListener("mousedown", function (event) {
                event.preventDefault();
            });

            btn.addEventListener("click", function () {
                editor.focus();
                restoreSelection();

                if (btn.dataset.role === "image") {
                    imageTarget = editor;
                    if (imageInput) imageInput.click();
                    return;
                }

                if (btn.dataset.cmd === "createLink") {
                    var url = prompt("Link URL:", "https://");
                    if (url) document.execCommand("createLink", false, url);
                    return;
                }

                document.execCommand(btn.dataset.cmd, false, null);
            });
        });

        var blockSelect = toolbar.querySelector(".rte-select");

        if (blockSelect) {
            blockSelect.addEventListener("change", function () {
                editor.focus();
                restoreSelection();
                document.execCommand("formatBlock", false, "<" + blockSelect.value + ">");
            });
        }
    });

    if (imageInput) {
        imageInput.addEventListener("change", function () {
            if (!imageInput.files || !imageInput.files[0]) return;

            var formData = new FormData();
            formData.append("image", imageInput.files[0]);

            fetch("/admin/upload-image", {
                method: "POST",
                body: formData
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (!data.success || !imageTarget) return;

                    imageTarget.focus();
                    restoreSelection();
                    document.execCommand("insertImage", false, data.url);
                })
                .catch(function () {
                    alert("Image upload failed. Please try again.");
                })
                .finally(function () {
                    imageInput.value = "";
                });
        });
    }

    /* ==================================================
       IMAGE PREVIEWS
    ================================================== */

    var mainImageInput = document.getElementById("mainImageInput");
    var mainPreview = document.getElementById("mainPreview");

    if (mainImageInput && mainPreview) {
        mainImageInput.addEventListener("change", function () {
            if (!mainImageInput.files || !mainImageInput.files[0]) return;
            mainPreview.src = URL.createObjectURL(mainImageInput.files[0]);
            mainPreview.style.display = "";
        });
    }

    var galleryInput = document.getElementById("galleryInput");
    var galleryPreview = document.getElementById("galleryPreview");

    if (galleryInput && galleryPreview) {
        galleryInput.addEventListener("change", function () {
            galleryPreview.innerHTML = "";

            Array.prototype.forEach.call(galleryInput.files, function (file) {
                var img = document.createElement("img");
                img.className = "preview-tile";
                img.src = URL.createObjectURL(file);
                galleryPreview.appendChild(img);
            });
        });
    }

    /* ==================================================
       CALL FOR PRICE TOGGLE
    ================================================== */

    var callForPrice = document.getElementById("callForPrice");
    var regularPrice = document.getElementById("regularPrice");
    var salePrice = document.getElementById("salePrice");

    function syncPriceState() {
        if (!callForPrice) return;
        var disabled = callForPrice.checked;
        if (regularPrice) regularPrice.disabled = disabled;
        if (salePrice) salePrice.disabled = disabled;
    }

    if (callForPrice) {
        callForPrice.addEventListener("change", syncPriceState);
        syncPriceState();
    }

    /* ==================================================
       SPEC ROWS
    ================================================== */

    var addSpecBtn = document.getElementById("addSpecBtn");
    var specRows = document.getElementById("specRows");

    function specRowHtml() {
        return (
            '<div class="spec-row">' +
            '<input type="text" name="specKey[]" list="specKeyOptions" class="spec-key-input" placeholder="Attribute — e.g. Warranty">' +
            '<input type="text" name="specValue[]" class="spec-value-input" placeholder="Value — e.g. 3 Years Official">' +
            '<button type="button" class="mini-button danger spec-remove" title="Remove row">' +
            '<i class="fa-solid fa-trash"></i></button>' +
            "</div>"
        );
    }

    /* Point a value input at the saved-values datalist for its key. */
    function syncSpecValueList(keyInput) {
        var row = keyInput.closest(".spec-row");
        if (!row) return;
        var valueInput = row.querySelector(".spec-value-input");
        if (!valueInput) return;
        var maps = window.SPEC_VALUE_LISTS || {};
        valueInput.setAttribute("list", maps[keyInput.value.trim()] || "");
    }

    if (addSpecBtn && specRows) {
        addSpecBtn.addEventListener("click", function () {
            specRows.insertAdjacentHTML("beforeend", specRowHtml());
        });

        specRows.addEventListener("click", function (event) {
            var btn = event.target.closest(".spec-remove");
            if (btn) btn.closest(".spec-row").remove();
        });

        specRows.addEventListener("input", function (event) {
            if (event.target.classList.contains("spec-key-input")) {
                syncSpecValueList(event.target);
            }
        });
    }

    /* ==================================================
       SUBMIT — sync editors + auto sku
    ================================================== */

    var form = document.getElementById("productForm");

    if (form) {
        form.addEventListener("submit", function () {
            if (skuInput && !skuInput.value.trim()) {
                skuInput.value = randomSku();
            }

            var shortEditor = document.getElementById("shortEditor");
            var shortSource = document.getElementById("shortDescSource");
            if (shortEditor && shortSource) shortSource.value = shortEditor.innerHTML;

            var longEditor = document.getElementById("longEditor");
            var longSource = document.getElementById("longDescSource");
            if (longEditor && longSource) longSource.value = longEditor.innerHTML;
        });
    }
})();
