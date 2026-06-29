"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.REQUIRED_COLUMNS = void 0;
exports.parseOpportunityWorkbook = parseOpportunityWorkbook;
const XLSX = __importStar(require("xlsx"));
exports.REQUIRED_COLUMNS = [
    'Opportunity Name',
    'Account Name',
    'Stage',
    'Estimated Revenue',
];
function isBlank(value) {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}
/** Normalize an estimated-revenue cell to a numeric string, or null if invalid. */
function normalizeRevenue(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toString() : null;
    }
    if (typeof value === 'string') {
        // Tolerate common spreadsheet formatting like "$1,250.50".
        const cleaned = value.replace(/[$,\s]/g, '');
        if (cleaned === '' || Number.isNaN(Number(cleaned))) {
            return null;
        }
        return cleaned;
    }
    return null;
}
/**
 * Parse and validate an uploaded .xlsx/.csv buffer into opportunity rows.
 *
 * Returns both the parsed rows and a list of per-cell errors. The caller MUST
 * treat a non-empty `errors` array as a hard abort and insert nothing — this
 * function never partially accepts a file.
 */
function parseOpportunityWorkbook(buffer) {
    const errors = [];
    const rows = [];
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        errors.push({ row: 0, column: '*', value: null, message: 'Workbook contains no sheets' });
        return { rows, errors };
    }
    const sheet = workbook.Sheets[sheetName];
    // Header detection via array-of-arrays so we can report missing columns.
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const header = (aoa[0] ?? []).map((h) => (typeof h === 'string' ? h.trim() : String(h ?? '')));
    const missing = exports.REQUIRED_COLUMNS.filter((col) => !header.includes(col));
    if (missing.length > 0) {
        for (const col of missing) {
            errors.push({ row: 1, column: col, value: null, message: `Missing required column "${col}"` });
        }
        return { rows, errors };
    }
    const records = XLSX.utils.sheet_to_json(sheet, { defval: null, blankrows: false });
    if (records.length === 0) {
        errors.push({ row: 1, column: '*', value: null, message: 'No data rows found' });
        return { rows, errors };
    }
    records.forEach((record, index) => {
        const rowNumber = index + 2; // account for the header row
        const name = record['Opportunity Name'];
        const account = record['Account Name'];
        const stage = record['Stage'];
        const revenueRaw = record['Estimated Revenue'];
        let rowOk = true;
        if (isBlank(name)) {
            errors.push({ row: rowNumber, column: 'Opportunity Name', value: name, message: 'Required value is empty' });
            rowOk = false;
        }
        if (isBlank(account)) {
            errors.push({ row: rowNumber, column: 'Account Name', value: account, message: 'Required value is empty' });
            rowOk = false;
        }
        if (isBlank(stage)) {
            errors.push({ row: rowNumber, column: 'Stage', value: stage, message: 'Required value is empty' });
            rowOk = false;
        }
        const revenue = normalizeRevenue(revenueRaw);
        if (isBlank(revenueRaw)) {
            errors.push({ row: rowNumber, column: 'Estimated Revenue', value: revenueRaw, message: 'Required value is empty' });
            rowOk = false;
        }
        else if (revenue === null) {
            errors.push({ row: rowNumber, column: 'Estimated Revenue', value: revenueRaw, message: 'Must be a valid number' });
            rowOk = false;
        }
        if (rowOk && revenue !== null) {
            rows.push({
                name: String(name).trim(),
                account_name: String(account).trim(),
                stage: String(stage).trim(),
                estimated_revenue: revenue,
            });
        }
    });
    return { rows, errors };
}
//# sourceMappingURL=opportunityImport.js.map