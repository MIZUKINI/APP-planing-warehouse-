import { describe, expect, it } from "vitest";
import { createDemoUser, selectAppTab, visibleTabsForUser } from "@/lib/warehouse-ui-state";

describe("warehouse UI state", () => {
  it("shows manager logs only for manager", () => {
    expect(visibleTabsForUser(null)).toEqual(["dashboard", "productionPlan", "shortages", "database"]);
    expect(visibleTabsForUser(createDemoUser("warehouse"))).toEqual(["dashboard", "productionPlan", "shortages", "database"]);
    expect(visibleTabsForUser(createDemoUser("manager"))).toEqual([
      "dashboard",
      "productionPlan",
      "shortages",
      "managerLogs",
      "database"
    ]);
  });

  it("blocks manager logs for non-manager and allows regular tabs", () => {
    const warehouse = createDemoUser("warehouse");
    expect(selectAppTab("productionPlan", warehouse, "dashboard")).toEqual({
      activeTab: "productionPlan",
      message: "Otworzono zakładkę: Zlecenia tygodnia."
    });
    expect(selectAppTab("managerLogs", warehouse, "productionPlan").activeTab).toBe("productionPlan");
  });

  it("allows manager to open manager logs", () => {
    expect(selectAppTab("managerLogs", createDemoUser("manager"), "dashboard")).toEqual({
      activeTab: "managerLogs",
      message: "Otworzono zakładkę: Logi kierownika."
    });
  });
});
