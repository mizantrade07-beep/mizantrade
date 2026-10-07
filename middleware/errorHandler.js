const notFoundHandler = (req, res) => {
    res.status(404).render("errors/404", {
        pageTitle: "Page Not Found"
    });
};

const errorHandler = (err, req, res, next) => {
    console.error("Application Error:");
    console.error(err);

    const statusCode = err.statusCode || 500;

    res.status(statusCode).render("errors/500", {
        pageTitle: "Server Error",
        error:
            process.env.NODE_ENV === "development"
                ? err
                : null
    });
};

module.exports = {
    notFoundHandler,
    errorHandler
};