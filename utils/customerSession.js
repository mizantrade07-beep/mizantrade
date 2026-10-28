/* Shared customer session helpers. */

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((err) => (err ? reject(err) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((err) => (err ? reject(err) : resolve()));
    });
}

function setCustomerSession(req, customer) {
    req.session.customer = {
        id: customer._id.toString(),
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || ""
    };
}

module.exports = { regenerateSession, saveSession, setCustomerSession };
