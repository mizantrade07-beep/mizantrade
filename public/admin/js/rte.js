/* ======================================================
   GENERIC RICH TEXT EDITOR (reusable)
   ব্যবহার: ফর্মে রাখুন —
     <div class="rte-wrap">
       <div class="rte-toolbar" data-editor="myEditor"> ...buttons... </div>
       <div class="rte-area" id="myEditor" contenteditable="true"></div>
     </div>
     <textarea name="content" class="hidden-source" data-rte-source="myEditor"></textarea>
   টুলবার বাটন: data-cmd="bold" ইত্যাদি, data-role="image", .rte-select[data-block]
====================================================== */
(function () {
    "use strict";

    function init() {
        var toolbars = document.querySelectorAll(".rte-toolbar[data-editor]");
        if (!toolbars.length) return;

        var savedRange = null;
        var imageTarget = null;

        var imageInput = document.createElement("input");
        imageInput.type = "file";
        imageInput.accept = "image/jpeg,image/png,image/webp";
        imageInput.style.display = "none";
        document.body.appendChild(imageInput);

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

                    if (btn.dataset.role === "image") {
                        imageTarget = editor;
                        imageInput.click();
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

            var blockSelect = toolbar.querySelector(".rte-select[data-block]");
            if (blockSelect) {
                blockSelect.addEventListener("change", function () {
                    editor.focus();
                    restoreSelection();
                    document.execCommand("formatBlock", false, "<" + blockSelect.value + ">");
                });
            }
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

        /* ফর্ম সাবমিটে সব এডিটরের HTML সংশ্লিষ্ট textarea-তে সিংক করা */
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
