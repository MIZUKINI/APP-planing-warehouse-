import { describe, expect, it } from "vitest";
import {
  aggregateWeeklyQuantity,
  calculatePickingItems,
  canIssueToProduction,
  createOrderDraftsFromImport,
  generateReferenceNumber,
  summarizeShortages,
  updatePickedQuantity
} from "@/lib/domain";

describe("weekly shipping import", () => {
  it("sums five workday columns for one week", () => {
    expect(aggregateWeeklyQuantity([2, null, 3, null, 1])).toBe(6);
  });

  it("skips tanks without shipment", () => {
    expect(
      createOrderDraftsFromImport([
        { tankIndex: "TANK-1", weekdayQuantities: [0, null, 0, null, 0] },
        { tankIndex: "TANK-2", weekdayQuantities: [1, null, 0, null, 0] }
      ])
    ).toEqual([{ tankIndex: "TANK-2", plannedQuantity: 1 }]);
  });

  it("rejects fractional weekly quantities", () => {
    expect(() => aggregateWeeklyQuantity([1, 0.5, 0, 0, 0])).toThrow("integer");
  });
});

describe("reference numbers", () => {
  it("uses the approved weekly format", () => {
    expect(generateReferenceNumber(23, 1, 2026)).toBe("T23/1/2026");
  });
});

describe("cartrouting calculations", () => {
  it("multiplies order quantity by quantity per tank", () => {
    const [item] = calculatePickingItems(5, [
      { lineNo: 10, partIndex: "BRK", partDescription: "Bracket", location: "A-01", quantityPerTank: 4 }
    ]);

    expect(item.requiredQuantity).toBe(20);
    expect(item.shortageQuantity).toBe(20);
  });

  it("removes shortage when picked quantity is completed", () => {
    const [item] = calculatePickingItems(5, [
      { lineNo: 10, partIndex: "BRK", partDescription: "Bracket", location: "A-01", quantityPerTank: 4 }
    ]);

    const updated = updatePickedQuantity(item, 20);
    expect(updated.shortageQuantity).toBe(0);
    expect(updated.isCompleted).toBe(true);
  });
});

describe("shortage filtering and issuing", () => {
  it("groups shortages by part and keeps reference numbers", () => {
    const summary = summarizeShortages([
      {
        referenceNumber: "T23/1/2026",
        tankIndex: "TANK-1",
        partIndex: "SEAL",
        partDescription: "Rubber seal",
        location: "B-03",
        shortageQuantity: 2
      },
      {
        referenceNumber: "T23/2/2026",
        tankIndex: "TANK-2",
        partIndex: "SEAL",
        partDescription: "Rubber seal",
        location: "B-03",
        shortageQuantity: 3
      }
    ]);

    expect(summary.SEAL.total).toBe(5);
    expect(summary.SEAL.orders.map((order) => order.referenceNumber)).toEqual(["T23/1/2026", "T23/2/2026"]);
  });

  it("blocks issuing an order with shortages until manager approval is active", () => {
    expect(canIssueToProduction({ status: "shortage", hasShortages: true, shortageApprovalActive: false })).toBe(false);
    expect(canIssueToProduction({ status: "approved_with_shortages", hasShortages: true, shortageApprovalActive: true })).toBe(true);
  });
});
