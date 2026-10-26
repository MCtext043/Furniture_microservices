// Pricing model transcribed from raschetny_vers3-Kukhnya1.xlsx.
// Quantities are supplied by the 3D scene; an absent quantity is zero.

export const DEFAULT_SPREADSHEET_PRICING = Object.freeze({
  packaging: 1000,
  delivery: 3000,
  taxCoefficient: 1.02,
  tiers: Object.freeze([
    Object.freeze({ key: "standard", title: "Вариант 0", coefficient: 2, taxCoefficient: 1, prices: Object.freeze({ facade1: 1200, facade2: 1200, facade3: 1200, hinges: 50, guides: 500, countertop: 4000, backsplash: 4000 }) }),
    Object.freeze({ key: "comfort", title: "Вариант 1 · МДФ + Boyard", coefficient: 2, taxCoefficient: 1.02, prices: Object.freeze({ facade1: 5900, facade2: 4500, facade3: 4500, hinges: 50, guides: 500, countertop: 4000, backsplash: 4000 }) }),
    Object.freeze({ key: "premium", title: "Вариант 2 · МДФ + JAT", coefficient: 2, taxCoefficient: 1.02, prices: Object.freeze({ facade1: 5900, facade2: 4500, facade3: 4500, hinges: 150, guides: 2500, countertop: 10000, backsplash: 4000 }) }),
    Object.freeze({ key: "luxury", title: "Вариант 3 · Эмаль + Blum", coefficient: 2, taxCoefficient: 1.02, prices: Object.freeze({ facade1: 9100, facade2: 7000, facade3: 7000, hinges: 370, guides: 4000, countertop: 10000, backsplash: 8000 }) }),
  ]),
});

const QUANTITY_KEYS = ["facade1M2", "facade2M2", "facade3M2", "hinges", "guides", "countertop", "backsplash"];

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : 0;
}

export function estimateSpreadsheetPrices({ procurementCost = 0, quantities = {}, config = DEFAULT_SPREADSHEET_PRICING }) {
  const normalizedQuantities = Object.fromEntries(QUANTITY_KEYS.map((key) => [key, number(quantities[key])]));
  const procurement = number(procurementCost);
  return config.tiers.map((tier) => {
    const p = tier.prices;
    const assemblyCost =
      normalizedQuantities.facade1M2 * number(p.facade1) +
      normalizedQuantities.facade2M2 * number(p.facade2) +
      normalizedQuantities.facade3M2 * number(p.facade3) +
      normalizedQuantities.hinges * number(p.hinges) +
      normalizedQuantities.guides * number(p.guides) +
      normalizedQuantities.countertop * number(p.countertop) +
      normalizedQuantities.backsplash * number(p.backsplash);
    const primeCost = procurement + assemblyCost;
    const tierTax = tier.taxCoefficient ?? tier.tax_coefficient;
    const configTax = config.taxCoefficient ?? config.tax_coefficient;
    const packaging = config.packaging ?? config.packaging_cost;
    const delivery = config.delivery ?? config.delivery_cost;
    const price = (primeCost * number(tier.coefficient) + number(packaging) + number(delivery)) * number(tierTax ?? configTax ?? 1);
    return { key: tier.key, title: tier.title, assemblyCost, primeCost, price: Math.round(price * 100) / 100 };
  });
}

export function quantitiesFromScene(objects = [], bom = { parts: [] }) {
  const facadeParts = (bom.parts || []).filter((part) => String(part.role || "").toLowerCase() === "facade" || String(part.name || "").toLowerCase().includes("фасад"));
  const facadeArea = facadeParts.reduce((sum, part) => sum + (number(part.width) * number(part.height) * number(part.quantity)) / 1_000_000, 0);
  const facade1M2 = facadeParts.filter((part) => part.milling).reduce((sum, part) => sum + (number(part.width) * number(part.height) * number(part.quantity)) / 1_000_000, 0);
  const objectFacadeArea = facadeArea - facade1M2;
  const hinges = objects.reduce((sum, item) => sum + number(item.doorCount ?? item.configuration?.doorCount) * 2, 0);
  const guides = objects.reduce((sum, item) => sum + number(item.drawers ?? item.configuration?.drawers ?? item.configuration?.drawerCount), 0);
  const countertop = objects.reduce((sum, item) => sum + (item.countertopType ? number(item.width ?? item.configuration?.width) / 1000 : 0), 0);
  return { facade1M2, facade2M2: objectFacadeArea, facade3M2: 0, hinges, guides, countertop, backsplash: 0 };
}
