const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const { adminOnly } = require('../middleware/roleGuard');
const backupController = require('../controllers/backup.controller');

// Multer storage for uploaded backup files
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `restore-${Date.now()}${path.extname(file.originalname)}`)
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB max for database dumps
});

// Admin Backup & Restore Routes
router.get('/stats', auth, adminOnly, backupController.getBackupStats);
router.get('/schedule', auth, adminOnly, backupController.getBackupSchedule);
router.post('/schedule', auth, adminOnly, backupController.saveBackupSchedule);
router.post('/download', auth, adminOnly, backupController.generateBackup);
router.get('/download', auth, adminOnly, backupController.generateBackup);
router.post('/email', auth, adminOnly, backupController.sendBackupToEmail);
router.post('/restore', auth, adminOnly, upload.single('backupFile'), backupController.restoreBackup);

module.exports = router;
