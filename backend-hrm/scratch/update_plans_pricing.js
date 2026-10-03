const db = require('../config/db');

async function updatePlans() {
    try {
        await db.execute(
            'UPDATE plans SET price = ?, employee_limit = ?, features = ? WHERE name = ? OR id = 5',
            ['700', 10, JSON.stringify(['Up to 10 Employees', 'Attendance Management', 'Leave & Claims Management', 'Payroll Management', 'Kiosk Mode', 'GPS Geofencing']), 'Starter Plan']
        );
        
        await db.execute(
            'UPDATE plans SET price = ?, employee_limit = ?, features = ? WHERE name = ? OR id = 6',
            ['900', 20, JSON.stringify(['Up to 20 Employees', 'Attendance Management', 'Leave & Claims Management', 'Payroll Management', 'Kiosk Mode', 'GPS Geofencing']), 'Standard Plan']
        );
        
        await db.execute(
            'UPDATE plans SET price = ?, employee_limit = ?, features = ? WHERE name = ? OR id = 7',
            ['1200', 50, JSON.stringify(['Up to 50 Employees', 'Attendance Management', 'Leave & Claims Management', 'Payroll Management', 'Kiosk Mode', 'GPS Geofencing']), 'Pro Plan']
        );

        await db.execute('UPDATE companies SET employee_limit = 20 WHERE plan = ?', ['Standard Plan']);

        const [rows] = await db.execute('SELECT id, name, price, duration, employee_limit, features FROM plans');
        console.log('UPDATED PLANS IN DB:', rows);
    } catch (e) {
        console.error('Error updating plans:', e);
    } finally {
        process.exit();
    }
}

updatePlans();
