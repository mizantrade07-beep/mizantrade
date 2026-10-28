/* ======================================================
   OFFER FORMULA ENGINE (Excel-style, no dependency)

   - Works inside any contenteditable table.
   - A cell becomes a formula cell when its text starts with "="
     or it carries data-formula="=...".
   - Supports: + - * / ^ % & comparisons, cell refs A1, ranges A1:B5,
     SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, PRODUCT, ROUND, ABS,
     SQRT, POWER, MOD, IF, CONCAT, LEN, UPPER, LOWER, TRIM.
   - Usable from the browser (window.OfferFormula) and from Node.
====================================================== */
(function (root, factory) {
    if (typeof module === "object" && module.exports) {
        module.exports = factory();
    } else {
        root.OfferFormula = factory();
    }
})(
    typeof globalThis !== "undefined" ? globalThis : this,
    function () {
        "use strict";

        var BN_DIGITS = "০১২৩৪৫৬৭৮৯";

        function normalizeDigits(value) {
            return String(value == null ? "" : value).replace(/[০-৯]/g, function (d) {
                return String(BN_DIGITS.indexOf(d));
            });
        }

        function FormulaError(code) {
            this.code = code;
        }

        function fail(code) {
            throw new FormulaError(code);
        }

        function errorText(err) {
            if (err instanceof FormulaError) return err.code;
            return "#ERROR!";
        }

        /* ---------- cell references ---------- */

        function parseRef(ref) {
            var m = /^\$?([A-Za-z]{1,3})\$?([0-9]+)$/.exec(String(ref || "").trim());
            if (!m) return null;

            var letters = m[1].toUpperCase();
            var col = 0;
            for (var i = 0; i < letters.length; i++) {
                col = col * 26 + (letters.charCodeAt(i) - 64);
            }

            return { r: parseInt(m[2], 10) - 1, c: col - 1 };
        }

        /* ---------- value coercion ---------- */

        function toNumber(value) {
            if (typeof value === "number") {
                return isFinite(value) ? value : null;
            }
            if (typeof value === "boolean") {
                return value ? 1 : 0;
            }
            if (value === null || value === undefined) return null;

            var s = normalizeDigits(String(value)).trim();
            if (!s) return null;

            var negative = false;
            if (/^\(.*\)$/.test(s)) {
                negative = true;
                s = s.slice(1, -1);
            }

            var percent = /%$/.test(s);
            s = s.replace(/[৳$€,\s]/g, "").replace(/%$/, "");

            if (!/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(s)) return null;
            var n = Number(s);
            if (!isFinite(n)) return null;
            if (percent) n = n / 100;
            return negative ? -n : n;
        }

        function opNumber(value) {
            if (value === "" || value === null || value === undefined) return 0;
            var n = toNumber(value);
            if (n === null) fail("#VALUE!");
            return n;
        }

        function toText(value) {
            if (value === null || value === undefined) return "";
            if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
            return String(value);
        }

        function truthy(value) {
            if (typeof value === "boolean") return value;
            if (typeof value === "number") return value !== 0;
            var s = String(value == null ? "" : value).trim().toUpperCase();
            return s !== "" && s !== "FALSE" && s !== "0";
        }

        /* ---------- tokenizer ---------- */

        function tokenize(source) {
            var s = normalizeDigits(source);
            var tokens = [];
            var i = 0;

            while (i < s.length) {
                var ch = s[i];

                if (/\s/.test(ch)) {
                    i++;
                    continue;
                }

                if (ch === '"' || ch === "'") {
                    var quote = ch;
                    var text = "";
                    var j = i + 1;
                    var closed = false;
                    while (j < s.length) {
                        if (s[j] === quote) {
                            if (s[j + 1] === quote) {
                                text += quote;
                                j += 2;
                                continue;
                            }
                            closed = true;
                            break;
                        }
                        text += s[j];
                        j++;
                    }
                    if (!closed) fail("#SYNTAX!");
                    tokens.push({ t: "str", v: text });
                    i = j + 1;
                    continue;
                }

                if (/[0-9.]/.test(ch)) {
                    var num = /^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/.exec(s.slice(i));
                    if (!num) fail("#SYNTAX!");
                    tokens.push({ t: "num", v: parseFloat(num[0]) });
                    i += num[0].length;
                    continue;
                }

                if (/[A-Za-z_$]/.test(ch)) {
                    var ref = /^\$?[A-Za-z]{1,3}\$?[0-9]+/.exec(s.slice(i));
                    if (ref) {
                        var next = s[i + ref[0].length];
                        if (!next || !/[A-Za-z0-9_]/.test(next)) {
                            tokens.push({ t: "ref", v: ref[0] });
                            i += ref[0].length;
                            continue;
                        }
                    }

                    var id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(s.slice(i));
                    tokens.push({ t: "id", v: id[0].toUpperCase() });
                    i += id[0].length;
                    continue;
                }

                var two = s.substr(i, 2);
                if (two === "<=" || two === ">=" || two === "<>") {
                    tokens.push({ t: "op", v: two });
                    i += 2;
                    continue;
                }

                if ("+-*/^%&(),:<>=".indexOf(ch) !== -1) {
                    tokens.push({ t: "op", v: ch });
                    i++;
                    continue;
                }

                if (ch === ";") {
                    tokens.push({ t: "op", v: "," });
                    i++;
                    continue;
                }

                fail("#SYNTAX!");
            }

            tokens.push({ t: "end" });
            return tokens;
        }

        /* ---------- functions ---------- */

        function rangeValues(range, ctx) {
            var a = parseRef(range[0]);
            var b = parseRef(range[1]);
            if (!a || !b) fail("#REF!");

            var r1 = Math.min(a.r, b.r);
            var r2 = Math.max(a.r, b.r);
            var c1 = Math.min(a.c, b.c);
            var c2 = Math.max(a.c, b.c);

            if ((r2 - r1 + 1) * (c2 - c1 + 1) > 5000) fail("#REF!");

            var out = [];
            for (var r = r1; r <= r2; r++) {
                for (var c = c1; c <= c2; c++) {
                    out.push(ctx.cellAt(r, c));
                }
            }
            return out;
        }

        function flatten(args, ctx) {
            var out = [];
            (args || []).forEach(function (arg) {
                if (arg && arg.__range) {
                    out = out.concat(rangeValues(arg.__range, ctx));
                } else {
                    out.push(arg);
                }
            });
            return out;
        }

        function numbers(args, ctx) {
            return flatten(args, ctx).map(function (v) {
                return toNumber(v);
            }).filter(function (n) {
                return n !== null;
            });
        }

        function compare(op, a, b) {
            if ((a && a.__range) || (b && b.__range)) fail("#VALUE!");

            var na = toNumber(a);
            var nb = toNumber(b);
            var numeric = na !== null && nb !== null;
            var x = numeric ? na : toText(a).trim().toLowerCase();
            var y = numeric ? nb : toText(b).trim().toLowerCase();

            if (op === "=") return x === y ? 1 : 0;
            if (op === "<>") return x !== y ? 1 : 0;
            if (op === "<") return x < y ? 1 : 0;
            if (op === ">") return x > y ? 1 : 0;
            if (op === "<=") return x <= y ? 1 : 0;
            if (op === ">=") return x >= y ? 1 : 0;
            fail("#SYNTAX!");
        }

        function callFunction(name, args, ctx) {
            var i;

            switch (name) {
                case "SUM": {
                    var sum = 0;
                    numbers(args, ctx).forEach(function (n) { sum += n; });
                    return sum;
                }
                case "AVG":
                case "AVERAGE": {
                    var avg = numbers(args, ctx);
                    if (!avg.length) fail("#DIV/0!");
                    return avg.reduce(function (a, b) { return a + b; }, 0) / avg.length;
                }
                case "MIN": {
                    var min = numbers(args, ctx);
                    return min.length ? Math.min.apply(null, min) : 0;
                }
                case "MAX": {
                    var max = numbers(args, ctx);
                    return max.length ? Math.max.apply(null, max) : 0;
                }
                case "COUNT": {
                    return numbers(args, ctx).length;
                }
                case "COUNTA": {
                    return flatten(args, ctx).filter(function (v) {
                        return v !== null && v !== undefined && String(v).trim() !== "";
                    }).length;
                }
                case "PRODUCT": {
                    var prod = numbers(args, ctx);
                    if (!prod.length) return 0;
                    return prod.reduce(function (a, b) { return a * b; }, 1);
                }
                case "ROUND": {
                    var digits = args.length > 1 ? opNumber(args[1]) : 0;
                    var factor = Math.pow(10, digits);
                    return Math.round(opNumber(args[0]) * factor) / factor;
                }
                case "ROUNDUP": {
                    var du = args.length > 1 ? opNumber(args[1]) : 0;
                    var fu = Math.pow(10, du);
                    return Math.ceil(opNumber(args[0]) * fu) / fu;
                }
                case "ROUNDDOWN": {
                    var dd = args.length > 1 ? opNumber(args[1]) : 0;
                    var fd = Math.pow(10, dd);
                    return Math.floor(opNumber(args[0]) * fd) / fd;
                }
                case "ABS":
                    return Math.abs(opNumber(args[0]));
                case "SQRT": {
                    var sq = opNumber(args[0]);
                    if (sq < 0) fail("#NUM!");
                    return Math.sqrt(sq);
                }
                case "POWER":
                    return Math.pow(opNumber(args[0]), opNumber(args[1]));
                case "MOD": {
                    var divisor = opNumber(args[1]);
                    if (divisor === 0) fail("#DIV/0!");
                    return opNumber(args[0]) % divisor;
                }
                case "INT":
                case "FLOOR":
                    return Math.floor(opNumber(args[0]));
                case "CEILING":
                    return Math.ceil(opNumber(args[0]));
                case "IF": {
                    if (args.length < 2) fail("#VALUE!");
                    return truthy(args[0]) ? args[1] : args[2];
                }
                case "AND": {
                    var all = flatten(args, ctx);
                    return all.every(truthy) ? 1 : 0;
                }
                case "OR": {
                    var any = flatten(args, ctx);
                    return any.some(truthy) ? 1 : 0;
                }
                case "NOT":
                    return truthy(args[0]) ? 0 : 1;
                case "CONCAT":
                case "CONCATENATE": {
                    return flatten(args, ctx).map(toText).join("");
                }
                case "LEN":
                    return toText(args[0]).length;
                case "UPPER":
                    return toText(args[0]).toUpperCase();
                case "LOWER":
                    return toText(args[0]).toLowerCase();
                case "TRIM":
                    return toText(args[0]).trim();
                case "TEXT":
                    return toText(args[0]);
                default:
                    fail("#NAME?");
            }
        }

        /* ---------- parser / evaluator ---------- */

        function evaluateFormula(source, ctx) {
            var tokens = tokenize(String(source || "").replace(/^=/, ""));
            var pos = 0;

            function peek() {
                return tokens[pos];
            }

            function eat() {
                return tokens[pos++];
            }

            function expectOp(value) {
                var tok = eat();
                if (tok.t !== "op" || tok.v !== value) fail("#SYNTAX!");
            }

            function parseComparison() {
                var left = parseConcat();
                while (peek().t === "op" && ["=", "<>", "<", ">", "<=", ">="].indexOf(peek().v) !== -1) {
                    var op = eat().v;
                    left = compare(op, left, parseConcat());
                }
                return left;
            }

            function parseConcat() {
                var left = parseAdd();
                while (peek().t === "op" && peek().v === "&") {
                    eat();
                    left = toText(left) + toText(parseAdd());
                }
                return left;
            }

            function parseAdd() {
                var left = parseMul();
                while (peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
                    var op = eat().v;
                    var right = parseMul();
                    left = op === "+"
                        ? opNumber(left) + opNumber(right)
                        : opNumber(left) - opNumber(right);
                }
                return left;
            }

            function parseMul() {
                var left = parsePow();
                while (peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
                    var op = eat().v;
                    var right = parsePow();
                    if (op === "*") {
                        left = opNumber(left) * opNumber(right);
                    } else {
                        var divisor = opNumber(right);
                        if (divisor === 0) fail("#DIV/0!");
                        left = opNumber(left) / divisor;
                    }
                }
                return left;
            }

            function parsePow() {
                var left = parseUnary();
                if (peek().t === "op" && peek().v === "^") {
                    eat();
                    left = Math.pow(opNumber(left), opNumber(parsePow()));
                }
                return left;
            }

            function parseUnary() {
                if (peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
                    var op = eat().v;
                    var value = opNumber(parseUnary());
                    return op === "-" ? -value : value;
                }
                return parsePostfix();
            }

            function parsePostfix() {
                var value = parsePrimary();
                while (peek().t === "op" && peek().v === "%") {
                    eat();
                    value = opNumber(value) / 100;
                }
                return value;
            }

            function parsePrimary() {
                var tok = eat();

                if (tok.t === "num") return tok.v;
                if (tok.t === "str") return tok.v;

                if (tok.t === "op" && tok.v === "(") {
                    var inner = parseComparison();
                    expectOp(")");
                    return inner;
                }

                if (tok.t === "ref") {
                    if (peek().t === "op" && peek().v === ":") {
                        eat();
                        var second = eat();
                        if (second.t !== "ref") fail("#REF!");
                        return { __range: [tok.v, second.v] };
                    }
                    var point = parseRef(tok.v);
                    return ctx.cellAt(point.r, point.c);
                }

                if (tok.t === "id") {
                    if (peek().t === "op" && peek().v === "(") {
                        eat();
                        var args = [];
                        if (!(peek().t === "op" && peek().v === ")")) {
                            while (true) {
                                args.push(parseComparison());
                                if (peek().t === "op" && peek().v === ",") {
                                    eat();
                                    continue;
                                }
                                break;
                            }
                        }
                        expectOp(")");
                        return callFunction(tok.v, args, ctx);
                    }
                    if (tok.v === "TRUE") return true;
                    if (tok.v === "FALSE") return false;
                    fail("#NAME?");
                }

                fail("#SYNTAX!");
            }

            var result = parseComparison();
            if (peek().t !== "end") fail("#SYNTAX!");
            if (result && result.__range) fail("#VALUE!");
            return result;
        }

        /* ---------- DOM helpers ---------- */

        function formatNumber(n) {
            if (!isFinite(n)) return "#DIV/0!";
            var rounded = Math.round(n * 1e6) / 1e6;
            return rounded.toLocaleString("en-US", {
                maximumFractionDigits: 2
            });
        }

        function formatValue(value) {
            if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
            if (typeof value === "number") return formatNumber(value);
            return toText(value);
        }

        function recalcTable(table) {
            if (!table || !table.querySelectorAll) return 0;

            var rows = [];
            Array.prototype.forEach.call(table.querySelectorAll("tr"), function (tr) {
                var cells = [];
                Array.prototype.forEach.call(tr.children, function (cell) {
                    if (cell.tagName === "TD" || cell.tagName === "TH") cells.push(cell);
                });
                rows.push(cells);
            });

            if (!rows.length) return 0;

            var states = new Map();

            function cellAt(r, c) {
                return rows[r] && rows[r][c] ? rows[r][c] : null;
            }

            function valueOfCell(cell) {
                if (!cell) return "";

                var state = states.get(cell);
                if (!state) {
                    var raw = String(cell.textContent || "").trim();
                    var formula = cell.getAttribute("data-formula");

                    if (formula) {
                        formula = formula.replace(/^=/, "");
                    } else if (raw.charAt(0) === "=") {
                        formula = raw.replace(/^=/, "");
                        cell.setAttribute("data-formula", "=" + formula);
                    }

                    state = {
                        formula: formula || "",
                        status: 0,
                        result: formula ? null : raw,
                        error: ""
                    };
                    states.set(cell, state);
                }

                if (!state.formula) return state.result;

                if (state.status === 1) fail("#CIRC!");
                if (state.status === 2) {
                    if (state.error) fail(state.error);
                    return state.result;
                }

                state.status = 1;
                try {
                    state.result = evaluateFormula(state.formula, {
                        cellAt: function (r, c) {
                            return valueOfCell(cellAt(r, c));
                        }
                    });
                    state.status = 2;
                } catch (err) {
                    state.status = 2;
                    state.error = errorText(err);
                    throw err;
                }

                return state.result;
            }

            var count = 0;
            rows.forEach(function (row, r) {
                row.forEach(function (cell, c) {
                    if (cell.hasAttribute("data-formula") || String(cell.textContent || "").trim().charAt(0) === "=") {
                        count++;
                        cell.classList.add("formula-cell");
                        cell.title = cell.getAttribute("data-formula") || String(cell.textContent || "").trim();

                        try {
                            var value = valueOfCell(cell);
                            cell.textContent = formatValue(value);
                        } catch (err) {
                            cell.textContent = errorText(err);
                        }
                    } else if (cell.classList.contains("formula-cell")) {
                        cell.classList.remove("formula-cell");
                        cell.removeAttribute("title");
                    }
                });
            });

            // Force evaluation of formula cells that were skipped above
            rows.forEach(function (row) {
                row.forEach(function (cell) {
                    if (!cell.hasAttribute("data-formula")) return;
                    try {
                        var state = states.get(cell);
                        if (state && state.status !== 2) {
                            var val = valueOfCell(cell);
                            cell.textContent = formatValue(val);
                        }
                    } catch (err) {
                        cell.textContent = errorText(err);
                    }
                });
            });

            return count;
        }

        function recalcTables(container) {
            if (!container || !container.querySelectorAll) return 0;
            var total = 0;
            Array.prototype.forEach.call(container.querySelectorAll("table"), function (table) {
                total += recalcTable(table);
            });
            return total;
        }

        function currentCell(editor) {
            if (!editor) return null;
            var sel = window.getSelection ? window.getSelection() : null;
            if (!sel || !sel.anchorNode) return null;
            var node = sel.anchorNode;
            if (!editor.contains(node)) return null;
            var el = node.nodeType === 1 ? node : node.parentElement;
            return el && el.closest ? el.closest("td,th") : null;
        }

        function setCellFormula(cell, formula) {
            if (!cell) return;
            var value = String(formula || "").trim();
            if (!value) {
                cell.removeAttribute("data-formula");
                cell.classList.remove("formula-cell");
                return;
            }
            if (value.charAt(0) !== "=") value = "=" + value;
            cell.setAttribute("data-formula", value);
            cell.textContent = value;
            cell.classList.add("formula-cell");
        }

        return {
            evaluate: function (formula, table) {
                var rows = [];
                if (table) {
                    Array.prototype.forEach.call(table.querySelectorAll("tr"), function (tr) {
                        var cells = [];
                        Array.prototype.forEach.call(tr.children, function (cell) {
                            if (cell.tagName === "TD" || cell.tagName === "TH") {
                                cells.push(String(cell.textContent || "").trim());
                            }
                        });
                        rows.push(cells);
                    });
                }
                return evaluateFormula(formula, {
                    cellAt: function (r, c) {
                        return rows[r] && rows[r][c] ? rows[r][c] : "";
                    }
                });
            },
            recalcTable: recalcTable,
            recalcTables: recalcTables,
            currentCell: currentCell,
            setCellFormula: setCellFormula,
            parseRef: parseRef,
            toNumber: toNumber
        };
    }
);
