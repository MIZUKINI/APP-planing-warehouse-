"use client";

import { useMemo, useState } from "react";
import { canIssueToProduction, summarizeShortages, updatePickedQuantity, type OrderStatus, type UserRole } from "@/lib/domain";
import { baseCartrouting, dashboardSample, productionRecords, shippingPlanRows } from "@/lib/sample-data";
import {
  createChangeLogEntry,
  createDemoUser,
  roleLabels,
  selectAppTab,
  tabLabels,
  visibleTabsForUser,
  type AppTab,
  type ChangeLogEntry,
  type DemoUser
} from "@/lib/warehouse-ui-state";

type DemoData = typeof dashboardSample;
type DemoOrder = DemoData["orders"][number];
type DemoItem = DemoOrder["items"][number];
type ArrivedState = Record<string, boolean>;

type PendingQuantityEdit = {
  referenceNumber: string;
  partIndex: string;
  previousValue: number;
  nextValue: number;
} | null;

type PendingUnissue = {
  referenceNumber: string;
  password: string;
} | null;

const MANAGER_PASSWORD = "admin123";

function cloneDemoData(): DemoData {
  return JSON.parse(JSON.stringify(dashboardSample)) as DemoData;
}

function hasOrderShortages(order: DemoOrder) {
  return order.items.some((item) => item.shortageQuantity > 0);
}

function getOrderStatus(order: DemoOrder): OrderStatus {
  if (order.issuedToProduction) return "issued";
  if (order.status === "approved_with_shortages" && hasOrderShortages(order)) return "approved_with_shortages";
  if (hasOrderShortages(order)) return "shortage";
  if (order.items.every((item) => item.isCompleted)) return "completed";
  return "picking";
}

function statusLabel(status: OrderStatus) {
  const labels: Partial<Record<OrderStatus, string>> = {
    picking: "W kompletacji",
    completed: "Skompletowane",
    shortage: "Braki",
    approved_with_shortages: "Braki zatwierdzone",
    issued: "Wydane",
    awaiting_manager_approval: "Czeka na kierownika",
    new: "Nowe",
    ready_for_picking: "Gotowe do zbiórki",
    cancelled: "Anulowane"
  };

  return labels[status] ?? status;
}

function statusClass(status: OrderStatus) {
  if (status === "issued" || status === "completed") return "ok";
  if (status === "shortage" || status === "awaiting_manager_approval") return "warning";
  if (status === "approved_with_shortages") return "notice";
  return "neutral";
}

function buildShortageLines(orders: DemoOrder[]) {
  return orders.flatMap((order) =>
    order.items
      .filter((item) => item.shortageQuantity > 0)
      .map((item) => ({
        referenceNumber: order.referenceNumber,
        tankIndex: order.tankIndex,
        partIndex: item.partIndex,
        partDescription: item.partDescription,
        location: item.location,
        shortageQuantity: item.shortageQuantity
      }))
  );
}

function shortageKey(partIndex: string, referenceNumber: string) {
  return `${partIndex}::${referenceNumber}`;
}

function formatDateTime(value = new Date()) {
  return value.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function uniqueCartroutingItems(orders: DemoOrder[]) {
  const items = new Map<string, DemoItem>();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (!items.has(item.partIndex)) {
        items.set(item.partIndex, item);
      }
    });
  });

  return Array.from(items.values());
}

export function WarehouseApp() {
  const [data, setData] = useState<DemoData>(() => cloneDemoData());
  const [activeTab, setActiveTab] = useState<AppTab>("dashboard");
  const [loginRole, setLoginRole] = useState<UserRole>("warehouse");
  const [user, setUser] = useState<DemoUser | null>(null);
  const [selectedReference, setSelectedReference] = useState(data.orders[0]?.referenceNumber ?? "");
  const [selectedShortageIndex, setSelectedShortageIndex] = useState("");
  const [orderFilter, setOrderFilter] = useState("");
  const [shortageFilter, setShortageFilter] = useState("");
  const [showArrivedShortages, setShowArrivedShortages] = useState(true);
  const [arrivedShortages, setArrivedShortages] = useState<ArrivedState>({});
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [message, setMessage] = useState("Zaloguj się rolą demo i zacznij od Dashboardu.");
  const [importApproved, setImportApproved] = useState(false);
  const [pendingEdit, setPendingEdit] = useState<PendingQuantityEdit>(null);
  const [pendingUnissue, setPendingUnissue] = useState<PendingUnissue>(null);

  const orders = data.orders.map((order) => ({ ...order, status: getOrderStatus(order) }));
  const selectedOrder = orders.find((order) => order.referenceNumber === selectedReference) ?? orders[0];
  const shortageLines = buildShortageLines(orders);
  const shortages = summarizeShortages(shortageLines);
  const totalTanks = orders.reduce((sum, order) => sum + order.plannedQuantity, 0);
  const issuedOrders = orders.filter((order) => order.issuedToProduction).length;
  const completedOrders = orders.filter((order) => order.status === "completed" || order.status === "issued").length;
  const blockedOrders = orders.filter((order) => hasOrderShortages(order) && order.status !== "approved_with_shortages").length;
  const visibleTabs = useMemo(() => visibleTabsForUser(user), [user]);

  const filteredOrders = useMemo(() => {
    const query = orderFilter.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [order.referenceNumber, order.tankIndex, order.status, order.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [orderFilter, orders]);

  const shortageRows = useMemo(() => {
    const query = shortageFilter.trim().toLowerCase();

    return shortageLines
      .map((line) => ({
        ...line,
        key: shortageKey(line.partIndex, line.referenceNumber),
        arrived: arrivedShortages[shortageKey(line.partIndex, line.referenceNumber)] ?? false,
        addedAt: data.importedAt
      }))
      .filter((line) => showArrivedShortages || !line.arrived)
      .filter((line) => {
        if (!query) return true;
        return [line.partIndex, line.tankIndex, line.referenceNumber, line.partDescription]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [arrivedShortages, data.importedAt, shortageFilter, shortageLines, showArrivedShortages]);

  const selectedShortageDetails = useMemo(() => {
    if (!selectedShortageIndex) return [];
    return shortageRows.filter((row) => row.partIndex === selectedShortageIndex);
  }, [selectedShortageIndex, shortageRows]);

  const databasePreview = useMemo(() => ({
    latestProductionRecords: productionRecords,
    latestShippingPlanRows: shippingPlanRows,
    generatedWeeklyOrders: orders.map((order, index) => ({
      lp: index + 1,
      tankIndex: order.tankIndex,
      referenceNumber: order.referenceNumber,
      quantity: order.plannedQuantity,
      status: order.status,
      issuedAt: order.issuedAt
    })),
    baseCartroutings: baseCartrouting,
    uniqueCartroutingItems: uniqueCartroutingItems(orders).map((item) => ({
      partIndex: item.partIndex,
      partDescription: item.partDescription,
      location: item.location,
      quantityPerTank: item.quantityPerTank
    }))
  }), [orders]);

  function writeLog(action: string, entity: string, previousValue: string, nextValue: string, actor = user) {
    setLogs((current) => [
      createChangeLogEntry(current.length + 1, actor, formatDateTime(), action, entity, previousValue, nextValue),
      ...current
    ]);
  }

  function requireLogin() {
    if (user) return true;
    setMessage("Najpierw zaloguj się jedną z ról demo.");
    return false;
  }

  function approveImport() {
    if (!requireLogin()) return;
    if (user?.role === "warehouse") {
      setMessage("Magazynier nie może zatwierdzać importu. Wybierz Planistę albo Kierownika.");
      return;
    }

    setImportApproved(true);
    writeLog("Zatwierdzenie importu", `Tydzień ${data.weekNumber}/${data.year}`, "draft", "approved");
    setMessage(`${roleLabels[user.role]} zatwierdził mapowanie i import demo.`);
  }

  function requestQuantityEdit(referenceNumber: string, partIndex: string, previousValue: number, nextValue: number) {
    if (!requireLogin()) return;
    setPendingEdit({ referenceNumber, partIndex, previousValue, nextValue });
  }

  function confirmQuantityEdit() {
    if (!pendingEdit) return;

    setData((current) => ({
      ...current,
      orders: current.orders.map((candidateOrder) => {
        if (candidateOrder.referenceNumber !== pendingEdit.referenceNumber) return candidateOrder;

        const updatedItems = candidateOrder.items.map((candidateItem) =>
          candidateItem.partIndex === pendingEdit.partIndex ? updatePickedQuantity(candidateItem as DemoItem, pendingEdit.nextValue) : candidateItem
        );
        const updatedOrder = { ...candidateOrder, items: updatedItems };
        const status: OrderStatus = hasOrderShortages(updatedOrder)
          ? "shortage"
          : updatedItems.every((candidateItem) => candidateItem.isCompleted)
            ? "completed"
            : "picking";

        return {
          ...updatedOrder,
          status
        };
      })
    }));
    writeLog("Zmiana ilości pobranej", `${pendingEdit.referenceNumber} / ${pendingEdit.partIndex}`, String(pendingEdit.previousValue), String(pendingEdit.nextValue));
    setMessage(`Zapisano pobraną ilość dla ${pendingEdit.partIndex}. Braki przeliczyły się automatycznie.`);
    setPendingEdit(null);
  }

  function approveShortages(referenceNumber: string) {
    if (!requireLogin()) return;
    if (user?.role !== "manager") {
      setMessage("Tylko Kierownik może zatwierdzić wydanie mimo braków.");
      return;
    }

    setData((current) => ({
      ...current,
      orders: current.orders.map((order) =>
        order.referenceNumber === referenceNumber ? { ...order, status: "approved_with_shortages" as OrderStatus } : order
      )
    }));
    writeLog("Zatwierdzenie braków", referenceNumber, "blocked", "approved_with_shortages");
    setMessage(`Kierownik zatwierdził wydanie mimo braków dla ${referenceNumber}.`);
  }

  function issueOrder(referenceNumber: string, checked: boolean) {
    if (!requireLogin()) return;

    const order = orders.find((candidate) => candidate.referenceNumber === referenceNumber);
    if (!order) return;

    if (!checked) {
      setPendingUnissue({ referenceNumber, password: "" });
      return;
    }

    const canIssue = canIssueToProduction({
      status: order.status,
      hasShortages: hasOrderShortages(order),
      shortageApprovalActive: order.status === "approved_with_shortages"
    });

    if (!canIssue) {
      setMessage(`Nie można wydać ${referenceNumber}: zlecenie ma braki i wymaga zatwierdzenia Kierownika.`);
      return;
    }

    const issuedAt = formatDateTime();
    setData((current) => ({
      ...current,
      orders: current.orders.map((candidate) =>
        candidate.referenceNumber === referenceNumber
          ? { ...candidate, issuedToProduction: true, issuedAt, status: "issued" as OrderStatus }
          : candidate
      )
    }));
    writeLog("Wydanie na produkcję", referenceNumber, "not issued", `issued ${issuedAt}`);
    setMessage(`Wydano ${referenceNumber} na produkcję.`);
  }

  function confirmUnissueOrder() {
    if (!pendingUnissue) return;
    if (!requireLogin()) return;
    if (user?.role !== "manager") {
      setMessage("Tylko zalogowany Kierownik może cofnąć wydanie z produkcji.");
      setPendingUnissue(null);
      return;
    }
    if (pendingUnissue.password !== MANAGER_PASSWORD) {
      setMessage("Błędne hasło Kierownika. W MVP hasło testowe to admin123.");
      return;
    }

    setData((current) => ({
      ...current,
      orders: current.orders.map((candidate) =>
        candidate.referenceNumber === pendingUnissue.referenceNumber
          ? { ...candidate, issuedToProduction: false, issuedAt: null, status: hasOrderShortages(candidate) ? "shortage" as OrderStatus : "completed" as OrderStatus }
          : candidate
      )
    }));
    writeLog("Cofnięcie wydania", pendingUnissue.referenceNumber, "issued", "not issued");
    setMessage(`Kierownik cofnął wydanie ${pendingUnissue.referenceNumber}.`);
    setPendingUnissue(null);
  }

  function toggleArrivedShortage(rowKey: string, checked: boolean) {
    if (!requireLogin()) return;
    const row = shortageRows.find((candidate) => candidate.key === rowKey);

    setArrivedShortages((current) => ({
      ...current,
      [rowKey]: checked
    }));
    writeLog("Zmiana statusu braku", row?.partIndex ?? rowKey, String(row?.arrived ?? false), String(checked));
    setMessage(checked ? "Oznaczono brak jako dojechał." : "Cofnięto oznaczenie dojechania braku.");
  }

  function printPdfPreview() {
    if (!requireLogin()) return;
    setMessage("Otwieram systemowy podgląd wydruku. W MVP to symuluje PDF A4.");
    window.print();
  }

  function selectTab(tab: AppTab) {
    const result = selectAppTab(tab, user, activeTab);
    setActiveTab(result.activeTab);
    setMessage(result.message);
  }

  function loginAsDemoRole() {
    const nextUser = createDemoUser(loginRole);
    setUser(nextUser);
    setMessage(`Zalogowano jako ${nextUser.name}.`);
    writeLog("Logowanie demo", nextUser.name, "logged out", "logged in", nextUser);
  }

  return (
    <main className="appShell">
      <aside className="sidebar printHidden">
        <div>
          <p className="eyebrow">MagPlan MVP</p>
          <h1>Plan kompletacji</h1>
          <p className="heroText">Tydzień {data.weekNumber}/{data.year}. Podstawa aplikacji do planu, kompletacji, braków i wydań na produkcję.</p>
        </div>

        <nav className="sideNav" aria-label="Zakładki aplikacji">
          {visibleTabs.map((tab) => (
            <button key={tab} className={activeTab === tab ? "sideNavButton active" : "sideNavButton"} type="button" onClick={() => selectTab(tab)}>
              {tabLabels[tab]}
            </button>
          ))}
        </nav>

        <div className="loginCard interactiveCard">
          <span>Logowanie demo</span>
          <strong>{user ? user.name : "Wybierz rolę"}</strong>
          <label>
            Rola
            <select value={loginRole} onChange={(event) => setLoginRole(event.target.value as UserRole)}>
              <option value="warehouse">Magazynier</option>
              <option value="planner">Planista</option>
              <option value="manager">Kierownik</option>
            </select>
          </label>
          <div className="buttonRow">
            <button className="primaryButton" type="button" onClick={loginAsDemoRole}>Zaloguj</button>
            <button className="secondaryButton" type="button" onClick={() => {
              writeLog("Wylogowanie demo", user?.name ?? "brak", "logged in", "logged out", user);
              setUser(null);
              if (activeTab === "managerLogs") setActiveTab("dashboard");
              setMessage("Wylogowano.");
            }}>Wyloguj</button>
          </div>
        </div>
      </aside>

      <section className="contentArea">
        <header className="topBar printHidden">
          <div>
            <p className="eyebrow">{tabLabels[activeTab]}</p>
            <h2>MagPlan — magazyn produkcyjny</h2>
          </div>
          <div className="topBarMeta">
            <span className={`badge ${importApproved ? "badgeOk" : ""}`}>{importApproved ? "Import zatwierdzony" : "Dane demo"}</span>
            <span className="badge">{user ? roleLabels[user.role] : "Niezalogowany"}</span>
          </div>
        </header>

        <p className="messageBar printHidden" role="status">{message}</p>

        {activeTab === "dashboard" ? (
          <>
            <section className="grid stats" aria-label="Podsumowanie tygodnia">
              <article><span>Zlecenia</span><strong>{orders.length}</strong></article>
              <article><span>Komplety</span><strong>{totalTanks}</strong></article>
              <article><span>Skompletowane</span><strong>{completedOrders}</strong></article>
              <article><span>Braki</span><strong>{Object.keys(shortages).length}</strong></article>
              <article><span>Wydane</span><strong>{issuedOrders}</strong></article>
            </section>

            <section className="panel">
              <div className="panelHeader responsiveHeader">
                <div>
                  <p className="eyebrow">Import Excel</p>
                  <h2>Mapowanie planu wysyłek</h2>
                  <p className="muted">Na tym etapie parser ma przygotowane miejsce w kodzie, a UI działa na danych testowych. Planista albo Kierownik może zatwierdzić import demo.</p>
                </div>
                <div className="buttonRow">
                  <button className="primaryButton" type="button" onClick={approveImport}>Zatwierdź import</button>
                  <button className="secondaryButton" type="button" onClick={() => selectTab("productionPlan")}>Przejdź do zleceń</button>
                </div>
              </div>
              <div className="mappingGrid">
                <div><span>Arkusz Excel</span><strong>plan tygodniowy</strong></div>
                <div><span>Kolumna zbiornika</span><strong>A</strong></div>
                <div><span>Wiersz tygodni</span><strong>3</strong></div>
                <div><span>Agregacja</span><strong>suma dni tygodnia</strong></div>
                <div><span>Numer ref.</span><strong>T23/01/2026</strong></div>
                <div><span>Druk</span><strong>A4 przez przeglądarkę</strong></div>
              </div>
            </section>

            <section className="panel">
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">Ostatnie aktywności</p>
                  <h2>Log sesji</h2>
                </div>
              </div>
              <div className="miniLogList">
                {logs.slice(0, 6).map((log) => (
                  <div key={log.id}><strong>{log.action}</strong><small>{log.user} · {log.at} · {log.entity}</small></div>
                ))}
                {!logs.length ? <p className="muted">Brak zmian — zaloguj się i wykonaj akcję w aplikacji.</p> : null}
              </div>
            </section>
          </>
        ) : null}

        {activeTab === "productionPlan" ? (
          <section className="panel printSection">
            <div className="panelHeader responsiveHeader printHidden">
              <div>
                <p className="eyebrow">Zlecenia tygodnia</p>
                <h2>Lista wózków do zebrania — tydzień {data.weekNumber}/{data.year}</h2>
                <p className="muted">Kliknij numer referencyjny, aby podejrzeć cartrouting i wpisać ilości faktycznie pobrane.</p>
              </div>
              <div className="toolbar">
                <input aria-label="Filtr planu" placeholder="Filtr: nr ref., index, status..." value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} />
                <button className="primaryButton" type="button" onClick={printPdfPreview}>Drukuj / PDF A4</button>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>LP</th>
                    <th>Index zbiornika</th>
                    <th>Numer ref.</th>
                    <th>Ilość</th>
                    <th>Status</th>
                    <th>Braki</th>
                    <th>Wydane / data</th>
                    <th>Uwagi</th>
                    <th>Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => {
                    const hasShortages = hasOrderShortages(order);
                    return (
                      <tr key={order.referenceNumber} className={selectedReference === order.referenceNumber ? "selectedRow" : ""}>
                        <td>{index + 1}</td>
                        <td>{order.tankIndex}</td>
                        <td><button className="tableLink" type="button" onClick={() => setSelectedReference(order.referenceNumber)}>{order.referenceNumber}</button></td>
                        <td>{order.plannedQuantity}</td>
                        <td><span className={`status ${statusClass(order.status)}`}>{statusLabel(order.status)}</span></td>
                        <td>{hasShortages ? order.items.filter((item) => item.shortageQuantity > 0).map((item) => `${item.partIndex}: ${item.shortageQuantity}`).join("; ") : "Brak"}</td>
                        <td>{order.issuedToProduction ? order.issuedAt ?? "tak" : "Nie"}</td>
                        <td>{order.notes}</td>
                        <td>
                          <label className="checkboxLabel">
                            <input checked={order.issuedToProduction} type="checkbox" onChange={(event) => issueOrder(order.referenceNumber, event.target.checked)} />
                            {order.issuedToProduction ? "Cofnij" : "Wydaj"}
                          </label>
                          {hasShortages && order.status !== "approved_with_shortages" ? (
                            <button className="secondaryButton compactButton" type="button" onClick={() => approveShortages(order.referenceNumber)}>Zatwierdź braki</button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {selectedOrder ? (
              <article className="subPanel orderDetails">
                <div className="panelHeader responsiveHeader">
                  <div>
                    <p className="eyebrow">Cartrouting zlecenia</p>
                    <h3>{selectedOrder.referenceNumber} · {selectedOrder.tankIndex}</h3>
                    <p className="muted">Ilość wymagana = liczba kompletów × ilość na 1 komplet.</p>
                  </div>
                  <span className={`status ${statusClass(selectedOrder.status)}`}>{statusLabel(selectedOrder.status)}</span>
                </div>
                <div className="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Linia</th>
                        <th>Indeks części</th>
                        <th>Nazwa</th>
                        <th>Lokalizacja</th>
                        <th>Na komplet</th>
                        <th>Wymagane</th>
                        <th>Pobrane</th>
                        <th>Brak</th>
                        <th>Zebrane</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((item) => (
                        <tr key={item.partIndex}>
                          <td>{item.lineNo}</td>
                          <td>{item.partIndex}</td>
                          <td>{item.partDescription}</td>
                          <td>{item.location}</td>
                          <td>{item.quantityPerTank}</td>
                          <td>{item.requiredQuantity}</td>
                          <td>
                            <input className="quantityInput" type="number" min="0" value={item.pickedQuantity} onChange={(event) => requestQuantityEdit(selectedOrder.referenceNumber, item.partIndex, item.pickedQuantity, Number(event.target.value))} />
                          </td>
                          <td><span className={`status ${item.shortageQuantity > 0 ? "warning" : "ok"}`}>{item.shortageQuantity}</span></td>
                          <td>{item.isCompleted ? "Tak" : "Nie"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {activeTab === "shortages" ? (
          <section className="panel printSection">
            <div className="panelHeader responsiveHeader printHidden">
              <div>
                <p className="eyebrow">Lista braków</p>
                <h2>Brakujące elementy ze wszystkich zleceń</h2>
                <p className="muted">Widok zbiera braki z każdej karty kompletacji i pozwala oznaczyć, że brak dojechał.</p>
              </div>
              <div className="toolbar">
                <input aria-label="Filtr braków" placeholder="Filtr: indeks, zbiornik, nr ref..." value={shortageFilter} onChange={(event) => setShortageFilter(event.target.value)} />
                <label className="checkboxLabel inlineCheckbox"><input checked={showArrivedShortages} type="checkbox" onChange={(event) => setShowArrivedShortages(event.target.checked)} />Pokaż dojechane</label>
              </div>
            </div>

            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Index braku</th>
                    <th>Indeks zbiornika</th>
                    <th>Numer ref.</th>
                    <th>Ilość</th>
                    <th>Data dodania</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shortageRows.map((row) => (
                    <tr key={row.key} className={selectedShortageIndex === row.partIndex ? "selectedRow" : ""}>
                      <td><button className="tableLink" type="button" onClick={() => setSelectedShortageIndex(row.partIndex)}>{row.partIndex}</button></td>
                      <td>{row.tankIndex}</td>
                      <td>{row.referenceNumber}</td>
                      <td>{row.shortageQuantity}</td>
                      <td>{new Date(row.addedAt).toLocaleDateString("pl-PL")}</td>
                      <td><label className="checkboxLabel"><input checked={row.arrived} type="checkbox" onChange={(event) => toggleArrivedShortage(row.key, event.target.checked)} />{row.arrived ? "Dojechało" : "Czeka"}</label></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="columns innerColumns printHidden">
              <article className="subPanel">
                <p className="eyebrow">Szczegóły indeksu braku</p>
                <h3>{selectedShortageIndex || "Wybierz indeks braku"}</h3>
                {selectedShortageDetails.length ? (
                  <ul className="shortageOrders">
                    {selectedShortageDetails.map((row) => <li key={`${row.key}-detail`}>{row.referenceNumber} · {row.tankIndex} · ilość {row.shortageQuantity}</li>)}
                  </ul>
                ) : <p className="muted">Kliknij indeks braku w tabeli, aby zobaczyć listę zleceń.</p>}
              </article>
              <article className="subPanel">
                <p className="eyebrow">Suma braków per część</p>
                <div className="miniLogList">
                  {Object.entries(shortages).map(([partIndex, summary]) => <div key={partIndex}><strong>{partIndex}: {summary.total}</strong><small>{summary.partDescription} · {summary.location}</small></div>)}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {activeTab === "managerLogs" && user?.role === "manager" ? (
          <section className="panel">
            <div className="panelHeader responsiveHeader"><div><p className="eyebrow">Logi kierownika</p><h2>Podgląd zmian w sesji</h2><p className="muted">Zakładka widoczna tylko po zalogowaniu jako Kierownik.</p></div></div>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Czas</th><th>Użytkownik</th><th>Akcja</th><th>Obiekt</th><th>Poprzednio</th><th>Nowo</th></tr></thead>
                <tbody>{logs.map((log) => <tr key={log.id}><td>{log.at}</td><td>{log.user}</td><td>{log.action}</td><td>{log.entity}</td><td>{log.previousValue}</td><td>{log.nextValue}</td></tr>)}</tbody>
              </table>
            </div>
            {!logs.length ? <p className="muted">Brak logów — wykonaj kilka akcji w planie lub brakach.</p> : null}
          </section>
        ) : null}

        {activeTab === "database" ? (
          <section className="panel">
            <div className="panelHeader responsiveHeader"><div><p className="eyebrow">Baza techniczna</p><h2>Dane demo i przygotowanie pod import Excela</h2><p className="muted">Widok techniczny: plan wysyłek, wygenerowane zlecenia, bazowe cartroutingi i unikatowe elementy.</p></div></div>
            <pre className="jsonPreview">{JSON.stringify(databasePreview, null, 2)}</pre>
          </section>
        ) : null}
      </section>

      {pendingEdit ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <p className="eyebrow">Potwierdzenie zmiany</p>
            <h2>Zmienić ilość pobraną?</h2>
            <p>Pozycja <strong>{pendingEdit.partIndex}</strong> w zleceniu <strong>{pendingEdit.referenceNumber}</strong>: {pendingEdit.previousValue} → {pendingEdit.nextValue}.</p>
            <div className="buttonRow"><button className="primaryButton" type="button" onClick={confirmQuantityEdit}>Tak, zapisz</button><button className="secondaryButton" type="button" onClick={() => setPendingEdit(null)}>Anuluj</button></div>
          </div>
        </div>
      ) : null}

      {pendingUnissue ? (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modalCard">
            <p className="eyebrow">Hasło kierownika</p>
            <h2>Cofnięcie wydania na produkcję</h2>
            <p>Ta akcja wymaga roli Kierownik i hasła testowego. W MVP hasło to <strong>admin123</strong>.</p>
            <label>Hasło<input type="password" value={pendingUnissue.password} onChange={(event) => setPendingUnissue({ ...pendingUnissue, password: event.target.value })} /></label>
            <div className="buttonRow"><button className="dangerButton" type="button" onClick={confirmUnissueOrder}>Cofnij wydanie</button><button className="secondaryButton" type="button" onClick={() => setPendingUnissue(null)}>Anuluj</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
