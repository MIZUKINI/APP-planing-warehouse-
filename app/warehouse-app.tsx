"use client";

import { useMemo, useState } from "react";
import {
  canIssueToProduction,
  summarizeShortages,
  updatePickedQuantity,
  type OrderStatus,
  type UserRole
} from "@/lib/domain";
import { baseCartrouting, dashboardSample, shippingPlanRows } from "@/lib/sample-data";

type DemoData = typeof dashboardSample;
type DemoOrder = DemoData["orders"][number];
type DemoItem = DemoOrder["items"][number];
type AppTab = "dashboard" | "productionPlan" | "shortages" | "managerLogs" | "database";

type DemoUser = {
  role: UserRole;
  name: string;
};

type ChangeLog = {
  id: number;
  at: string;
  user: string;
  role: UserRole;
  action: string;
  entity: string;
  previousValue: string;
  nextValue: string;
};

type ArrivedState = Record<string, boolean>;

const roleLabels: Record<UserRole, string> = {
  warehouse: "Magazynier",
  planner: "Planista",
  manager: "Kierownik"
};

const tabLabels: Record<AppTab, string> = {
  dashboard: "Dashboard",
  productionPlan: "Plan produkcyjny",
  shortages: "Lista braków",
  managerLogs: "Logi kierownika",
  database: "Baza JSON"
};

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

function formatNow() {
  return new Date().toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
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
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [message, setMessage] = useState("Zaloguj się rolą demo i wybierz zakładkę.");
  const [importApproved, setImportApproved] = useState(false);

  const orders = data.orders.map((order) => ({ ...order, status: getOrderStatus(order) }));
  const selectedOrder = orders.find((order) => order.referenceNumber === selectedReference) ?? orders[0];
  const shortageLines = buildShortageLines(orders);
  const shortages = summarizeShortages(shortageLines);
  const totalTanks = orders.reduce((sum, order) => sum + order.plannedQuantity, 0);
  const issuedOrders = orders.filter((order) => order.issuedToProduction).length;
  const blockedOrders = orders.filter((order) => hasOrderShortages(order) && order.status !== "approved_with_shortages").length;

  const visibleTabs = useMemo<AppTab[]>(() => {
    const tabs: AppTab[] = ["dashboard", "productionPlan", "shortages", "database"];
    if (user?.role === "manager") {
      tabs.splice(3, 0, "managerLogs");
    }
    return tabs;
  }, [user?.role]);

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
    latestShippingPlanRows: shippingPlanRows,
    generatedWeeklyOrders: orders.map((order, index) => ({
      lp: index + 1,
      tankIndex: order.tankIndex,
      referenceNumber: order.referenceNumber,
      quantity: order.plannedQuantity,
      status: order.status
    })),
    baseCartroutings: baseCartrouting,
    uniqueCartroutingItems: uniqueCartroutingItems(orders).map((item) => ({
      partIndex: item.partIndex,
      partDescription: item.partDescription,
      location: item.location,
      quantityPerTank: item.quantityPerTank
    }))
  }), [orders]);

  function writeLog(action: string, entity: string, previousValue: string, nextValue: string) {
    const actor = user ?? { name: "Niezalogowany", role: "warehouse" as UserRole };
    setLogs((current) => [
      {
        id: current.length + 1,
        at: formatNow(),
        user: actor.name,
        role: actor.role,
        action,
        entity,
        previousValue,
        nextValue
      },
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

  function updateOrderItem(referenceNumber: string, partIndex: string, pickedQuantity: number) {
    if (!requireLogin()) return;

    const order = orders.find((candidate) => candidate.referenceNumber === referenceNumber);
    const item = order?.items.find((candidate) => candidate.partIndex === partIndex);
    const previousValue = item ? String(item.pickedQuantity) : "";

    setData((current) => ({
      ...current,
      orders: current.orders.map((candidateOrder) => {
        if (candidateOrder.referenceNumber !== referenceNumber) return candidateOrder;

        const updatedItems = candidateOrder.items.map((candidateItem) =>
          candidateItem.partIndex === partIndex ? updatePickedQuantity(candidateItem as DemoItem, pickedQuantity) : candidateItem
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
    writeLog("Zmiana ilości pobranej", `${referenceNumber} / ${partIndex}`, previousValue, String(pickedQuantity));
    setMessage(`Zapisano pobraną ilość dla ${partIndex}. Braki przeliczyły się automatycznie.`);
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
      unissueOrder(referenceNumber);
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

    setData((current) => ({
      ...current,
      orders: current.orders.map((candidate) =>
        candidate.referenceNumber === referenceNumber
          ? { ...candidate, issuedToProduction: true, status: "issued" as OrderStatus }
          : candidate
      )
    }));
    writeLog("Wydanie na produkcję", referenceNumber, "not issued", "issued");
    setMessage(`Wydano ${referenceNumber} na produkcję.`);
  }

  function unissueOrder(referenceNumber: string) {
    if (!requireLogin()) return;
    if (user?.role !== "manager") {
      setMessage("Tylko zalogowany Kierownik może cofnąć wydanie z produkcji.");
      return;
    }

    setData((current) => ({
      ...current,
      orders: current.orders.map((candidate) =>
        candidate.referenceNumber === referenceNumber
          ? { ...candidate, issuedToProduction: false, status: hasOrderShortages(candidate) ? "shortage" as OrderStatus : "completed" as OrderStatus }
          : candidate
      )
    }));
    writeLog("Cofnięcie wydania", referenceNumber, "issued", "not issued");
    setMessage(`Kierownik cofnął wydanie ${referenceNumber}.`);
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
    if (tab === "managerLogs" && user?.role !== "manager") {
      setMessage("Zakładka logów jest widoczna tylko dla Kierownika.");
      return;
    }
    setActiveTab(tab);
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MVP / tydzień {data.weekNumber} / {data.year}</p>
          <h1>Planowanie magazynu i kompletacja tygodniowa</h1>
          <p className="heroText">
            Dashboard startowy oraz osobne zakładki: plan produkcyjny, lista braków, logi Kierownika i baza JSON.
          </p>
        </div>

        <form
          className="loginCard interactiveCard"
          onSubmit={(event) => {
            event.preventDefault();
            const nextUser = { role: loginRole, name: roleLabels[loginRole] };
            setUser(nextUser);
            setMessage(`Zalogowano jako ${roleLabels[loginRole]}.`);
            writeLog("Logowanie demo", nextUser.name, "logged out", "logged in");
          }}
        >
          <span>Logowanie demo</span>
          <strong>{user ? `Zalogowano: ${user.name}` : "Wybierz rolę"}</strong>
          <label>
            Rola
            <select value={loginRole} onChange={(event) => setLoginRole(event.target.value as UserRole)}>
              <option value="warehouse">Magazynier</option>
              <option value="planner">Planista</option>
              <option value="manager">Kierownik</option>
            </select>
          </label>
          <div className="buttonRow">
            <button className="primaryButton" type="submit">Zaloguj</button>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                writeLog("Wylogowanie demo", user?.name ?? "brak", "logged in", "logged out");
                setUser(null);
                if (activeTab === "managerLogs") setActiveTab("dashboard");
                setMessage("Wylogowano.");
              }}
            >
              Wyloguj
            </button>
          </div>
        </form>
      </section>

      <nav className="tabBar" aria-label="Zakładki aplikacji">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? "tabButton active" : "tabButton"}
            type="button"
            onClick={() => selectTab(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </nav>

      <p className="messageBar" role="status">{message}</p>

      {activeTab === "dashboard" ? (
        <>
          <section className="grid stats" aria-label="Podsumowanie tygodnia">
            <article><span>Zlecenia</span><strong>{orders.length}</strong></article>
            <article><span>Suma zbiorników</span><strong>{totalTanks}</strong></article>
            <article><span>Części z brakami</span><strong>{Object.keys(shortages).length}</strong></article>
            <article><span>Wydane</span><strong>{issuedOrders}</strong></article>
            <article><span>Blokady Kierownika</span><strong>{blockedOrders}</strong></article>
          </section>

          <section className="panel">
            <div className="panelHeader responsiveHeader">
              <div>
                <p className="eyebrow">Import Excel</p>
                <h2>Mapowanie planu wysyłek</h2>
                <p className="muted">Kliknij zatwierdzenie jako Planista albo Kierownik — Magazynier zostanie zablokowany.</p>
              </div>
              <div className="buttonRow">
                <span className={`badge ${importApproved ? "badgeOk" : ""}`}>{importApproved ? "Import zatwierdzony" : ".xls · .xlsx · .xlsm"}</span>
                <button className="primaryButton" type="button" onClick={approveImport}>Zatwierdź import</button>
              </div>
            </div>
            <div className="mappingGrid">
              <div><span>Arkusz</span><strong>wymagane mapowanie</strong></div>
              <div><span>Kolumna zbiornika</span><strong>A</strong></div>
              <div><span>Tydzień</span><strong>5 dni + separator</strong></div>
              <div><span>Daty</span><strong>dzień-miesiąc</strong></div>
              <div><span>Formuły</span><strong>czytamy wynik</strong></div>
              <div><span>Puste komórki</span><strong>brak wysyłki</strong></div>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "productionPlan" ? (
        <section className="panel">
          <div className="panelHeader responsiveHeader">
            <div>
              <p className="eyebrow">Plan produkcyjny</p>
              <h2>Lista wózków do zebrania — tydzień {data.weekNumber}/{data.year}</h2>
              <p className="muted">Osobna tabela dla tygodnia. LP i numer referencyjny podstawiają się automatycznie.</p>
            </div>
            <div className="toolbar">
              <input
                aria-label="Filtr planu produkcyjnego"
                placeholder="Filtr: nr ref., index, status..."
                value={orderFilter}
                onChange={(event) => setOrderFilter(event.target.value)}
              />
              <button className="primaryButton" type="button" onClick={printPdfPreview}>Drukuj / PDF A4</button>
            </div>
          </div>

          <div className="weekLinkBox">
            <button className="linkButton" type="button">Tydzień {data.weekNumber}/{data.year}</button>
            <span>Po zaimportowaniu kolejnych tygodni tutaj pojawią się kolejne odnośniki jak w spisie pliku Word.</span>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>LP</th>
                  <th>Index zbiornika</th>
                  <th>Numer ref.</th>
                  <th>Ilość</th>
                  <th>Braki</th>
                  <th>Wydanie na produkcję</th>
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
                      <td>
                        {hasShortages
                          ? order.items.filter((item) => item.shortageQuantity > 0).map((item) => `${item.partIndex} - ${item.shortageQuantity}`).join("; ")
                          : "Brak"}
                      </td>
                      <td>
                        <label className="checkboxLabel">
                          <input
                            checked={order.issuedToProduction}
                            type="checkbox"
                            onChange={(event) => issueOrder(order.referenceNumber, event.target.checked)}
                          />
                          {order.issuedToProduction ? "Wydane" : hasShortages ? "Blokada braków" : "Do wydania"}
                        </label>
                        {hasShortages && order.status !== "approved_with_shortages" ? (
                          <button className="secondaryButton compactButton" type="button" onClick={() => approveShortages(order.referenceNumber)}>
                            Zatwierdź braki
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="columns innerColumns">
            <article className="subPanel">
              <p className="eyebrow">Cartrouting zlecenia</p>
              <h3>{selectedOrder.referenceNumber} · {selectedOrder.tankIndex}</h3>
              <p className="muted">Zmień „picked”, żeby przeliczyć braki dla wybranego zlecenia.</p>
              <div className="cards">
                {selectedOrder.items.map((item) => (
                  <div className="partCard editablePart" key={item.partIndex}>
                    <div>
                      <span>{item.partIndex}</span>
                      <strong>{item.partDescription}</strong>
                      <small>{item.location} · per tank {item.quantityPerTank} · required {item.requiredQuantity}</small>
                    </div>
                    <label>
                      Picked
                      <input
                        type="number"
                        min="0"
                        value={item.pickedQuantity}
                        onChange={(event) => updateOrderItem(selectedOrder.referenceNumber, item.partIndex, Number(event.target.value))}
                      />
                    </label>
                    <span className={`status ${item.shortageQuantity > 0 ? "warning" : "ok"}`}>
                      Brak: {item.shortageQuantity}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "shortages" ? (
        <section className="panel">
          <div className="panelHeader responsiveHeader">
            <div>
              <p className="eyebrow">Lista braków</p>
              <h2>Brakujące elementy ze wszystkich zleceń</h2>
              <p className="muted">Kliknięcie indeksu braku pokazuje, w jakich numerach referencyjnych występuje ten sam element.</p>
            </div>
            <div className="toolbar">
              <input
                aria-label="Filtr braków"
                placeholder="Filtr: indeks braku, zbiornik, numer ref..."
                value={shortageFilter}
                onChange={(event) => setShortageFilter(event.target.value)}
              />
              <label className="checkboxLabel inlineCheckbox">
                <input
                  checked={showArrivedShortages}
                  type="checkbox"
                  onChange={(event) => setShowArrivedShortages(event.target.checked)}
                />
                Pokaż dojechane
              </label>
            </div>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Index braku</th>
                  <th>Indeks zbiornika</th>
                  <th>Numer referencyjny</th>
                  <th>Ilość</th>
                  <th>Data dodania</th>
                  <th>Czy dojechało</th>
                </tr>
              </thead>
              <tbody>
                {shortageRows.map((row) => (
                  <tr key={row.key} className={selectedShortageIndex === row.partIndex ? "selectedRow" : ""}>
                    <td>
                      <button className="tableLink" type="button" onClick={() => setSelectedShortageIndex(row.partIndex)}>
                        {row.partIndex}
                      </button>
                    </td>
                    <td>{row.tankIndex}</td>
                    <td>{row.referenceNumber}</td>
                    <td>{row.shortageQuantity}</td>
                    <td>{new Date(row.addedAt).toLocaleDateString("pl-PL")}</td>
                    <td>
                      <label className="checkboxLabel">
                        <input checked={row.arrived} type="checkbox" onChange={(event) => toggleArrivedShortage(row.key, event.target.checked)} />
                        {row.arrived ? "Dojechało" : "Czeka"}
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="columns innerColumns">
            <article className="subPanel">
              <p className="eyebrow">Szczegóły indeksu braku</p>
              <h3>{selectedShortageIndex || "Wybierz indeks braku"}</h3>
              {selectedShortageDetails.length ? (
                <ul className="shortageOrders">
                  {selectedShortageDetails.map((row) => (
                    <li key={`${row.key}-detail`}>{row.referenceNumber} · {row.tankIndex} · ilość {row.shortageQuantity}</li>
                  ))}
                </ul>
              ) : <p className="muted">Kliknij indeks braku w tabeli, aby zobaczyć listę zleceń.</p>}
            </article>
            <article className="subPanel">
              <p className="eyebrow">Ostatnie zmiany braków</p>
              <h3>Log lokalny</h3>
              <div className="miniLogList">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id}>
                    <strong>{log.action}</strong>
                    <small>{log.user} · {log.at} · {log.previousValue} → {log.nextValue}</small>
                  </div>
                ))}
                {!logs.length ? <p className="muted">Brak zmian w tej sesji.</p> : null}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "managerLogs" && user?.role === "manager" ? (
        <section className="panel">
          <div className="panelHeader responsiveHeader">
            <div>
              <p className="eyebrow">Logi kierownika</p>
              <h2>Podgląd zmian w sesji</h2>
              <p className="muted">Zakładka widoczna tylko po zalogowaniu jako Kierownik.</p>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Czas</th>
                  <th>Użytkownik</th>
                  <th>Akcja</th>
                  <th>Obiekt</th>
                  <th>Poprzednia wersja</th>
                  <th>Nowa wersja</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.at}</td>
                    <td>{log.user}</td>
                    <td>{log.action}</td>
                    <td>{log.entity}</td>
                    <td>{log.previousValue}</td>
                    <td>{log.nextValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!logs.length ? <p className="muted">Brak logów — wykonaj kilka akcji w planie lub brakach.</p> : null}
        </section>
      ) : null}

      {activeTab === "database" ? (
        <section className="panel">
          <div className="panelHeader responsiveHeader">
            <div>
              <p className="eyebrow">Baza JSON</p>
              <h2>Ostatnio pobrane dane i bazowe cartroutingi</h2>
              <p className="muted">Widok techniczny: plan wysyłek, wygenerowane zlecenia, bazowe cartroutingi i unikatowe elementy.</p>
            </div>
          </div>
          <pre className="jsonPreview">{JSON.stringify(databasePreview, null, 2)}</pre>
        </section>
      ) : null}
    </main>
  );
}
