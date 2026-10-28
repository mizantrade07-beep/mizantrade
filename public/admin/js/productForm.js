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
       IMAGE MANAGER (reorder / set main / remove)
    ================================================== */

    var imgManager = document.getElementById("imgManager");
    var mainImageInput = document.getElementById("mainImageInput");
    var galleryInput = document.getElementById("galleryInput");

    /* Newly picked files that are not uploaded yet: file + its tile blob URL. */
    var pendingFiles = [];

    function tileHtml(blobUrl) {
        return (
            '<div class="img-tile" data-new="1" data-url="' + blobUrl + '">' +
            '<img src="' + blobUrl + '" alt="New product image">' +
            '<span class="main-badge"><i class="fa-solid fa-star"></i> Main</span>' +
            '<div class="tile-actions">' +
            '<button type="button" class="tile-btn tile-main" title="Set as main image"><i class="fa-solid fa-star"></i></button>' +
            '<button type="button" class="tile-btn tile-left" title="Move left"><i class="fa-solid fa-arrow-left"></i></button>' +
            '<button type="button" class="tile-btn tile-right" title="Move right"><i class="fa-solid fa-arrow-right"></i></button>' +
            '<button type="button" class="tile-btn danger tile-remove" title="Remove image"><i class="fa-solid fa-trash"></i></button>' +
            "</div>" +
            "</div>"
        );
    }

    function addPendingFiles(fileList) {
        if (!imgManager) return;

        Array.prototype.forEach.call(fileList || [], function (file) {
            var blobUrl = URL.createObjectURL(file);
            pendingFiles.push({ file: file, blobUrl: blobUrl });
            imgManager.insertAdjacentHTML("beforeend", tileHtml(blobUrl));
        });
    }

    if (mainImageInput) {
        mainImageInput.addEventListener("change", function () {
            addPendingFiles(mainImageInput.files);
            mainImageInput.value = "";
        });
    }

    if (galleryInput) {
        galleryInput.addEventListener("change", function () {
            addPendingFiles(galleryInput.files);
            galleryInput.value = "";
        });
    }

    if (imgManager) {
        imgManager.addEventListener("click", function (event) {
            var btn = event.target.closest(".tile-btn");
            if (!btn) return;

            var tile = btn.closest(".img-tile");

            if (btn.classList.contains("tile-main")) {
                imgManager.querySelectorAll(".img-tile").forEach(function (t) {
                    t.classList.remove("is-main");
                });
                tile.classList.add("is-main");
                return;
            }

            if (btn.classList.contains("tile-left") && tile.previousElementSibling) {
                tile.parentNode.insertBefore(tile, tile.previousElementSibling);
                return;
            }

            if (btn.classList.contains("tile-right") && tile.nextElementSibling) {
                tile.parentNode.insertBefore(tile.nextElementSibling, tile);
                return;
            }

            if (btn.classList.contains("tile-remove")) {
                if (!confirm("Remove this image?")) return;
                if (tile.dataset.new === "1") {
                    pendingFiles = pendingFiles.filter(function (pf) {
                        if (pf.blobUrl === tile.dataset.url) {
                            URL.revokeObjectURL(pf.blobUrl);
                            return false;
                        }
                        return true;
                    });
                }
                tile.remove();
            }
        });
    }

    /* Rebuild the real file inputs from the grid order right before submit. */
    function syncImageInputs() {
        if (!imgManager || !form) return;

        var orderedMain = null;
        var orderedExisting = [];
        var orderedFiles = [];

        imgManager.querySelectorAll(".img-tile").forEach(function (tile) {
            var isMain = tile.classList.contains("is-main");

            if (tile.dataset.new === "1") {
                var found = null;
                pendingFiles.forEach(function (pf) {
                    if (pf.blobUrl === tile.dataset.url) found = pf.file;
                });
                if (found) {
                    if (isMain && !orderedMain) orderedMain = found;
                    else orderedFiles.push(found);
                }
            } else {
                if (isMain) {
                    if (!orderedMain) orderedMain = tile.dataset.url;
                } else {
                    orderedExisting.push(tile.dataset.url);
                }
            }
        });

        var dtGallery = new DataTransfer();
        orderedFiles.forEach(function (f) { dtGallery.items.add(f); });
        if (galleryInput) galleryInput.files = dtGallery.files;

        var dtMain = new DataTransfer();
        if (orderedMain && typeof orderedMain !== "string") {
            dtMain.items.add(orderedMain);
        }
        if (mainImageInput) mainImageInput.files = dtMain.files;

        form.querySelector('[name="galleryOrdered"]').value = "1";
        form.querySelector('[name="mainImageKeep"]').value =
            typeof orderedMain === "string" ? orderedMain : "";
        form.querySelector('[name="existingImagesJoined"]').value =
            orderedExisting.join("\n");
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
       SUBMIT — image order + auto sku
       (editor HTML is synced by rte.js via data-rte-source)
    ================================================== */

    var form = document.getElementById("productForm");

    if (form) {
        form.addEventListener("submit", function () {
            if (skuInput && !skuInput.value.trim()) {
                skuInput.value = randomSku();
            }

            syncImageInputs();
        });
    }
})();
