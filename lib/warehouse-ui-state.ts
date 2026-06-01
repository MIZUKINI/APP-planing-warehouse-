import type { UserRole } from "./domain";

export type AppTab = "dashboard" | "productionPlan" | "shortages" | "managerLogs" | "database";

export interface DemoUser {
  role: UserRole;
  name: string;
}

export interface ChangeLogEntry {
  id: number;
  at: string;
  user: string;
  role: UserRole;
  action: string;
  entity: string;
  previousValue: string;
  nextValue: string;
}

export interface TabSelectionResult {
  activeTab: AppTab;
  message: string;
}

export const roleLabels: Record<UserRole, string> = {
  warehouse: "Magazynier",
  planner: "Planista",
  manager: "Kierownik"
};

export const tabLabels: Record<AppTab, string> = {
  dashboard: "Dashboard",
  productionPlan: "Plan produkcyjny",
  shortages: "Lista braków",
  managerLogs: "Logi kierownika",
  database: "Baza JSON"
};

export function createDemoUser(role: UserRole): DemoUser {
  return {
    role,
    name: roleLabels[role]
  };
}

export function visibleTabsForUser(user: DemoUser | null): AppTab[] {
  const tabs: AppTab[] = ["dashboard", "productionPlan", "shortages", "database"];

  if (user?.role === "manager") {
    tabs.splice(3, 0, "managerLogs");
  }

  return tabs;
}

export function selectAppTab(tab: AppTab, user: DemoUser | null, currentTab: AppTab): TabSelectionResult {
  if (tab === "managerLogs" && user?.role !== "manager") {
    return {
      activeTab: currentTab,
      message: "Zakładka logów jest dostępna tylko po zalogowaniu jako Kierownik."
    };
  }

  return {
    activeTab: tab,
    message: `Otworzono zakładkę: ${tabLabels[tab]}.`
  };
}

export function createChangeLogEntry(
  nextId: number,
  actor: DemoUser | null,
  at: string,
  action: string,
  entity: string,
  previousValue: string,
  nextValue: string
): ChangeLogEntry {
  const user = actor ?? createDemoUser("warehouse");

  return {
    id: nextId,
    at,
    user: user.name,
    role: user.role,
    action,
    entity,
    previousValue,
    nextValue
  };
}
