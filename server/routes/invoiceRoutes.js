const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../public/temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Upload PDF (Base64)
router.post('/upload', async (req, res) => {
    try {
        const { pdfBase64, filename } = req.body;
        
        if (!pdfBase64) {
            return res.status(400).json({ success: false, message: 'No PDF data provided' });
        }

        // Clean up base64 string
        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate unique filename if not provided
        const uniqueName = `${crypto.randomBytes(8).toString('hex')}-${filename || 'invoice.pdf'}`;
        const filePath = path.join(tempDir, uniqueName);

        // Write file
        fs.writeFileSync(filePath, buffer);

        // Return public URL (assuming the server is hosted at a domain)
        // In a real app, this would be env.PUBLIC_URL
        const protocol = req.protocol;
        const host = req.get('host');
        const publicUrl = `${protocol}://${host}/temp/${uniqueName}`;

        res.status(200).json({
            success: true,
            url: publicUrl,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
        });

        // Optional: Simple cleanup logic (delete older files)
        // In a real app, use a cron job or a more robust storage
    } catch (err) {
        console.error('Invoice upload error:', err);
        res.status(500).json({ success: false, message: 'Server error during upload' });
    }
});

module.exports = router;
