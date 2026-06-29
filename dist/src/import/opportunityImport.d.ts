/** A validated opportunity row ready for insertion (tenant/owner added later). */
export interface ParsedOpportunity {
    name: string;
    account_name: string;
    stage: string;
    estimated_revenue: string;
}
/** A precise, per-cell validation failure for the import error report. */
export interface RowError {
    /** 1-based spreadsheet row number (header is row 1, first data row is 2). */
    row: number;
    /** The offending column header. */
    column: string;
    value: unknown;
    message: string;
}
export interface ParseResult {
    rows: ParsedOpportunity[];
    errors: RowError[];
}
export declare const REQUIRED_COLUMNS: readonly ["Opportunity Name", "Account Name", "Stage", "Estimated Revenue"];
/**
 * Parse and validate an uploaded .xlsx/.csv buffer into opportunity rows.
 *
 * Returns both the parsed rows and a list of per-cell errors. The caller MUST
 * treat a non-empty `errors` array as a hard abort and insert nothing — this
 * function never partially accepts a file.
 */
export declare function parseOpportunityWorkbook(buffer: Buffer): ParseResult;
