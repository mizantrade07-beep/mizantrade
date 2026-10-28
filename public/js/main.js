/* ==========================================================
   MIZAN TRADE - MAIN JS
========================================================== */

document.addEventListener("DOMContentLoaded", function () {

    /* --------------------------------------------------
       ১. স্ক্রল করলে টপ হেডার সিলকিভাবে হাইড হবে
          (লোগো + ক্যাটাগরি মেনু স্টিকি থাকবে)
    -------------------------------------------------- */
    var topHeader = document.getElementById("topHeader");

    if (topHeader) {
        var lastScroll = 0;

        window.addEventListener("scroll", function () {
            var y = window.scrollY;

            if (y > 60) {
                topHeader.classList.add("hide-on-scroll");
            } else {
                topHeader.classList.remove("hide-on-scroll");
            }

            lastScroll = y;
        }, { passive: true });
    }


    /* --------------------------------------------------
       ২. মোবাইল মেনু টগল
    -------------------------------------------------- */
    var menuBtn = document.getElementById("mobileMenuBtn");
    var mobileNav = document.getElementById("mobileNav");

    if (menuBtn && mobileNav) {
        menuBtn.addEventListener("click", function () {
            mobileNav.classList.toggle("open");
        });
    }


    /* --------------------------------------------------
       ৩. কার্ট/উইশলিস্ট ব্যাজ কাউন্ট লোড
    -------------------------------------------------- */
    function setAll(selector, value) {
        document.querySelectorAll(selector).forEach(function (el) {
            el.innerText = value;
        });
    }

    function refreshCounts() {
        fetch("/api/user-counts")
            .then(function (r) { return r.json(); })
            .then(function (data) {
                setAll(".js-cart-count", data.cartCount);
                setAll(".js-wish-count", data.wishlistCount);
                setAll(".js-compare-count", data.compareCount);
            })
            .catch(function () { /* ignore */ });
    }

    refreshCounts();


    /* --------------------------------------------------
       ৪. AJAX Add to Cart (পেজ রিলোড ছাড়াই)
    -------------------------------------------------- */
    document.querySelectorAll(".js-add-cart").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
            e.preventDefault();

            var form = btn.closest("form");
            var id = btn.dataset.id;

            btn.disabled = true;

            fetch("/cart/add/" + id, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ productId: id, quantity: 1 })
            })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success) {
                        setAll(".js-cart-count", data.cartCount);

                        showToast(data.message || "Product added to cart.");
                    } else {
                        showToast(data.message || "Could not add to cart.", true);
                    }
                })
                .catch(function () {
                    if (form) form.submit();
                })
                .finally(function () {
                    btn.disabled = false;
                });
        });
    });


    /* --------------------------------------------------
       ৪.১ কম্পেয়ার বাটন — AJAX (পেজ রিলোড ছাড়াই)
    -------------------------------------------------- */
    document.addEventListener("click", function (e) {
        var btn = e.target.closest(".js-compare");

        if (!btn) return;

        e.preventDefault();

        var id = btn.dataset.id;

        fetch("/compare/add/" + id, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ productId: id })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                showToast(data.message || "Compare list updated.", !data.success);
            })
            .catch(function () {
                window.location.href = btn.getAttribute("href");
            });
    });


    /* --------------------------------------------------
       ৫. টোস্ট মেসেজ
    -------------------------------------------------- */
    function showToast(message, isError) {
        var toast = document.createElement("div");

        toast.innerText = message;
        toast.style.cssText =
            "position:fixed;bottom:24px;right:24px;z-index:9999;" +
            "background:" + (isError ? "#c0392b" : "#081621") + ";color:#fff;" +
            "padding:13px 22px;border-radius:6px;font-size:13.5px;font-weight:600;" +
            "box-shadow:0 8px 24px rgba(0,0,0,0.25);opacity:0;transform:translateY(12px);" +
            "transition:0.3s;border-left:4px solid #ef4a23;";

        document.body.appendChild(toast);

        requestAnimationFrame(function () {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        });

        setTimeout(function () {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(12px)";
            setTimeout(function () { toast.remove(); }, 350);
        }, 2600);
    }


    /* --------------------------------------------------
       ৬. হোমপেজ হিরো স্লাইডার
    -------------------------------------------------- */
    var slides = document.querySelectorAll(".hero-slide");
    var dots = document.querySelectorAll(".hero-dot");

    if (slides.length > 1) {
        var current = 0;

        function showSlide(index) {
            slides.forEach(function (s) { s.classList.remove("active"); });
            dots.forEach(function (d) { d.classList.remove("active"); });

            slides[index].classList.add("active");
            if (dots[index]) dots[index].classList.add("active");
        }

        dots.forEach(function (dot, i) {
            dot.addEventListener("click", function () {
                current = i;
                showSlide(current);
            });
        });

        setInterval(function () {
            current = (current + 1) % slides.length;
            showSlide(current);
        }, 5000);
    }


    /* --------------------------------------------------
       ৭. চেকআউট পেজ: পেমেন্ট মেথড সিলেক্ট + টোটাল
    -------------------------------------------------- */
    var paymentOptions = document.querySelectorAll(".payment-option");

    function syncPaymentInputs() {
        paymentOptions.forEach(function (option) {
            var isSelected = option.classList.contains("selected");

            option.querySelectorAll('input[type="text"], input[type="tel"]').forEach(function (input) {
                input.disabled = !isSelected;
            });
        });
    }

    paymentOptions.forEach(function (option) {
        var radio = option.querySelector('input[type="radio"]');

        option.addEventListener("click", function (e) {
            if (e.target.tagName !== "INPUT") {
                radio.checked = true;
            }

            paymentOptions.forEach(function (o) { o.classList.remove("selected"); });
            option.classList.add("selected");

            syncPaymentInputs();
        });
    });

    syncPaymentInputs();

    var citySelect = document.getElementById("citySelect");
    var subtotalEl = document.getElementById("summarySubtotal");
    var shippingEl = document.getElementById("summaryShipping");
    var totalEl = document.getElementById("summaryTotal");
    var chargeEl = document.getElementById("summaryCharge");
    var chargeRow = document.getElementById("summaryChargeRow");

    function selectedPaymentOption() {
        var checked = document.querySelector('input[name="paymentMethod"]:checked');
        return checked ? checked.closest(".payment-option") : null;
    }

    var checkoutSummary = document.getElementById("checkoutSummary");
    var useRewards = document.getElementById("useRewards");
    var rewardRow = document.getElementById("summaryRewardRow");
    var rewardAmountEl = document.getElementById("summaryReward");
    var rewardPointsEl = document.getElementById("summaryRewardPoints");
    var taxRow = document.getElementById("summaryTaxRow");
    var taxEl = document.getElementById("summaryTax");

    function summaryData() {
        var d = checkoutSummary ? checkoutSummary.dataset : {};
        return {
            rewardEnabled: d.rewardEnabled === "1",
            balance: parseFloat(d.rewardBalance || "0"),
            minRedeem: parseFloat(d.rewardMin || "0"),
            pointValue: parseFloat(d.rewardPointValue || "0"),
            taxEnabled: d.taxEnabled === "1",
            taxPercent: parseFloat(d.taxPercent || "0"),
            taxInclusive: d.taxInclusive === "1",
            taxShipping: d.taxShipping === "1",
            freeShipping: parseFloat(d.freeShipping || "0")
        };
    }

    function money(n) {
        return "৳ " + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    function updateCheckoutTotals() {
        if (!citySelect || !shippingEl || !totalEl) return;

        var data = summaryData();
        var subtotal = subtotalEl ? parseFloat(subtotalEl.dataset.value || "0") : 0;
        var shipping = citySelect.selectedOptions.length
            ? parseFloat(citySelect.selectedOptions[0].dataset.charge || "0")
            : 0;

        if (data.freeShipping > 0 && subtotal >= data.freeShipping) shipping = 0;

        var discount = parseFloat(totalEl.dataset.discount || "0");
        var payableBefore = Math.max(0, subtotal + shipping - discount);

        /* Reward points */
        var rewardPoints = 0;
        var rewardDiscount = 0;
        if (
            useRewards &&
            useRewards.checked &&
            data.rewardEnabled &&
            data.pointValue > 0 &&
            data.balance >= data.minRedeem
        ) {
            rewardPoints = Math.min(
                data.balance,
                Math.floor(payableBefore / data.pointValue)
            );
            rewardDiscount = Math.round(rewardPoints * data.pointValue * 100) / 100;
        }

        /* Tax / VAT */
        var taxAmount = 0;
        var taxAdded = 0;
        if (data.taxEnabled && data.taxPercent > 0) {
            var taxBase = Math.max(
                0,
                subtotal - discount + (data.taxShipping ? shipping : 0)
            );
            taxAmount = Math.round(taxBase * data.taxPercent) / 100;
            taxAdded = data.taxInclusive ? 0 : taxAmount;
        }

        var baseTotal = Math.max(0, payableBefore - rewardDiscount + taxAdded);

        var option = selectedPaymentOption();
        var percent = option ? parseFloat(option.dataset.chargePercent || "0") : 0;
        var charge = Math.round(baseTotal * percent) / 100;

        if (chargeEl) {
            chargeEl.dataset.percent = percent;
            chargeEl.innerText = money(charge);
        }

        var labelEl = document.getElementById("chargeMethodLabel");
        var pctEl = document.getElementById("chargePercentLabel");
        if (labelEl) labelEl.textContent = (option && option.dataset.chargeLabel) || "Payment";
        if (pctEl) pctEl.textContent = percent;

        if (chargeRow) {
            chargeRow.style.display = charge > 0 ? "" : "none";
        }

        if (rewardRow) {
            rewardRow.style.display = rewardDiscount > 0 ? "" : "none";
        }
        if (rewardAmountEl) {
            rewardAmountEl.innerText = rewardDiscount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }
        if (rewardPointsEl) {
            rewardPointsEl.innerText = rewardPoints.toLocaleString("en-US");
        }

        if (taxRow) {
            taxRow.style.display = taxAmount > 0 ? "" : "none";
        }
        if (taxEl) {
            taxEl.innerText = money(taxAmount);
        }

        shippingEl.innerText = money(shipping);
        var total = Math.round((baseTotal + charge) * 100) / 100;
        totalEl.innerText = money(total);
    }

    if (citySelect) {
        citySelect.addEventListener("change", updateCheckoutTotals);
    }

    document.querySelectorAll('input[name="paymentMethod"]').forEach(function (radio) {
        radio.addEventListener("change", updateCheckoutTotals);
    });

    if (useRewards) {
        useRewards.addEventListener("change", updateCheckoutTotals);
    }

    if (citySelect) {
        updateCheckoutTotals();
    }

});
