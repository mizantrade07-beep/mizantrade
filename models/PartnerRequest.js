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
        label: { type: String, default: '' },
        originalName: { type: String, default: '' },
        filename: { type: String, default: '' },
        url: { type: String, default: '' },
        localPath: { type: String, default: '' },
        mimeType: { type: String, default: '' },
        size: { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
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
