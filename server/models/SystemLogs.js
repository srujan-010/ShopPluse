const mongoose = require('mongoose');

const systemLogsSchema = new mongoose.Schema({
    logType: {
        type: String,
        enum: ['API', 'Database', 'Sync', 'Error', 'Security'],
        default: 'API'
    },
    severity: {
        type: String,
        enum: ['Healthy', 'Warning', 'Critical'],
        default: 'Healthy'
    },
    message: {
        type: String,
        required: true
    },
    details: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SystemLogs', systemLogsSchema);
