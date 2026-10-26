const escapeXml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

export function catalogThumbnailKind(product = {}) {
  const text = `${product.name || ""} ${product.category?.name || product.category_name || ""}`.toLowerCase();
  if (text.includes("шкаф") || text.includes("гардероб")) return "wardrobe";
  if (text.includes("стол") || text.includes("офис")) return "table";
  if (text.includes("кровать") || text.includes("спальн")) return "bed";
  return "cabinet";
}

export function catalogThumbnailSvg(product = {}) {
  const kind = catalogThumbnailKind(product);
  const title = escapeXml(product.name || "Мебель");
  const shapes = {
    wardrobe: '<path d="M74 82h120v126H74z" fill="#b77b4b"/><path d="M74 82l34-22h120l-34 22z" fill="#d7a06d"/><path d="M194 82l34-22v126l-34 22z" fill="#875633"/><path d="M134 82v126" stroke="#875633" stroke-width="3"/><circle cx="126" cy="146" r="3" fill="#f6e7cc"/><circle cx="202" cy="146" r="3" fill="#f6e7cc"/>',
    table: '<path d="M55 104h150v32H55z" fill="#bd8150"/><path d="M55 104l30-20h150l-30 20z" fill="#dda875"/><path d="M205 104l30-20v32l-30 20z" fill="#8b5c3b"/><path d="M76 136v70M184 136v70" stroke="#855633" stroke-width="12"/>',
    bed: '<path d="M54 126h174v70H54z" fill="#bd8150"/><path d="M54 126l32-22h174l-32 22z" fill="#dda875"/><path d="M228 126l32-22v70l-32 22z" fill="#8b5c3b"/><path d="M66 116v-35h55v35" fill="#d7a06d" stroke="#875633" stroke-width="4"/><path d="M72 196v18M210 196v18" stroke="#855633" stroke-width="10"/>',
    cabinet: '<path d="M62 84h140v126H62z" fill="#bd8150"/><path d="M62 84l32-22h140l-32 22z" fill="#dda875"/><path d="M202 84l32-22v126l-32 22z" fill="#8b5c3b"/><path d="M132 84v126M62 147h140" stroke="#875633" stroke-width="3"/><circle cx="122" cy="116" r="3" fill="#f6e7cc"/><circle cx="142" cy="116" r="3" fill="#f6e7cc"/><circle cx="122" cy="178" r="3" fill="#f6e7cc"/><circle cx="142" cy="178" r="3" fill="#f6e7cc"/>',
  };
  return `<svg class="catalog-3d-thumbnail" viewBox="0 0 300 250" role="img" aria-label="${title}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f1e5d6"/><stop offset="1" stop-color="#d9c0a4"/></linearGradient></defs><rect width="300" height="250" rx="20" fill="url(#bg)"/><ellipse cx="150" cy="216" rx="105" ry="14" fill="#9f7957" opacity=".24"/>${shapes[kind]}</svg>`;
}
