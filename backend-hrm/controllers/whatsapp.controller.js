const whatsappService = require('../services/whatsappService');

/**
 * Get WhatsApp Connection Status & Preferences
 */
exports.getStatus = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing from request.' });
        }

        const data = await whatsappService.getStatus(companyId);
        return res.json(data);
    } catch (err) {
        console.error('Error fetching WhatsApp status:', err);
        return res.status(500).json({ message: 'Failed to get WhatsApp status', error: err.message });
    }
};

/**
 * Initiate WhatsApp Connection (QR Code generation)
 */
exports.connect = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing from request.' });
        }

        const { phoneNumber, usePairingCode } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ message: 'Please provide a valid WhatsApp phone number.' });
        }

        const normalized = whatsappService.normalizePhoneNumber(phoneNumber);
        if (!normalized) {
            return res.status(400).json({ message: 'Invalid phone number format. Please include country code without symbols.' });
        }

        const result = await whatsappService.connect(companyId, normalized, !!usePairingCode);
        return res.json(result);
    } catch (err) {
        console.error('Error connecting WhatsApp:', err);
        return res.status(500).json({ message: 'Failed to start WhatsApp connection', error: err.message });
    }
};

/**
 * Disconnect WhatsApp Connection
 */
exports.disconnect = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing from request.' });
        }

        const result = await whatsappService.disconnect(companyId);
        return res.json(result);
    } catch (err) {
        console.error('Error disconnecting WhatsApp:', err);
        return res.status(500).json({ message: 'Failed to disconnect WhatsApp', error: err.message });
    }
};

/**
 * Update Notification Preferences
 */
exports.updatePreferences = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing from request.' });
        }

        const result = await whatsappService.updatePreferences(companyId, req.body);
        return res.json(result);
    } catch (err) {
        console.error('Error updating WhatsApp preferences:', err);
        return res.status(500).json({ message: 'Failed to update preferences', error: err.message });
    }
};

/**
 * Get WhatsApp Delivery Logs
 */
exports.getLogs = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing from request.' });
        }

        const limit = req.query.limit || 50;
        const logs = await whatsappService.getLogs(companyId, limit);
        return res.json(logs);
    } catch (err) {
        console.error('Error fetching WhatsApp logs:', err);
        return res.status(500).json({ message: 'Failed to fetch delivery logs', error: err.message });
    }
};

/**
 * Send Test WhatsApp Message
 */
exports.sendTestMessage = async (req, res) => {
    try {
        const companyId = req.user.company_id;
        if (!companyId) {
            return res.status(400).json({ message: 'Company context missing from request.' });
        }

        const { recipientPhone, message } = req.body;
        if (!recipientPhone) {
            return res.status(400).json({ message: 'Recipient phone number is required.' });
        }

        const companyName = await whatsappService.getCompanyName(companyId);
        const testText = message || `*${companyName}*\n\n✅ *WhatsApp Connectivity Test*\n\nYour WhatsApp notifications are successfully configured and working.\n\n_Sent from Nexus HRM Pro._`;

        const result = await whatsappService.sendMessage(companyId, recipientPhone, testText, {
            recipientName: req.user.name || 'Admin',
            recipientRole: 'admin',
            eventType: 'TEST_MESSAGE'
        });

        if (result.success) {
            return res.json({ success: true, message: 'Test message sent successfully!' });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: result.reason || result.error || 'Failed to send test message. Check your WhatsApp connection status.' 
            });
        }
    } catch (err) {
        console.error('Error sending test WhatsApp message:', err);
        return res.status(500).json({ message: 'Failed to send test message', error: err.message });
    }
};
