const mongoose = require('mongoose');

const partnerSchema = new mongoose.Schema({
    companyName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, trim: true, default: '' },
    tradeLicense: { type: String, trim: true, default: '' },
    businessDetails: { type: String, required: true },

    documents: [{
        originalName: { type: String, default: '' },
        filename: { type: String, required: true },
        _id: false
    }],

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },

    adminNote: { type: String, trim: true, default: '' },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PartnerRequest', partnerSchema);
