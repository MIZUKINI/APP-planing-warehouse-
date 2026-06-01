export type ExcelCellValue = string | number | boolean | Date | null | undefined;


export interface SheetCellLike {
  v?: ExcelCellValue;
  w?: string;
}

export interface SheetLike {
  [cellAddress: string]: SheetCellLike | string | undefined | Array<{ hidden?: boolean }>;
  "!ref"?: string;
  "!rows"?: Array<{ hidden?: boolean }>;
  "!cols"?: Array<{ hidden?: boolean }>;
}

export interface ExcelProductionSheetInput {
  rows: ExcelCellValue[][];
  hiddenRows?: number[];
  hiddenColumns?: number[];
}

export interface ProductionRecord {
  tank_index: string;
  production_week: number;
  production_date: string;
  quantity: ExcelCellValue;
}

export interface ProductionColumnMapping {
  columnNumber: number;
  production_week: number;
  production_date: string;
}

const TANK_INDEX_COLUMN = 2;
const WEEK_HEADER_ROW = 2;
const DATE_HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;
const MIN_PRODUCTION_WEEK = 1;
const MAX_PRODUCTION_WEEK = 52;

function cellAt(rows: ExcelCellValue[][], rowNumber: number, columnNumber: number): ExcelCellValue {
  return rows[rowNumber - 1]?.[columnNumber - 1];
}

function isBlank(value: ExcelCellValue): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function normalizeTankIndex(value: ExcelCellValue): string {
  return String(value ?? "").trim();
}

function parseProductionWeek(value: ExcelCellValue): number | null {
  if (isBlank(value)) return null;

  const week = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(week) || week < MIN_PRODUCTION_WEEK || week > MAX_PRODUCTION_WEEK) {
    return null;
  }

  return week;
}

function normalizeProductionDate(value: ExcelCellValue): string | null {
  if (isBlank(value)) return null;

  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}`;
  }

  const date = String(value).trim();
  return /^\d{2}-\d{2}$/.test(date) ? date : null;
}

function isHidden(index: number, hiddenIndexes: Set<number>): boolean {
  return hiddenIndexes.has(index);
}

function rowHasAnyVisibleValue(row: ExcelCellValue[] | undefined, hiddenColumns: Set<number>): boolean {
  if (!row) return false;

  return row.some((value, zeroIndex) => !hiddenColumns.has(zeroIndex + 1) && !isBlank(value));
}

function columnHasAnyVisibleValue(rows: ExcelCellValue[][], columnNumber: number, hiddenRows: Set<number>): boolean {
  return rows.some((row, zeroIndex) => !hiddenRows.has(zeroIndex + 1) && !isBlank(row[columnNumber - 1]));
}

export function detectProductionColumns(input: ExcelProductionSheetInput): ProductionColumnMapping[] {
  const hiddenRows = new Set(input.hiddenRows ?? []);
  const hiddenColumns = new Set(input.hiddenColumns ?? []);
  const maxColumns = Math.max(0, ...input.rows.map((row) => row.length));
  const mappings: ProductionColumnMapping[] = [];

  for (let columnNumber = 1; columnNumber <= maxColumns; columnNumber += 1) {
    if (columnNumber === TANK_INDEX_COLUMN) continue;
    if (isHidden(columnNumber, hiddenColumns)) continue;
    if (!columnHasAnyVisibleValue(input.rows, columnNumber, hiddenRows)) continue;

    const productionWeek = parseProductionWeek(cellAt(input.rows, WEEK_HEADER_ROW, columnNumber));
    const productionDate = normalizeProductionDate(cellAt(input.rows, DATE_HEADER_ROW, columnNumber));

    if (productionWeek === null || productionDate === null) continue;

    mappings.push({
      columnNumber,
      production_week: productionWeek,
      production_date: productionDate
    });
  }

  return mappings;
}

export function readProductionRecords(input: ExcelProductionSheetInput): ProductionRecord[] {
  const hiddenRows = new Set(input.hiddenRows ?? []);
  const hiddenColumns = new Set(input.hiddenColumns ?? []);
  const productionColumns = detectProductionColumns(input);
  const records: ProductionRecord[] = [];

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= input.rows.length; rowNumber += 1) {
    if (isHidden(rowNumber, hiddenRows)) continue;

    const row = input.rows[rowNumber - 1];
    if (!rowHasAnyVisibleValue(row, hiddenColumns)) continue;

    const tankIndex = normalizeTankIndex(cellAt(input.rows, rowNumber, TANK_INDEX_COLUMN));
    if (!tankIndex) continue;

    productionColumns.forEach((column) => {
      records.push({
        tank_index: tankIndex,
        production_week: column.production_week,
        production_date: column.production_date,
        quantity: cellAt(input.rows, rowNumber, column.columnNumber)
      });
    });
  }

  return records;
}

function columnLettersToNumber(letters: string): number {
  return letters.split("").reduce((total, letter) => total * 26 + letter.toUpperCase().charCodeAt(0) - 64, 0);
}

function numberToColumnLetters(columnNumber: number): string {
  let value = columnNumber;
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}

function decodeCellAddress(address: string): { rowNumber: number; columnNumber: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(address);
  if (!match) return null;

  return {
    columnNumber: columnLettersToNumber(match[1]),
    rowNumber: Number(match[2])
  };
}

function getSheetBounds(sheet: SheetLike) {
  if (typeof sheet["!ref"] === "string") {
    const [, end] = sheet["!ref"].split(":");
    const decodedEnd = decodeCellAddress(end);
    if (decodedEnd) return decodedEnd;
  }

  return Object.keys(sheet).reduce(
    (bounds, key) => {
      const decoded = decodeCellAddress(key);
      if (!decoded) return bounds;
      return {
        rowNumber: Math.max(bounds.rowNumber, decoded.rowNumber),
        columnNumber: Math.max(bounds.columnNumber, decoded.columnNumber)
      };
    },
    { rowNumber: 0, columnNumber: 0 }
  );
}

function sheetCellValue(sheet: SheetLike, rowNumber: number, columnNumber: number): ExcelCellValue {
  const cell = sheet[`${numberToColumnLetters(columnNumber)}${rowNumber}`];
  if (!cell || typeof cell === "string" || Array.isArray(cell)) return undefined;

  if (rowNumber === DATE_HEADER_ROW && typeof cell.w === "string") {
    return cell.w;
  }

  return cell.v;
}

export function sheetToProductionInput(sheet: SheetLike): ExcelProductionSheetInput {
  const bounds = getSheetBounds(sheet);
  const rows: ExcelCellValue[][] = [];

  for (let rowNumber = 1; rowNumber <= bounds.rowNumber; rowNumber += 1) {
    const row: ExcelCellValue[] = [];
    for (let columnNumber = 1; columnNumber <= bounds.columnNumber; columnNumber += 1) {
      row.push(sheetCellValue(sheet, rowNumber, columnNumber));
    }
    rows.push(row);
  }

  return {
    rows,
    hiddenRows: sheet["!rows"]?.map((row, index) => row?.hidden ? index + 1 : 0).filter(Boolean),
    hiddenColumns: sheet["!cols"]?.map((column, index) => column?.hidden ? index + 1 : 0).filter(Boolean)
  };
}

export function readProductionRecordsFromSheet(sheet: SheetLike): ProductionRecord[] {
  return readProductionRecords(sheetToProductionInput(sheet));
}
