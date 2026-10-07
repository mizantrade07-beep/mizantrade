const Product = require("../models/Product");

/* ======================================================
   HELPERS
====================================================== */

function getEffectivePrice(product) {
    if (product.callForPrice) return null;
    if (product.salePrice) return product.salePrice;
    if (product.regularPrice) return product.regularPrice;
    return null;
}

function getCart(req) {
    if (!req.session.cart) {
        req.session.cart = { items: [] };
    }
    return req.session.cart;
}

function getCartTotals(cart) {
    const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
    );

    const count = cart.items.reduce(
        (sum, item) => sum + item.quantity,
        0
    );

    return { subtotal, count };
}

function wantsJson(req) {
    return Boolean(
        req.headers.accept &&
        req.headers.accept.includes("application/json")
    ) || req.xhr;
}

/* ======================================================
   CART PAGES & ACTIONS
====================================================== */

exports.getCart = (req, res) => {
    const cart = getCart(req);
    const { subtotal } = getCartTotals(cart);

    res.render("cart", {
        pageTitle: "Shopping Cart",
        items: cart.items,
        subtotal
    });
};

exports.addToCart = async (req, res) => {
    try {
        const productId = req.body.productId || req.params.id;
        const quantity = Math.max(1, Number(req.body.quantity) || 1);

        const product = await Product.findById(productId);

        if (!product || !product.isActive) {
            if (wantsJson(req)) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found."
                });
            }

            return res.redirect("/shop");
        }

        const price = getEffectivePrice(product);

        if (price === null) {
            if (wantsJson(req)) {
                return res.status(400).json({
                    success: false,
                    message: "Please call us for this product."
                });
            }

            return res.redirect("/product/" + product.slug);
        }

        const cart = getCart(req);

        const existing = cart.items.find(
            (item) => String(item.productId) === String(product._id)
        );

        if (existing) {
            existing.quantity += quantity;
        } else {
            cart.items.push({
                productId: String(product._id),
                title: product.title,
                slug: product.slug,
                image: product.mainImage || "",
                price,
                quantity
            });
        }

        const { count } = getCartTotals(cart);

        if (wantsJson(req)) {
            return res.json({
                success: true,
                message: "Product has been added to the cart.",
                cartCount: count
            });
        }

        return res.redirect("/cart");
    } catch (error) {
        console.error("Add to cart error:", error);
        return res.status(500).send("Server Error");
    }
};

exports.updateCart = (req, res) => {
    const cart = getCart(req);
    const { productId, quantity } = req.body;

    const item = cart.items.find(
        (i) => String(i.productId) === String(productId)
    );

    if (item) {
        const qty = Number(quantity);

        if (qty > 0) {
            item.quantity = qty;
        } else {
            cart.items = cart.items.filter(
                (i) => String(i.productId) !== String(productId)
            );
        }
    }

    return res.redirect("/cart");
};

exports.removeFromCart = (req, res) => {
    const cart = getCart(req);
    const productId = req.body.productId || req.params.id;

    cart.items = cart.items.filter(
        (item) => String(item.productId) !== String(productId)
    );

    if (wantsJson(req)) {
        const { count } = getCartTotals(cart);

        return res.json({
            success: true,
            cartCount: count
        });
    }

    return res.redirect("/cart");
};

exports.clearCart = (req, res) => {
    req.session.cart = { items: [] };
    return res.redirect("/cart");
};

exports.getUserCounts = (req, res) => {
    const cart = getCart(req);
    const { count } = getCartTotals(cart);

    res.json({
        cartCount: count,
        wishlistCount: req.session.wishlist
            ? req.session.wishlist.length
            : 0
    });
};

/* ======================================================
   WISHLIST
====================================================== */

exports.getWishlist = async (req, res) => {
    const ids = req.session.wishlist || [];

    let products = [];

    if (ids.length > 0) {
        products = await Product.find({
            _id: { $in: ids },
            isActive: true
        }).lean();
    }

    res.render("wishlist", {
        pageTitle: "Wishlist",
        products
    });
};

exports.addToWishlist = async (req, res) => {
    const productId = req.body.productId || req.params.id;

    if (!req.session.wishlist) {
        req.session.wishlist = [];
    }

    if (!req.session.wishlist.includes(String(productId))) {
        req.session.wishlist.push(String(productId));
    }

    if (wantsJson(req)) {
        return res.json({
            success: true,
            message: "Product has been added to the wishlist.",
            wishlistCount: req.session.wishlist.length
        });
    }

    return res.redirect("/wishlist");
};

exports.removeFromWishlist = (req, res) => {
    const productId = req.body.productId || req.params.id;

    req.session.wishlist = (req.session.wishlist || []).filter(
        (id) => String(id) !== String(productId)
    );

    if (wantsJson(req)) {
        return res.json({
            success: true,
            wishlistCount: req.session.wishlist.length
        });
    }

    return res.redirect("/wishlist");
};