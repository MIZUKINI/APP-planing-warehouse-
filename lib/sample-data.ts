import { readProductionRecords } from "@/lib/excel-production-reader";
import { calculatePickingItems, generateReferenceNumber, updatePickedQuantity, type OrderStatus } from "@/lib/domain";

export const baseCartrouting = [
  {
    lineNo: 10,
    partIndex: "BRK-220-L",
    partDescription: "Lewy wspornik mocujący",
    location: "A-01-02",
    quantityPerTank: 2
  },
  {
    lineNo: 20,
    partIndex: "SEAL-90",
    partDescription: "Uszczelka gumowa 90 mm",
    location: "B-03-01",
    quantityPerTank: 1
  },
  {
    lineNo: 30,
    partIndex: "PIPE-SUPPORT",
    partDescription: "Uchwyt przewodu hydraulicznego",
    location: "C-02-04",
    quantityPerTank: 4
  },
  {
    lineNo: 40,
    partIndex: "CAP-M12-BLK",
    partDescription: "Zaślepka ochronna M12 czarna",
    location: "D-01-01",
    quantityPerTank: 2
  }
];

const orderOneItems = calculatePickingItems(5, baseCartrouting).map((item) => {
  if (item.partIndex === "BRK-220-L") return updatePickedQuantity(item, 8);
  if (item.partIndex === "SEAL-90") return updatePickedQuantity(item, 5);
  if (item.partIndex === "PIPE-SUPPORT") return updatePickedQuantity(item, 16);
  return updatePickedQuantity(item, item.requiredQuantity);
});

const orderTwoItems = calculatePickingItems(3, baseCartrouting).map((item) => {
  if (item.partIndex === "PIPE-SUPPORT") return updatePickedQuantity(item, 9);
  if (item.partIndex === "CAP-M12-BLK") return updatePickedQuantity(item, 4);
  return updatePickedQuantity(item, item.requiredQuantity);
});

export const productionSheetRows = [
  [null, null, null, null, null, null],
  [null, null, 23, 23, 23, 23],
  [null, null, "01-06", "02-06", "03-06", "04-06"],
  [null, "TANK-AX-100", 2, 0, 3, 0],
  [null, "TANK-BX-210", 0, 1, 0, 2],
  [null, "TANK-CX-310", 0, 0, 2, 0]
];

export const productionRecords = readProductionRecords({ rows: productionSheetRows });

export const shippingPlanRows = [
  {
    lp: 1,
    tankIndex: "TANK-AX-100",
    weekNumber: 23,
    year: 2026,
    weekdayQuantities: [2, 0, 3, 0, 0],
    weeklyQuantity: 5,
    note: "Priorytet: wysyłka na początek tygodnia"
  },
  {
    lp: 2,
    tankIndex: "TANK-BX-210",
    weekNumber: 23,
    year: 2026,
    weekdayQuantities: [0, 1, 0, 2, 0],
    weeklyQuantity: 3,
    note: "Wymaga kontroli braków przez kierownika"
  },
  {
    lp: 3,
    tankIndex: "TANK-CX-310",
    weekNumber: 23,
    year: 2026,
    weekdayQuantities: [0, 0, 2, 0, 0],
    weeklyQuantity: 2,
    note: "Gotowe do wydania"
  }
];

export const dashboardSample = {
  weekNumber: 23,
  year: 2026,
  importedAt: "2026-06-01T08:15:00.000Z",
  orders: [
    {
      referenceNumber: generateReferenceNumber(23, 1, 2026),
      tankIndex: "TANK-AX-100",
      plannedQuantity: 5,
      status: "shortage" as OrderStatus,
      issuedToProduction: false,
      issuedAt: null as string | null,
      notes: "Priorytet: wysyłka na początek tygodnia",
      items: orderOneItems
    },
    {
      referenceNumber: generateReferenceNumber(23, 2, 2026),
      tankIndex: "TANK-BX-210",
      plannedQuantity: 3,
      status: "awaiting_manager_approval" as OrderStatus,
      issuedToProduction: false,
      issuedAt: null as string | null,
      notes: "Wymaga kontroli braków przez kierownika",
      items: orderTwoItems
    },
    {
      referenceNumber: generateReferenceNumber(23, 3, 2026),
      tankIndex: "TANK-CX-310",
      plannedQuantity: 2,
      status: "completed" as OrderStatus,
      issuedToProduction: false,
      issuedAt: null as string | null,
      notes: "Gotowe do wydania",
      items: calculatePickingItems(2, baseCartrouting).map((item) => updatePickedQuantity(item, item.requiredQuantity))
    }
  ]
};
