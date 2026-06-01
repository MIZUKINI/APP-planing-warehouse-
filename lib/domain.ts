export type UserRole = "warehouse" | "planner" | "manager";
export type OrderStatus =
  | "new"
  | "ready_for_picking"
  | "picking"
  | "completed"
  | "shortage"
  | "awaiting_manager_approval"
  | "approved_with_shortages"
  | "issued"
  | "cancelled";

export type WeekdayQuantities = [number | null, number | null, number | null, number | null, number | null];

export interface ShippingImportRow {
  tankIndex: string;
  weekdayQuantities: WeekdayQuantities;
  notes?: string;
}

export interface WeeklyOrderDraft {
  tankIndex: string;
  plannedQuantity: number;
  notes?: string;
}

export interface CartroutingItemInput {
  lineNo: number;
  partIndex: string;
  partDescription: string;
  location: string;
  quantityPerTank: number;
  notes?: string;
}

export interface PickingItem extends CartroutingItemInput {
  requiredQuantity: number;
  pickedQuantity: number;
  shortageQuantity: number;
  isCompleted: boolean;
}

export interface ShortageLine {
  referenceNumber: string;
  tankIndex: string;
  partIndex: string;
  partDescription: string;
  location: string;
  shortageQuantity: number;
}

export interface WeeklyOrderForIssue {
  status: OrderStatus;
  hasShortages: boolean;
  shortageApprovalActive: boolean;
}

export function aggregateWeeklyQuantity(quantities: WeekdayQuantities): number {
  const sum = quantities.reduce<number>((total, value) => total + (value ?? 0), 0);

  if (!Number.isInteger(sum)) {
    throw new Error("Weekly quantity must be an integer value.");
  }

  return sum;
}

export function createOrderDraftsFromImport(rows: ShippingImportRow[]): WeeklyOrderDraft[] {
  return rows
    .map((row) => ({
      tankIndex: row.tankIndex.trim(),
      plannedQuantity: aggregateWeeklyQuantity(row.weekdayQuantities),
      notes: row.notes?.trim() || undefined
    }))
    .filter((row) => row.tankIndex.length > 0 && row.plannedQuantity > 0);
}

export function generateReferenceNumber(weekNumber: number, sequenceNumber: number, year: number): string {
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    throw new Error("Week number must be an integer between 1 and 53.");
  }

  if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
    throw new Error("Sequence number must be a positive integer.");
  }

  if (!Number.isInteger(year) || year < 2000) {
    throw new Error("Year must be a valid integer.");
  }

  return `T${weekNumber}/${String(sequenceNumber).padStart(2, "0")}/${year}`;
}

export function calculatePickingItems(orderQuantity: number, items: CartroutingItemInput[]): PickingItem[] {
  if (!Number.isInteger(orderQuantity) || orderQuantity < 1) {
    throw new Error("Order quantity must be a positive integer.");
  }

  return items.map((item) => {
    const requiredQuantity = orderQuantity * item.quantityPerTank;

    return {
      ...item,
      requiredQuantity,
      pickedQuantity: 0,
      shortageQuantity: requiredQuantity,
      isCompleted: false
    };
  });
}

export function updatePickedQuantity(item: PickingItem, pickedQuantity: number): PickingItem {
  if (pickedQuantity < 0) {
    throw new Error("Picked quantity cannot be negative.");
  }

  return {
    ...item,
    pickedQuantity,
    shortageQuantity: Math.max(item.requiredQuantity - pickedQuantity, 0),
    isCompleted: pickedQuantity >= item.requiredQuantity
  };
}

export function summarizeShortages(lines: ShortageLine[]) {
  return lines.reduce<Record<string, { partDescription: string; location: string; total: number; orders: ShortageLine[] }>>(
    (summary, line) => {
      if (line.shortageQuantity <= 0) {
        return summary;
      }

      const current = summary[line.partIndex] ?? {
        partDescription: line.partDescription,
        location: line.location,
        total: 0,
        orders: []
      };

      current.total += line.shortageQuantity;
      current.orders.push(line);
      summary[line.partIndex] = current;
      return summary;
    },
    {}
  );
}

export function canIssueToProduction(order: WeeklyOrderForIssue): boolean {
  if (order.status === "cancelled" || order.status === "issued") {
    return false;
  }

  if (!order.hasShortages) {
    return true;
  }

  return order.shortageApprovalActive;
}
