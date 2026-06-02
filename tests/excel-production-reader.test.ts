import { describe, expect, it } from "vitest";
import { detectProductionColumns, readProductionRecords, readProductionRecordsFromSheet } from "@/lib/excel-production-reader";

describe("production Excel reader", () => {
  const rows = [
    [null, null, null, null, null, null],
    [null, null, 12, 12, 12, 13],
    [null, null, "17-03", "18-03", "19-03", "24-03"],
    [null, "CAT-468-7433", 2, 0, 4, 1],
    [null, "", 5, 5, 5, 5],
    [null, "JCB-401/K4203", null, 3, 0, 2]
  ];

  it("detects production week/date columns dynamically", () => {
    expect(detectProductionColumns({ rows }).map((column) => column.columnNumber)).toEqual([3, 4, 5, 6]);
  });

  it("creates one production record per tank and production cell, preserving zero and null quantities", () => {
    expect(readProductionRecords({ rows })).toEqual([
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "17-03", quantity: 2 },
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "18-03", quantity: 0 },
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "19-03", quantity: 4 },
      { tank_index: "CAT-468-7433", production_week: 13, production_date: "24-03", quantity: 1 },
      { tank_index: "JCB-401/K4203", production_week: 12, production_date: "17-03", quantity: null },
      { tank_index: "JCB-401/K4203", production_week: 12, production_date: "18-03", quantity: 3 },
      { tank_index: "JCB-401/K4203", production_week: 12, production_date: "19-03", quantity: 0 },
      { tank_index: "JCB-401/K4203", production_week: 13, production_date: "24-03", quantity: 2 }
    ]);
  });

  it("ignores hidden rows and hidden columns", () => {
    expect(readProductionRecords({ rows, hiddenRows: [6], hiddenColumns: [4] })).toEqual([
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "17-03", quantity: 2 },
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "19-03", quantity: 4 },
      { tank_index: "CAT-468-7433", production_week: 13, production_date: "24-03", quantity: 1 }
    ]);
  });

  it("reads SheetJS-like sheets and honors hidden metadata", () => {
    const records = readProductionRecordsFromSheet({
      "!ref": "A1:E5",
      "!cols": [{}, {}, {}, { hidden: true }, {}],
      B4: { v: "CAT-468-7433" },
      B5: { v: "JCB-402/D5965" },
      C2: { v: 12 },
      C3: { v: "17-03" },
      C4: { v: 2 },
      C5: { v: 0 },
      D2: { v: 12 },
      D3: { v: "18-03" },
      D4: { v: 999 },
      E2: { v: 12 },
      E3: { v: "19-03" },
      E4: { v: 4 },
      E5: { v: 1 }
    });

    expect(records).toEqual([
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "17-03", quantity: 2 },
      { tank_index: "CAT-468-7433", production_week: 12, production_date: "19-03", quantity: 4 },
      { tank_index: "JCB-402/D5965", production_week: 12, production_date: "17-03", quantity: 0 },
      { tank_index: "JCB-402/D5965", production_week: 12, production_date: "19-03", quantity: 1 }
    ]);
  });

  it("supports only production weeks 1-52", () => {
    const invalidWeekRows = [
      [null, null, null],
      [null, null, 53],
      [null, null, "17-03"],
      [null, "CAT-468-7433", 2]
    ];

    expect(readProductionRecords({ rows: invalidWeekRows })).toEqual([]);
  });
});
