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

    function selectedPaymentMethod() {
        var checked = document.querySelector('input[name="paymentMethod"]:checked');
        return checked ? checked.value : "";
    }

    function updateCheckoutTotals() {
        if (!citySelect || !shippingEl || !totalEl) return;

        var subtotal = subtotalEl ? parseFloat(subtotalEl.dataset.value || "0") : 0;
        var shipping = citySelect.value === "dhaka"
            ? parseFloat(citySelect.dataset.inside || "60")
            : parseFloat(citySelect.dataset.outside || "120");
        var discount = parseFloat(totalEl.dataset.discount || "0");

        var baseTotal = Math.max(0, subtotal + shipping - discount);

        var charge = 0;
        if (chargeEl) {
            var percent = parseFloat(chargeEl.dataset.percent || "0");
            if (selectedPaymentMethod() === "bkash") {
                charge = Math.round(baseTotal * percent) / 100;
            }
            chargeEl.innerText = "৳ " + charge.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        }
        if (chargeRow) {
            chargeRow.style.display = charge > 0 ? "" : "none";
        }

        shippingEl.innerText = "৳ " + shipping.toLocaleString("en-US");
        var total = Math.round((baseTotal + charge) * 100) / 100;
        totalEl.innerText = "৳ " + total.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    if (citySelect) {
        citySelect.addEventListener("change", updateCheckoutTotals);
    }

    document.querySelectorAll('input[name="paymentMethod"]').forEach(function (radio) {
        radio.addEventListener("change", updateCheckoutTotals);
    });

    if (citySelect) {
        updateCheckoutTotals();
    }

});
