require('dotenv').config();
const db = require('./config/db');
const whatsappService = require('./services/whatsappService');

async function runTests() {
    console.log('🧪 Starting WhatsApp Integration & Safety Tests...\n');
    let passCount = 0;
    let failCount = 0;

    const assert = (condition, testName) => {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passCount++;
        } else {
            console.error(`  ❌ FAIL: ${testName}`);
            failCount++;
        }
    };

    try {
        // Test 1: Phone Normalization
        console.log('--- Test Suite 1: Phone Normalization ---');
        const num1 = whatsappService.normalizePhoneNumber('+91 98765-43210');
        assert(num1 === '919876543210', 'Normalizes +91 98765-43210 to 919876543210');

        const num2 = whatsappService.normalizePhoneNumber('082 123 4567');
        assert(num2 === '0821234567', 'Normalizes 082 123 4567 to 0821234567');

        const numInvalid = whatsappService.normalizePhoneNumber('123');
        assert(numInvalid === null, 'Rejects short/invalid phone numbers');

        // Test 2: Database Schema & Isolation
        console.log('\n--- Test Suite 2: Multi-Tenant Settings & Database ---');
        const testCompany1 = 99991;
        const testCompany2 = 99992;

        await db.execute('DELETE FROM company_whatsapp_settings WHERE company_id IN (?, ?)', [testCompany1, testCompany2]);
        await db.execute('DELETE FROM whatsapp_logs WHERE company_id IN (?, ?)', [testCompany1, testCompany2]);

        await whatsappService.updateCompanyStatus(testCompany1, 'DISCONNECTED', {
            phone_number: '919999999991',
            last_error: null
        });

        await whatsappService.updateCompanyStatus(testCompany2, 'DISCONNECTED', {
            phone_number: '919999999992',
            last_error: null
        });

        const status1 = await whatsappService.getStatus(testCompany1);
        const status2 = await whatsappService.getStatus(testCompany2);

        assert(status1.phone_number === '919999999991', 'Company 1 phone number correctly stored');
        assert(status2.phone_number === '919999999992', 'Company 2 phone number correctly stored');
        assert(status1.phone_number !== status2.phone_number, 'Strict Tenant Isolation between Company 1 and Company 2');

        // Test 3: Preferences Update
        console.log('\n--- Test Suite 3: Preferences Update ---');
        await whatsappService.updatePreferences(testCompany1, {
            notify_attendance: true,
            notify_leaves: false,
            notify_claims: true,
            notify_payroll: false,
            notify_admin_alerts: true
        });

        const updatedStatus1 = await whatsappService.getStatus(testCompany1);
        assert(updatedStatus1.notify_attendance === true, 'Attendance notification toggle enabled');
        assert(updatedStatus1.notify_leaves === false, 'Leaves notification toggle disabled');
        assert(updatedStatus1.notify_payroll === false, 'Payroll notification toggle disabled');

        // Test 4: Graceful Message Dispatch When Disconnected
        console.log('\n--- Test Suite 4: Non-Blocking Message Safety ---');
        const sendResult = await whatsappService.sendMessage(testCompany1, '919876543210', 'Test message', {
            recipientName: 'Test Staff',
            recipientRole: 'employee',
            eventType: 'TEST_DISPATCH'
        });

        assert(sendResult.success === false && sendResult.status === 'SKIPPED', 'Skips send gracefully when disconnected without error');

        const logs = await whatsappService.getLogs(testCompany1, 10);
        assert(logs.length > 0, 'Message attempt logged in database');
        assert(logs[0].status === 'SKIPPED', 'Log entry recorded as SKIPPED');
        assert(logs[0].recipient_phone === '919876543210', 'Log entry contains correct recipient phone');

        // Test 5: Async Role-Based Notification Methods
        console.log('\n--- Test Suite 5: Role-Based Notification Dispatch Methods ---');
        // Attendance
        await whatsappService.sendAttendanceNotification(testCompany1, {
            employeeId: null,
            employeeName: 'John Doe',
            employeePhone: '919876543210',
            date: '2026-09-30',
            time: '09:00:00',
            status: 'Present'
        });
        assert(true, 'sendAttendanceNotification executed without blocking or throwing');

        // Leaves
        await whatsappService.sendLeaveNotification(testCompany1, {
            type: 'APPLIED',
            employeeId: null,
            employeeName: 'Jane Smith',
            employeePhone: '919876543211',
            leaveType: 'Annual Leave',
            startDate: '2026-10-01',
            endDate: '2026-10-03',
            reason: 'Vacation'
        });
        assert(true, 'sendLeaveNotification executed without blocking or throwing');

        // Claims
        await whatsappService.sendClaimNotification(testCompany1, {
            type: 'SUBMITTED',
            employeeId: null,
            employeeName: 'Jane Smith',
            employeePhone: '919876543211',
            claimTitle: 'Travel Expense',
            amount: 500,
            currency: 'INR'
        });
        assert(true, 'sendClaimNotification executed without blocking or throwing');

        // Payroll
        await whatsappService.sendPayrollNotification(testCompany1, {
            employeeId: null,
            employeeName: 'Jane Smith',
            employeePhone: '919876543211',
            month: 'September 2026',
            netSalary: '45000.00',
            currency: 'INR'
        });
        assert(true, 'sendPayrollNotification executed without blocking or throwing');

        // Cleanup test data
        await db.execute('DELETE FROM company_whatsapp_settings WHERE company_id IN (?, ?)', [testCompany1, testCompany2]);
        await db.execute('DELETE FROM whatsapp_logs WHERE company_id IN (?, ?)', [testCompany1, testCompany2]);

        console.log('\n========================================');
        console.log(`🎉 SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
        console.log('========================================\n');

        if (failCount === 0) {
            process.exit(0);
        } else {
            process.exit(1);
        }
    } catch (err) {
        console.error('❌ Test suite failed with exception:', err);
        process.exit(1);
    }
}

runTests();
