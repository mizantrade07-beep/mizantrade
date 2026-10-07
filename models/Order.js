const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },

    title: {
        type: String,
        required: true
    },

    slug: {
        type: String,
        default: ""
    },

    image: {
        type: String,
        default: ""
    },

    price: {
        type: Number,
        required: true
    },

    quantity: {
        type: Number,
        required: true,
        min: 1
    }
}, {
    _id: false
});

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },

    // লগইন করা কাস্টমার অ্যাকাউন্টের সাথে যোগ (গেস্ট অর্ডারে null)
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null,
        index: true
    },

    items: [orderItemSchema],

    customer: {
        name: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            trim: true,
            default: ""
        },

        address: {
            type: String,
            required: true,
            trim: true
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        note: {
            type: String,
            trim: true,
            default: ""
        }
    },

    paymentMethod: {
        type: String,
        enum: ["bkash", "cod", "bank"],
        required: true
    },

    paymentInfo: {
        trxId: {
            type: String,
            trim: true,
            default: ""
        },

        senderNumber: {
            type: String,
            trim: true,
            default: ""
        },

        bankName: {
            type: String,
            trim: true,
            default: ""
        },

        accountNumber: {
            type: String,
            trim: true,
            default: ""
        }
    },

    subtotal: {
        type: Number,
        required: true
    },

    shippingFee: {
        type: Number,
        required: true,
        default: 0
    },

    couponCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: ""
    },

    discount: {
        type: Number,
        default: 0,
        min: 0
    },

    paymentCharge: {
        type: Number,
        default: 0,
        min: 0
    },

    total: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: [
            "Pending",
            "Confirmed",
            "Processing",
            "Shipped",
            "Delivered",
            "Cancelled"
        ],
        default: "Pending"
    }
}, {
    timestamps: true
});

// অ্যানালিটিক্স ও লিস্টিং কুয়েরির জন্য ইনডেক্স
orderSchema.index({ createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentMethod: 1 });
orderSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
