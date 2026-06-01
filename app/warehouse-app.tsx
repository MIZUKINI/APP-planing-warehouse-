"use client";

import { useMemo, useState } from "react";
import { canIssueToProduction, summarizeShortages, updatePickedQuantity, type OrderStatus, type UserRole } from "@/lib/domain";
import { dashboardSample } from "@/lib/sample-data";

type DemoData = typeof dashboardSample;
type DemoOrder = DemoData["orders"][number];
type DemoItem = DemoOrder["items"][number];

type DemoUser = {
  role: UserRole;
  name: string;
};

const roleLabels: Record<UserRole, string> = {
  warehouse: "Magazynier",
  planner: "Planista",
  manager: "Kierownik"
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

export function WarehouseApp() {
  const [data, setData] = useState<DemoData>(() => cloneDemoData());
  const [loginRole, setLoginRole] = useState<UserRole>("warehouse");
  const [user, setUser] = useState<DemoUser | null>(null);
  const [selectedReference, setSelectedReference] = useState(data.orders[0]?.referenceNumber ?? "");
  const [orderFilter, setOrderFilter] = useState("");
  const [shortageFilter, setShortageFilter] = useState("");
  const [message, setMessage] = useState("Zaloguj się rolą demo i klikaj akcje w tabelach.");
  const [importApproved, setImportApproved] = useState(false);

  const orders = data.orders.map((order) => ({ ...order, status: getOrderStatus(order) }));
  const selectedOrder = orders.find((order) => order.referenceNumber === selectedReference) ?? orders[0];
  const shortageLines = buildShortageLines(orders);
  const shortages = summarizeShortages(shortageLines);
  const totalTanks = orders.reduce((sum, order) => sum + order.plannedQuantity, 0);
  const issuedOrders = orders.filter((order) => order.issuedToProduction).length;
  const blockedOrders = orders.filter((order) => hasOrderShortages(order) && order.status !== "approved_with_shortages").length;

  const filteredOrders = useMemo(() => {
    const query = orderFilter.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [order.referenceNumber, order.tankIndex, order.status, order.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [orderFilter, orders]);

  const filteredShortages = useMemo(() => {
    const query = shortageFilter.trim().toLowerCase();
    return Object.entries(shortages).filter(([partIndex, shortage]) => {
      if (!query) return true;
      return [partIndex, shortage.partDescription, shortage.location, ...shortage.orders.map((order) => order.referenceNumber)]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [shortageFilter, shortages]);

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
    setMessage(`${roleLabels[user.role]} zatwierdził mapowanie i import demo.`);
  }

  function updateOrderItem(referenceNumber: string, partIndex: string, pickedQuantity: number) {
    if (!requireLogin()) return;

    setData((current) => ({
      ...current,
      orders: current.orders.map((order) => {
        if (order.referenceNumber !== referenceNumber) return order;

        const updatedItems = order.items.map((item) =>
          item.partIndex === partIndex ? updatePickedQuantity(item as DemoItem, pickedQuantity) : item
        );
        const updatedOrder = { ...order, items: updatedItems };
        const status: OrderStatus = hasOrderShortages(updatedOrder)
          ? "shortage"
          : updatedItems.every((item) => item.isCompleted)
            ? "completed"
            : "picking";

        return {
          ...updatedOrder,
          status
        };
      })
    }));
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
    setMessage(`Kierownik zatwierdził wydanie mimo braków dla ${referenceNumber}.`);
  }

  function issueOrder(referenceNumber: string) {
    if (!requireLogin()) return;

    const order = orders.find((candidate) => candidate.referenceNumber === referenceNumber);
    if (!order) return;

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
    setMessage(`Kierownik cofnął wydanie ${referenceNumber}.`);
  }

  function printPdfPreview() {
    if (!requireLogin()) return;
    setMessage("Otwieram systemowy podgląd wydruku. W MVP to symuluje PDF A4.");
    window.print();
  }

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MVP / tydzień {data.weekNumber} / {data.year}</p>
          <h1>Planowanie magazynu i kompletacja tygodniowa</h1>
          <p className="heroText">
            To już nie jest statyczny dashboard: możesz zalogować rolę demo, zatwierdzić import, edytować pobrane ilości,
            przeliczać braki, zatwierdzić braki jako Kierownik i wydać zlecenie na produkcję.
          </p>
        </div>

        <form
          className="loginCard interactiveCard"
          onSubmit={(event) => {
            event.preventDefault();
            setUser({ role: loginRole, name: roleLabels[loginRole] });
            setMessage(`Zalogowano jako ${roleLabels[loginRole]}.`);
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
            <button className="secondaryButton" type="button" onClick={() => { setUser(null); setMessage("Wylogowano."); }}>
              Wyloguj
            </button>
          </div>
        </form>
      </section>

      <p className="messageBar" role="status">{message}</p>

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

      <section className="panel">
        <div className="panelHeader responsiveHeader">
          <div>
            <p className="eyebrow">Lista zleceń</p>
            <h2>Zlecenia tygodniowe</h2>
          </div>
          <div className="toolbar">
            <input
              aria-label="Filtr zleceń"
              placeholder="Filtr: nr ref., index, status..."
              value={orderFilter}
              onChange={(event) => setOrderFilter(event.target.value)}
            />
            <button className="primaryButton" type="button" onClick={printPdfPreview}>Generuj PDF A4</button>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Nr ref.</th>
                <th>Index zbiornika</th>
                <th>Ilość</th>
                <th>Status</th>
                <th>Braki</th>
                <th>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const hasShortages = hasOrderShortages(order);
                const canIssue = canIssueToProduction({
                  status: order.status,
                  hasShortages,
                  shortageApprovalActive: order.status === "approved_with_shortages"
                });

                return (
                  <tr key={order.referenceNumber} className={selectedReference === order.referenceNumber ? "selectedRow" : ""}>
                    <td><strong>{order.referenceNumber}</strong></td>
                    <td>{order.tankIndex}</td>
                    <td>{order.plannedQuantity}</td>
                    <td><span className={`status ${hasShortages ? "warning" : "ok"}`}>{order.status}</span></td>
                    <td>
                      {hasShortages
                        ? order.items.filter((item) => item.shortageQuantity > 0).map((item) => `${item.partDescription}: ${item.shortageQuantity}`).join("; ")
                        : "Brak"}
                    </td>
                    <td>
                      <div className="actionStack">
                        <button className="secondaryButton" type="button" onClick={() => setSelectedReference(order.referenceNumber)}>Podgląd</button>
                        {hasShortages && order.status !== "approved_with_shortages" ? (
                          <button className="secondaryButton" type="button" onClick={() => approveShortages(order.referenceNumber)}>
                            Zatwierdź braki
                          </button>
                        ) : null}
                        <button className="primaryButton" type="button" onClick={() => issueOrder(order.referenceNumber)}>
                          {canIssue ? "Wydaj" : "Sprawdź wydanie"}
                        </button>
                        {order.issuedToProduction ? (
                          <button className="dangerButton" type="button" onClick={() => unissueOrder(order.referenceNumber)}>Cofnij</button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="columns">
        <article className="panel">
          <p className="eyebrow">Kompletacja / cartrouting snapshot</p>
          <h2>{selectedOrder.referenceNumber} · {selectedOrder.tankIndex}</h2>
          <p className="muted">Elementy cartroutingu pozostają po angielsku. Zmień „picked”, aby automatycznie usunąć albo utworzyć braki.</p>
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

        <article className="panel">
          <div className="panelHeader responsiveHeader">
            <div>
              <p className="eyebrow">Lista braków</p>
              <h2>Filtr po części i nr referencyjnym</h2>
            </div>
            <input
              aria-label="Filtr braków"
              placeholder="np. SEAL lub T23/1"
              value={shortageFilter}
              onChange={(event) => setShortageFilter(event.target.value)}
            />
          </div>
          <div className="cards">
            {filteredShortages.length ? filteredShortages.map(([partIndex, shortage]) => (
              <div className="partCard" key={partIndex}>
                <span>{partIndex}</span>
                <strong>{shortage.partDescription}</strong>
                <small>{shortage.location} · Suma: {shortage.total}</small>
                <ul className="shortageOrders">
                  {shortage.orders.map((order) => (
                    <li key={`${partIndex}-${order.referenceNumber}`}>{order.referenceNumber} · {order.tankIndex} · brak {order.shortageQuantity}</li>
                  ))}
                </ul>
              </div>
            )) : <p className="muted">Brak wyników dla filtra albo wszystkie części są skompletowane.</p>}
          </div>
        </article>
      </section>
    </main>
  );
}
