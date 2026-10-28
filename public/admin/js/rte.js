/* ======================================================
   GENERIC RICH TEXT EDITOR (reusable)
   ব্যবহার: ফর্মে রাখুন —
     <div class="rte-wrap">
       <div class="rte-toolbar" data-editor="myEditor"> ...buttons... </div>
       <div class="rte-area" id="myEditor" contenteditable="true"></div>
     </div>
     <textarea name="content" class="hidden-source" data-rte-source="myEditor"></textarea>
   টুলবার বাটন: data-cmd="bold" ইত্যাদি, data-role="image" ইত্যাদি,
   .rte-select[data-block|data-fontname|data-fontsize], .rte-color[data-color-cmd]
====================================================== */
(function () {
    "use strict";

    function tableHtml(rows, cols) {
        var html = '<table class="rte-table"><tbody>';
        for (var r = 0; r < rows; r++) {
            html += "<tr>";
            for (var c = 0; c < cols; c++) {
                html += "<td><br></td>";
            }
            html += "</tr>";
        }
        html += "</tbody></table><p><br></p>";
        return html;
    }

    function cleanPastedHtml(html) {
        var doc;
        try {
            doc = new DOMParser().parseFromString(html, "text/html");
        } catch (error) {
            return html;
        }
        if (!doc || !doc.body) return html;

        doc.querySelectorAll("script,style,meta,link,title").forEach(function (el) {
            el.remove();
        });

        Array.prototype.slice
            .call(doc.body.querySelectorAll("*"))
            .forEach(function (el) {
                // Word namespace tags like <o:p> — keep their content
                if (el.tagName.indexOf(":") !== -1) {
                    while (el.firstChild) {
                        el.parentNode.insertBefore(el.firstChild, el);
                    }
                    el.remove();
                    return;
                }

                var cls = el.getAttribute("class");
                if (cls && /mso/i.test(cls)) {
                    var kept = cls
                        .split(/\s+/)
                        .filter(function (name) {
                            return !/^mso/i.test(name);
                        })
                        .join(" ");
                    if (kept) el.setAttribute("class", kept);
                    else el.removeAttribute("class");
                }

                var style = el.getAttribute("style");
                if (style) {
                    var cleaned = style
                        .split(";")
                        .filter(function (decl) {
                            return decl.trim() && !/mso-/i.test(decl);
                        })
                        .join(";");
                    if (cleaned.trim()) el.setAttribute("style", cleaned);
                    else el.removeAttribute("style");
                }

                el.removeAttribute("lang");
                el.removeAttribute("xmlns");
            });

        return doc.body.innerHTML;
    }

    function init() {
        var toolbars = document.querySelectorAll(".rte-toolbar[data-editor]");
        if (!toolbars.length) return;

        var savedRange = null;
        var imageTarget = null;
        var videoTarget = null;

        var imageInput = document.createElement("input");
        imageInput.type = "file";
        imageInput.accept = "image/jpeg,image/png,image/webp";
        imageInput.style.display = "none";
        document.body.appendChild(imageInput);

        var videoInput = document.createElement("input");
        videoInput.type = "file";
        videoInput.accept = "video/mp4,video/webm";
        videoInput.style.display = "none";
        document.body.appendChild(videoInput);

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

        function sourceFor(editor) {
            return document.querySelector('[data-rte-source="' + editor.id + '"]');
        }

        function recalc(editor) {
            var engine = window.OfferFormula;
            if (engine && typeof engine.recalcTables === "function") {
                engine.recalcTables(editor);
            }
        }

        function cellOf(editor) {
            var engine = window.OfferFormula;
            if (engine && typeof engine.currentCell === "function") {
                return engine.currentCell(editor);
            }

            var sel = window.getSelection();
            if (!sel || !sel.anchorNode || !editor.contains(sel.anchorNode)) return null;
            var node = sel.anchorNode.nodeType === 1
                ? sel.anchorNode
                : sel.anchorNode.parentElement;
            return node && node.closest ? node.closest("td,th") : null;
        }

        function insertTable(editor) {
            var rows = parseInt(prompt("Number of rows (1-30):", "3"), 10);
            if (!rows || rows < 1) return;
            var cols = parseInt(prompt("Number of columns (1-15):", "3"), 10);
            if (!cols || cols < 1) return;

            rows = Math.min(rows, 30);
            cols = Math.min(cols, 15);

            editor.focus();
            restoreSelection();
            document.execCommand("insertHTML", false, tableHtml(rows, cols));
            recalc(editor);
        }

        function addRow(cell) {
            var row = cell.parentElement;
            var tr = document.createElement("tr");
            Array.prototype.forEach.call(row.children, function () {
                var td = document.createElement("td");
                td.innerHTML = "<br>";
                tr.appendChild(td);
            });
            row.parentNode.insertBefore(tr, row.nextSibling);
        }

        function deleteRow(cell) {
            var table = cell.closest("table");
            var row = cell.parentElement;

            if (table && table.querySelectorAll("tr").length <= 1) {
                table.remove();
                return;
            }
            row.remove();
        }

        function addColumn(cell) {
            var table = cell.closest("table");
            if (!table) return;

            var row = cell.parentElement;
            var index = Array.prototype.indexOf.call(row.children, cell);

            Array.prototype.forEach.call(table.querySelectorAll("tr"), function (tr) {
                var reference = tr.children[index] || null;
                var td = document.createElement("td");
                td.innerHTML = "<br>";
                if (reference) tr.insertBefore(td, reference.nextSibling);
                else tr.appendChild(td);
            });
        }

        function deleteColumn(cell) {
            var table = cell.closest("table");
            if (!table) return;

            var row = cell.parentElement;
            var index = Array.prototype.indexOf.call(row.children, cell);

            Array.prototype.forEach.call(table.querySelectorAll("tr"), function (tr) {
                if (tr.children[index]) tr.children[index].remove();
            });

            if (!table.querySelector("td,th")) table.remove();
        }

        function editFormula(editor) {
            var cell = cellOf(editor);
            if (!cell) {
                alert("Click inside a table cell first.");
                return;
            }

            var engine = window.OfferFormula;
            if (!engine) return;

            var current = cell.getAttribute("data-formula") || "";
            var value = prompt(
                "Formula for this cell (start with =).\nExamples: =SUM(A1:A5)  =B2*C2  =IF(D2>0,D2*2,0)",
                current || "="
            );

            if (value === null) return;

            engine.setCellFormula(cell, value);
            recalc(editor);
        }

        toolbars.forEach(function (toolbar) {
            var editor = document.getElementById(toolbar.dataset.editor);
            if (!editor) return;

            var source = sourceFor(editor);
            if (source && source.value) {
                editor.innerHTML = source.value;
            }

            ["keyup", "mouseup", "focus"].forEach(function (evt) {
                editor.addEventListener(evt, function () {
                    saveSelection(editor);
                });
            });

            toolbar.querySelectorAll(".rte-btn").forEach(function (btn) {
                btn.addEventListener("mousedown", function (e) { e.preventDefault(); });

                btn.addEventListener("click", function () {
                    editor.focus();
                    restoreSelection();

                    var role = btn.dataset.role;

                    if (role === "image") {
                        imageTarget = editor;
                        imageInput.click();
                        return;
                    }

                    if (role === "video") {
                        videoTarget = editor;
                        videoInput.click();
                        return;
                    }

                    if (role === "table") {
                        insertTable(editor);
                        return;
                    }

                    if (role === "recalc") {
                        recalc(editor);
                        return;
                    }

                    if (role === "formula") {
                        editFormula(editor);
                        return;
                    }

                    if (role === "rowAdd" || role === "rowDelete" ||
                        role === "colAdd" || role === "colDelete" ||
                        role === "tableDelete") {
                        var cell = cellOf(editor);
                        if (!cell) {
                            alert("Click inside a table first.");
                            return;
                        }

                        if (role === "rowAdd") addRow(cell);
                        if (role === "rowDelete") deleteRow(cell);
                        if (role === "colAdd") addColumn(cell);
                        if (role === "colDelete") deleteColumn(cell);
                        if (role === "tableDelete") {
                            var table = cell.closest("table");
                            if (table) table.remove();
                        }
                        recalc(editor);
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

            toolbar.querySelectorAll(".rte-color").forEach(function (input) {
                input.addEventListener("mousedown", function () {
                    saveSelection(editor);
                });

                input.addEventListener("change", function () {
                    editor.focus();
                    restoreSelection();
                    document.execCommand(input.dataset.colorCmd, false, input.value);
                });
            });

            var blockSelect = toolbar.querySelector(".rte-select[data-block]");
            if (blockSelect) {
                blockSelect.addEventListener("change", function () {
                    editor.focus();
                    restoreSelection();
                    document.execCommand("formatBlock", false, "<" + blockSelect.value + ">");
                });
            }

            var fontSelect = toolbar.querySelector(".rte-select[data-fontname]");
            if (fontSelect) {
                fontSelect.addEventListener("change", function () {
                    editor.focus();
                    restoreSelection();
                    document.execCommand("fontName", false, fontSelect.value);
                });
            }

            var sizeSelect = toolbar.querySelector(".rte-select[data-fontsize]");
            if (sizeSelect) {
                sizeSelect.addEventListener("change", function () {
                    editor.focus();
                    restoreSelection();
                    // execCommand only accepts 1-7; remap the placeholder to a px size.
                    document.execCommand("fontSize", false, "7");
                    var fonts = editor.querySelectorAll('font[size="7"]');
                    for (var i = 0; i < fonts.length; i++) {
                        fonts[i].removeAttribute("size");
                        fonts[i].style.fontSize = sizeSelect.value;
                    }
                });
            }

            /* Word / Excel paste: keep tables & fonts, drop Office junk */
            editor.addEventListener("paste", function (event) {
                var clipboard = event.clipboardData;
                if (!clipboard) return;

                var html = clipboard.getData("text/html");
                if (!html) return;

                event.preventDefault();
                editor.focus();
                document.execCommand("insertHTML", false, cleanPastedHtml(html));
                setTimeout(function () {
                    recalc(editor);
                }, 60);
            });

            /* Typing "=" turns the cell into a formula; typing a value clears it */
            editor.addEventListener("input", function (event) {
                var cell = event.target && event.target.closest
                    ? event.target.closest("td,th")
                    : null;
                if (!cell) return;

                var text = String(cell.textContent || "").trim();

                if (text.charAt(0) === "=") {
                    cell.setAttribute("data-formula", text);
                    cell.classList.add("formula-cell");
                } else if (cell.hasAttribute("data-formula")) {
                    cell.removeAttribute("data-formula");
                    cell.classList.remove("formula-cell");
                    cell.removeAttribute("title");
                }
            });

            editor.addEventListener("focusout", function (event) {
                var cell = event.target && event.target.closest
                    ? event.target.closest("td,th")
                    : null;
                if (!cell) return;
                setTimeout(function () {
                    recalc(editor);
                }, 30);
            });
        });

        imageInput.addEventListener("change", function () {
            if (!imageInput.files || !imageInput.files[0]) return;

            var formData = new FormData();
            formData.append("image", imageInput.files[0]);

            fetch("/admin/upload-image", { method: "POST", body: formData })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (!data.success || !imageTarget) return;
                    imageTarget.focus();
                    restoreSelection();
                    document.execCommand("insertImage", false, data.url);
                })
                .catch(function () { alert("Image upload failed."); })
                .finally(function () { imageInput.value = ""; });
        });

        videoInput.addEventListener("change", function () {
            if (!videoInput.files || !videoInput.files[0]) return;

            var formData = new FormData();
            formData.append("media", videoInput.files[0]);

            fetch("/admin/upload-media", { method: "POST", body: formData })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (!data.success || !videoTarget) return;
                    var url = data.urls && data.urls.length ? data.urls[0] : data.url;
                    if (!url) return;
                    videoTarget.focus();
                    restoreSelection();
                    document.execCommand(
                        "insertHTML",
                        false,
                        '<video controls style="max-width:100%;" src="' + url + '"></video>'
                    );
                })
                .catch(function () { alert("Video upload failed."); })
                .finally(function () { videoInput.value = ""; });
        });

        /* ফর্ম সাবমিটে ফর্মুলা হিসাব + সব এডিটরের HTML সিংক */
        var forms = {};
        toolbars.forEach(function (toolbar) {
            var editor = document.getElementById(toolbar.dataset.editor);
            if (!editor) return;
            var form = editor.closest("form");
            if (!form) return;
            if (!form.__rteId) form.__rteId = Math.random();
            forms[form.__rteId] = form;
        });

        Object.keys(forms).forEach(function (key) {
            var form = forms[key];
            if (form.__rteBound) return;
            form.__rteBound = true;

            form.addEventListener("submit", function () {
                form.querySelectorAll(".rte-area[id]").forEach(function (editor) {
                    recalc(editor);
                    var source = sourceFor(editor);
                    if (source) source.value = editor.innerHTML;
                });
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
