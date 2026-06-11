const IdempotencyKey = require('../models/IdempotencyKey');

exports.idempotency = async (req, res, next) => {
    // Only check write mutations (POST)
    // We restrict this primarily to POST as requested, since PUT/DELETE are generally idempotent by nature,
    // but the global key generation covers them if needed. Let's do it for POST requests.
    if (req.method !== 'POST') {
        return next();
    }

    // Retrieve the idempotency key from headers or request body/query
    const key = req.headers['x-idempotency-key'] || 
                req.headers['x-request-id'] || 
                req.body?.idempotencyKey || 
                req.body?.requestId || 
                req.body?.transactionToken;

    if (!key) {
        return next();
    }

    try {
        // Try to insert the lock record atomically
        await IdempotencyKey.create({ key, status: 'processing' });

        // If creation succeeds, it is a new request.
        // Intercept res.json to capture response body and status when route handler completes
        const originalJson = res.json;
        res.json = function (body) {
            // Restore original res.json
            res.json = originalJson;

            // Update record to completed in background
            IdempotencyKey.updateOne(
                { key },
                {
                    status: 'completed',
                    responseStatus: res.statusCode,
                    responseBody: body
                }
            ).catch(err => console.error('Failed to cache idempotency response:', err));

            return originalJson.call(this, body);
        };

        next();
    } catch (error) {
        // If it's a duplicate key error, a request with this key is already in progress or completed
        if (error.code === 11000) {
            try {
                const record = await IdempotencyKey.findOne({ key });
                if (record) {
                    if (record.status === 'processing') {
                        return res.status(409).json({
                            success: false,
                            message: 'Duplicate request is already processing. Please wait.'
                        });
                    } else {
                        // Return cached response
                        return res.status(record.responseStatus || 200).json(record.responseBody);
                    }
                }
            } catch (findErr) {
                console.error('Error fetching existing idempotency record:', findErr);
            }
        } else {
            console.error('Idempotency middleware database error:', error);
        }
        next();
    }
};
