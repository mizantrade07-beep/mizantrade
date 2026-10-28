/* ======================================================
   OFFER FORM: scope pickers, banner upload, Word/Excel import
====================================================== */
(function () {
    "use strict";

    function init() {
        var dataNode = document.getElementById("offerScopeData");
        var editor = document.getElementById("contentEditor");
        if (!dataNode) return;

        var data;
        try {
            data = JSON.parse(dataNode.dataset.json || "{}");
        } catch (error) {
            data = {};
        }

        var categories = data.categories || [];
        var products = data.products || [];
        var selected = data.selected || {};

        var catBySlug = {};
        categories.forEach(function (cat) {
            catBySlug[cat.slug] = cat;
        });

        var productById = {};
        products.forEach(function (product) {
            productById[product.id] = product;
        });

        function unique(list) {
            var seen = {};
            return (list || []).filter(function (item) {
                if (!item || seen[item]) return false;
                seen[item] = true;
                return true;
            });
        }

        var picked = {
            categories: unique(selected.categories),
            subCategories: unique(selected.subCategories),
            childCategories: unique(selected.childCategories),
            products: unique(selected.products)
        };

        /* ---------- scope pickers ---------- */

        function productLabel(product) {
            return product.title + (product.sku ? " (" + product.sku + ")" : "");
        }

        function labelFor(kind, id) {
            if (kind === "products") {
                return productById[id] ? productLabel(productById[id]) : id;
            }
            return catBySlug[id] ? catBySlug[id].path || catBySlug[id].name : id;
        }

        function topAncestor(cat) {
            var seen = {};
            var current = cat;
            while (current && current.parent && !seen[current.slug]) {
                seen[current.slug] = true;
                current = catBySlug[current.parent];
            }
            return current || cat;
        }

        function itemsFor(kind) {
            if (kind === "categories") {
                return categories
                    .filter(function (cat) { return !cat.parent; })
                    .map(function (cat) {
                        return { id: cat.slug, label: cat.name };
                    });
            }

            if (kind === "subCategories") {
                var parentSet = {};
                picked.categories.forEach(function (slug) { parentSet[slug] = true; });

                return categories
                    .filter(function (cat) {
                        if (Number(cat.level) !== 2) return false;
                        if (picked.categories.length) return Boolean(parentSet[cat.parent]);
                        return true;
                    })
                    .map(function (cat) {
                        return { id: cat.slug, label: cat.path || cat.name };
                    });
            }

            if (kind === "childCategories") {
                var subSet = {};
                picked.subCategories.forEach(function (slug) { subSet[slug] = true; });
                var mainSet = {};
                picked.categories.forEach(function (slug) { mainSet[slug] = true; });

                return categories
                    .filter(function (cat) {
                        if (Number(cat.level) !== 3) return false;
                        if (picked.subCategories.length) return Boolean(subSet[cat.parent]);
                        if (picked.categories.length) {
                            return Boolean(mainSet[topAncestor(cat).slug]);
                        }
                        return true;
                    })
                    .map(function (cat) {
                        return { id: cat.slug, label: cat.path || cat.name };
                    });
            }

            var scopeSet = {};
            picked.categories.forEach(function (slug) { scopeSet[slug] = true; });
            picked.subCategories.forEach(function (slug) { scopeSet[slug] = true; });
            picked.childCategories.forEach(function (slug) { scopeSet[slug] = true; });
            var hasScope = Object.keys(scopeSet).length > 0;

            return products
                .filter(function (product) {
                    if (!hasScope) return true;
                    return (product.scopeSlugs || []).some(function (slug) {
                        return scopeSet[slug];
                    });
                })
                .map(function (product) {
                    return { id: product.id, label: productLabel(product) };
                });
        }

        var pickers = Array.prototype.slice.call(
            document.querySelectorAll(".scope-picker")
        );

        function renderChips(picker) {
            var kind = picker.dataset.kind;
            var list = picker.querySelector(".scope-list");
            if (!list) return;

            list.innerHTML = "";

            picked[kind].forEach(function (id) {
                var chip = document.createElement("span");
                chip.className = "scope-chip";

                var hidden = document.createElement("input");
                hidden.type = "hidden";
                hidden.name = kind;
                hidden.value = id;

                var label = document.createElement("span");
                label.textContent = labelFor(kind, id);
                label.title = label.textContent;

                var remove = document.createElement("button");
                remove.type = "button";
                remove.innerHTML = "&times;";
                remove.title = "Remove";
                remove.addEventListener("click", function () {
                    picked[kind] = picked[kind].filter(function (value) {
                        return value !== id;
                    });
                    refreshAll();
                });

                chip.appendChild(hidden);
                chip.appendChild(label);
                chip.appendChild(remove);
                list.appendChild(chip);
            });
        }

        function refreshDatalist(picker) {
            var kind = picker.dataset.kind;
            var input = picker.querySelector(".scope-input");
            var datalist = picker.querySelector("datalist");
            if (!input || !datalist) return;

            var items = itemsFor(kind);
            picker.__items = items;

            datalist.id = "offerDl-" + kind;
            input.setAttribute("list", datalist.id);
            datalist.innerHTML = "";

            items.forEach(function (item) {
                if (picked[kind].indexOf(item.id) !== -1) return;
                var option = document.createElement("option");
                option.value = item.label;
                datalist.appendChild(option);
            });
        }

        function refreshAll() {
            pickers.forEach(function (picker) {
                refreshDatalist(picker);
                renderChips(picker);
            });
        }

        function addFromInput(picker) {
            var kind = picker.dataset.kind;
            var input = picker.querySelector(".scope-input");
            if (!input) return;

            var query = input.value.trim();
            if (!query) return;

            var items = picker.__items || itemsFor(kind);
            var lower = query.toLowerCase();

            var match = items.filter(function (item) {
                return item.label.toLowerCase() === lower;
            })[0];

            if (!match) {
                match = items.filter(function (item) {
                    return item.label.toLowerCase().indexOf(lower) !== -1;
                })[0];
            }

            if (match && picked[kind].indexOf(match.id) === -1) {
                picked[kind].push(match.id);
            }

            input.value = "";
            refreshAll();
        }

        pickers.forEach(function (picker) {
            var input = picker.querySelector(".scope-input");
            var addBtn = picker.querySelector(".scope-add");

            if (addBtn) {
                addBtn.addEventListener("click", function () {
                    addFromInput(picker);
                });
            }

            if (input) {
                input.addEventListener("keydown", function (event) {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        addFromInput(picker);
                    }
                });
            }
        });

        refreshAll();

        /* ---------- banner ---------- */

        var bannerInput = document.getElementById("bannerInput");
        var bannerFile = document.getElementById("bannerFile");
        var bannerPreview = document.getElementById("bannerPreview");
        var bannerImg = document.getElementById("bannerPreviewImg");
        var clearBanner = document.getElementById("clearBanner");

        function syncBanner() {
            if (!bannerInput || !bannerImg || !bannerPreview) return;

            var url = bannerInput.value.trim();

            if (url) {
                bannerImg.src = url;
                bannerImg.style.display = "block";
                bannerPreview.classList.add("has-image");
            } else {
                bannerImg.removeAttribute("src");
                bannerImg.style.display = "none";
                bannerPreview.classList.remove("has-image");
            }
        }

        function uploadBanner(file) {
            if (!file) return;

            var formData = new FormData();
            formData.append("media", file);

            fetch("/admin/upload-media", { method: "POST", body: formData })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    var url =
                        result && result.urls && result.urls.length
                            ? result.urls[0]
                            : result && result.url;
                    if (!url) throw new Error((result && result.message) || "Upload failed.");
                    bannerInput.value = url;
                    syncBanner();
                })
                .catch(function (error) {
                    alert("Banner upload failed: " + error.message);
                })
                .finally(function () {
                    if (bannerFile) bannerFile.value = "";
                });
        }

        if (bannerInput) {
            bannerInput.addEventListener("input", syncBanner);
            bannerInput.addEventListener("change", syncBanner);
        }

        if (bannerFile) {
            bannerFile.addEventListener("change", function () {
                uploadBanner(bannerFile.files && bannerFile.files[0]);
            });
        }

        if (clearBanner) {
            clearBanner.addEventListener("click", function () {
                bannerInput.value = "";
                syncBanner();
            });
        }

        if (bannerImg) {
            bannerImg.addEventListener("error", function () {
                if (bannerInput && bannerInput.value.trim()) {
                    bannerImg.style.display = "none";
                    bannerPreview.classList.remove("has-image");
                }
            });
        }

        /* ---------- Word / Excel import ---------- */

        var importStatus = document.getElementById("importStatus");
        var importReplace = document.getElementById("importReplace");

        function importFile(input) {
            var file = input.files && input.files[0];
            if (!file) return;

            if (!editor) {
                alert("The content editor is not ready.");
                return;
            }

            if (importStatus) importStatus.textContent = "Importing " + file.name + "…";

            var formData = new FormData();
            formData.append("file", file);

            fetch("/admin/offers/import", { method: "POST", body: formData })
                .then(function (res) { return res.json(); })
                .then(function (result) {
                    if (!result.success || !result.html) {
                        throw new Error(result.message || "Import failed.");
                    }

                    if (importReplace && importReplace.checked) {
                        editor.innerHTML = result.html;
                    } else if (!editor.innerHTML.trim()) {
                        editor.innerHTML = result.html;
                    } else {
                        editor.insertAdjacentHTML(
                            "beforeend",
                            "<p><br></p>" + result.html
                        );
                    }

                    if (window.OfferFormula) {
                        window.OfferFormula.recalcTables(editor);
                    }

                    if (importStatus) {
                        importStatus.textContent = "Imported " + file.name + " ✓";
                    }

                    editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
                })
                .catch(function (error) {
                    if (importStatus) importStatus.textContent = "";
                    alert("Import failed: " + error.message);
                })
                .finally(function () {
                    input.value = "";
                });
        }

        document.querySelectorAll(".offer-import-file").forEach(function (input) {
            input.addEventListener("change", function () {
                importFile(input);
            });
        });

        /* ---------- formulas ---------- */

        if (editor && window.OfferFormula) {
            window.OfferFormula.recalcTables(editor);

            editor.addEventListener("dblclick", function (event) {
                var cell = event.target.closest
                    ? event.target.closest("td[data-formula], th[data-formula]")
                    : null;
                if (!cell) return;

                event.preventDefault();

                var current = cell.getAttribute("data-formula") || "=";
                var value = prompt(
                    "Edit formula for this cell (start with =)",
                    current
                );

                if (value === null) return;

                window.OfferFormula.setCellFormula(cell, value);
                window.OfferFormula.recalcTables(editor);
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
