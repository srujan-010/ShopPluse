const errorHandler = (err, req, res, next) => {
    // Log to console for dev
    console.error('ERROR LOG:', {
        name: err.name,
        message: err.message,
        code: err.code,
        stack: err.stack
    });

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Server Error';

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        message = `Resource not found`;
        statusCode = 404;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        message = 'Email already exists. Please use a different email.';
        statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        message = Object.values(err.errors).map(val => val.message).join(', ');
        statusCode = 400;
    }

    res.status(statusCode).json({
        success: false,
        message: message
    });
};

module.exports = errorHandler;
