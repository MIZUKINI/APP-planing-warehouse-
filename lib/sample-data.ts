import { calculatePickingItems, generateReferenceNumber, updatePickedQuantity, type OrderStatus } from "@/lib/domain";

const baseCartrouting = [
  {
    lineNo: 10,
    partIndex: "BRK-220-L",
    partDescription: "Left mounting bracket",
    location: "A-01-02",
    quantityPerTank: 2
  },
  {
    lineNo: 20,
    partIndex: "SEAL-90",
    partDescription: "Rubber seal",
    location: "B-03-01",
    quantityPerTank: 1
  },
  {
    lineNo: 30,
    partIndex: "PIPE-SUPPORT",
    partDescription: "Pipe support",
    location: "C-02-04",
    quantityPerTank: 4
  }
];

const orderOneItems = calculatePickingItems(5, baseCartrouting).map((item) => {
  if (item.partIndex === "BRK-220-L") return updatePickedQuantity(item, 8);
  if (item.partIndex === "SEAL-90") return updatePickedQuantity(item, 5);
  return updatePickedQuantity(item, 16);
});

const orderTwoItems = calculatePickingItems(3, baseCartrouting).map((item) => {
  if (item.partIndex === "PIPE-SUPPORT") return updatePickedQuantity(item, 9);
  return updatePickedQuantity(item, item.requiredQuantity);
});

export const dashboardSample = {
  weekNumber: 23,
  year: 2026,
  importedAt: "2026-05-31T08:15:00.000Z",
  orders: [
    {
      referenceNumber: generateReferenceNumber(23, 1, 2026),
      tankIndex: "TANK-AX-100",
      plannedQuantity: 5,
      status: "shortage" as OrderStatus,
      issuedToProduction: false,
      notes: "Priority shipment",
      items: orderOneItems
    },
    {
      referenceNumber: generateReferenceNumber(23, 2, 2026),
      tankIndex: "TANK-BX-210",
      plannedQuantity: 3,
      status: "awaiting_manager_approval" as OrderStatus,
      issuedToProduction: false,
      notes: "Needs manager shortage approval",
      items: orderTwoItems
    },
    {
      referenceNumber: generateReferenceNumber(23, 3, 2026),
      tankIndex: "TANK-CX-310",
      plannedQuantity: 2,
      status: "completed" as OrderStatus,
      issuedToProduction: false,
      notes: "Ready to issue",
      items: calculatePickingItems(2, baseCartrouting).map((item) => updatePickedQuantity(item, item.requiredQuantity))
    }
  ]
};
