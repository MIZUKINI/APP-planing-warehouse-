import { dashboardSample } from "@/lib/sample-data";
import { canIssueToProduction, summarizeShortages } from "@/lib/domain";

const shortageLines = dashboardSample.orders.flatMap((order) =>
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

const shortages = summarizeShortages(shortageLines);
const totalTanks = dashboardSample.orders.reduce((sum, order) => sum + order.plannedQuantity, 0);
const issuedOrders = dashboardSample.orders.filter((order) => order.issuedToProduction).length;
const blockedOrders = dashboardSample.orders.filter(
  (order) => order.items.some((item) => item.shortageQuantity > 0) && order.status !== "approved_with_shortages"
).length;

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">MVP / tydzień {dashboardSample.weekNumber} / {dashboardSample.year}</p>
          <h1>Planowanie magazynu i kompletacja tygodniowa</h1>
          <p className="heroText">
            Szkielet aplikacji obsługuje import planu wysyłek, zlecenia tygodniowe, snapshot cartroutingu,
            braki oraz blokadę wydania na produkcję bez zatwierdzenia Kierownika.
          </p>
        </div>
        <div className="loginCard">
          <span>Role MVP</span>
          <strong>Magazynier · Planista · Kierownik</strong>
          <small>Logowanie aplikacyjne, bez SSO w MVP.</small>
        </div>
      </section>

      <section className="grid stats" aria-label="Podsumowanie tygodnia">
        <article><span>Zlecenia</span><strong>{dashboardSample.orders.length}</strong></article>
        <article><span>Suma zbiorników</span><strong>{totalTanks}</strong></article>
        <article><span>Zlecenia z brakami</span><strong>{Object.keys(shortages).length}</strong></article>
        <article><span>Wydane</span><strong>{issuedOrders}</strong></article>
        <article><span>Blokady Kierownika</span><strong>{blockedOrders}</strong></article>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Import Excel</p>
            <h2>Mapowanie planu wysyłek</h2>
          </div>
          <span className="badge">.xls · .xlsx · .xlsm</span>
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
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Lista zleceń</p>
            <h2>Zlecenia wygenerowane po zatwierdzeniu importu</h2>
          </div>
          <button className="primaryButton">Generuj PDF A4</button>
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
                <th>Wydanie</th>
              </tr>
            </thead>
            <tbody>
              {dashboardSample.orders.map((order) => {
                const hasShortages = order.items.some((item) => item.shortageQuantity > 0);
                const canIssue = canIssueToProduction({
                  status: order.status,
                  hasShortages,
                  shortageApprovalActive: order.status === "approved_with_shortages"
                });

                return (
                  <tr key={order.referenceNumber}>
                    <td><strong>{order.referenceNumber}</strong></td>
                    <td>{order.tankIndex}</td>
                    <td>{order.plannedQuantity}</td>
                    <td><span className={`status ${hasShortages ? "warning" : "ok"}`}>{order.status}</span></td>
                    <td>
                      {hasShortages
                        ? order.items.filter((item) => item.shortageQuantity > 0).map((item) => `${item.partDescription}: ${item.shortageQuantity}`).join("; ")
                        : "Brak"}
                    </td>
                    <td>{canIssue ? "Możliwe" : "Wymaga Kierownika"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="columns">
        <article className="panel">
          <p className="eyebrow">Cartrouting snapshot</p>
          <h2>Elementy pozostają po angielsku</h2>
          <div className="cards">
            {dashboardSample.orders[0].items.map((item) => (
              <div className="partCard" key={item.partIndex}>
                <span>{item.partIndex}</span>
                <strong>{item.partDescription}</strong>
                <small>{item.location} · per tank {item.quantityPerTank} · required {item.requiredQuantity}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Lista braków</p>
          <h2>Filtrowanie po części i numerze referencyjnym</h2>
          <div className="cards">
            {Object.entries(shortages).map(([partIndex, shortage]) => (
              <div className="partCard" key={partIndex}>
                <span>{partIndex}</span>
                <strong>{shortage.partDescription}</strong>
                <small>Suma: {shortage.total} · Zlecenia: {shortage.orders.map((order) => order.referenceNumber).join(", ")}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
