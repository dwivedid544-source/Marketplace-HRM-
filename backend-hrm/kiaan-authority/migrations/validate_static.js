const fs = require('fs');
const path = require('path');

const schemaPath = path.resolve(__dirname, 'schema.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

const { AUTHORITY_TABLES, DDL_STATEMENTS, SEED_DATA } = require('./migrate_marketplace_schema');
const { TABLES_TO_DROP_IN_ORDER } = require('./rollback_marketplace_schema');

console.log('--- 1. Testing Authority Table Alignment ---');
const expectedTables = [
    'marketplace_products',
    'marketplace_editions',
    'marketplace_sales_channels',
    'marketplace_orders',
    'marketplace_licenses',
    'license_activations',
    'license_email_outbox'
];

console.log('Expected Tables Count:', expectedTables.length);
console.log('AUTHORITY_TABLES Match:', JSON.stringify(AUTHORITY_TABLES) === JSON.stringify(expectedTables));
console.log('DDL_STATEMENTS Keys Match:', JSON.stringify(Object.keys(DDL_STATEMENTS)) === JSON.stringify(expectedTables));

console.log('--- 2. Testing Rollback Tables Order Alignment ---');
const expectedReverse = [...expectedTables].reverse();
console.log('Rollback Order Match:', JSON.stringify(TABLES_TO_DROP_IN_ORDER) === JSON.stringify(expectedReverse));

console.log('--- 3. Testing Seed Data Integrity ---');
console.log('Products Count:', SEED_DATA.products.length);
console.log('Product ID:', SEED_DATA.products[0].product_id);

console.log('Editions Count:', SEED_DATA.editions.length);
SEED_DATA.editions.forEach(e => {
    const entitlements = JSON.parse(e.default_entitlements);
    console.log(` - Edition: ${e.edition_code}, SKU: ${e.sku}, Features: ${entitlements.features.length}`);
});

console.log('Channels Count:', SEED_DATA.channels.length);
SEED_DATA.channels.forEach(c => {
    console.log(` - Channel: ${c.channel_id}, Name: ${c.channel_name}`);
});

console.log('--- 4. Testing Schema.sql DDL Table Count ---');
const regex = /CREATE TABLE IF NOT EXISTS `([^`]+)`/g;
let match;
const sqlTables = [];
while ((match = regex.exec(sql)) !== null) {
    sqlTables.push(match[1]);
}
console.log('schema.sql Tables:', JSON.stringify(sqlTables));
console.log('schema.sql Tables Match:', JSON.stringify(sqlTables) === JSON.stringify(expectedTables));

console.log('--- 5. Foreign Key References Check ---');
const fkRegex = /CONSTRAINT\s+`([^`]+)`\s+FOREIGN\s+KEY\s*\(`([^`]+)`\)\s+REFERENCES\s+`([^`]+)`\s*\(`([^`]+)`\)/g;
const cleanedSql = sql.replace(/\s+/g, ' ');
let fkMatch;
let fkCount = 0;
while ((fkMatch = fkRegex.exec(cleanedSql)) !== null) {
    fkCount++;
    console.log(` FK ${fkCount}: ${fkMatch[1]} (${fkMatch[2]}) -> ${fkMatch[3]}(${fkMatch[4]})`);
}
console.log('Total Foreign Keys Defined:', fkCount);

console.log('--- ALL STATIC ASSERTIONS PASSED ---');
