const make = (id, category, type, name, dimensions, extra = {}) => ({
  id,
  variant: id,
  category,
  type,
  name,
  width: dimensions[0],
  depth: dimensions[1],
  height: dimensions[2],
  texture: extra.texture || "wood_oak",
  ...extra,
});

const makeKitchenSeries = (prefix, rows) => rows.map(([suffix, name, type, dimensions, extra = {}]) =>
  make(`k-${prefix}-${suffix}`, "kitchen", type, name, dimensions, {
    texture: "mdf_film_matte",
    ...(type === "cabinet" ? { countertop: "skif", doorCount: extra.drawers ? 0 : 1, handles: 1 } : {}),
    ...extra,
  }),
);

const KITCHEN_VARIATIONS = [
  ...makeKitchenSeries("base", [
    ["2-door-800", "Нижний шкаф 800 мм · две дверцы", "cabinet", [800, 560, 850], { doorCount: 2, handles: 2 }],
    ["2-door-900", "Нижний шкаф 900 мм · две дверцы", "cabinet", [900, 560, 850], { doorCount: 2, handles: 2 }],
    ["narrow-300", "Узкий нижний шкаф 300 мм", "cabinet", [300, 560, 850]],
    ["narrow-400", "Узкий нижний шкаф 400 мм", "cabinet", [400, 560, 850]],
    ["wide-1000", "Широкий нижний шкаф 1000 мм · две дверцы", "cabinet", [1000, 560, 850], { doorCount: 2, handles: 2 }],
    ["deep-600", "Нижний шкаф увеличенной глубины", "cabinet", [600, 600, 850]],
    ["drawer-2", "Тумба с двумя широкими ящиками", "cabinet", [600, 560, 850], { drawers: 2, handles: 2 }],
    ["drawer-4", "Тумба с четырьмя ящиками", "cabinet", [600, 560, 850], { drawers: 4, handles: 4 }],
    ["drawer-5", "Узкая тумба с пятью ящиками", "cabinet", [450, 560, 850], { drawers: 5, handles: 5 }],
    ["mixed-3", "Тумба: три ящика и дверца", "cabinet", [800, 560, 850], { drawers: 3, doorCount: 1, handles: 4 }],
    ["mixed-2", "Тумба: два ящика и дверца", "cabinet", [900, 560, 850], { drawers: 2, doorCount: 1, handles: 3 }],
    ["cooktop", "Тумба под варочную панель", "cabinet", [800, 560, 850], { drawers: 2, handles: 2 }],
    ["dishwasher-450", "Фасад под узкую посудомоечную машину", "cabinet", [450, 560, 850], { drawers: 0, handles: 1 }],
    ["dishwasher-600", "Фасад под посудомоечную машину 600 мм", "cabinet", [600, 560, 850], { drawers: 0, handles: 1 }],
    ["waste-bin", "Тумба с выдвижной системой для мусора", "cabinet", [500, 560, 850], { drawers: 1, handles: 1 }],
    ["bottle-300", "Бутылочница 300 мм", "cabinet", [300, 560, 850], { drawers: 1, handles: 1 }],
  ]),
  ...makeKitchenSeries("wall", [
    ["single-300", "Навесной шкаф 300 мм · одна дверца", "cabinet", [300, 340, 720], { y: 1400, doorCount: 1, handles: 1 }],
    ["single-400", "Навесной шкаф 400 мм · одна дверца", "cabinet", [400, 340, 720], { y: 1400, doorCount: 1, handles: 1 }],
    ["double-600", "Навесной шкаф 600 мм · две дверцы", "cabinet", [600, 340, 720], { y: 1400, doorCount: 2, handles: 2 }],
    ["double-800", "Навесной шкаф 800 мм · две дверцы", "cabinet", [800, 340, 720], { y: 1400, doorCount: 2, handles: 2 }],
    ["double-1000", "Навесной шкаф 1000 мм · две дверцы", "cabinet", [1000, 340, 720], { y: 1400, doorCount: 2, handles: 2 }],
    ["short-360", "Короткий верхний шкаф 360 мм", "cabinet", [600, 340, 360], { y: 1500, doorCount: 2, handles: 2 }],
    ["high-900", "Высокий верхний шкаф 900 мм", "cabinet", [800, 340, 900], { y: 1300, doorCount: 2, handles: 2 }],
    ["lift-wide", "Широкий шкаф с подъёмным фасадом", "cabinet", [1000, 340, 480], { y: 1600, doorCount: 1, handles: 1 }],
    ["glass-double", "Витрина с двумя стеклянными фасадами", "cabinet", [800, 340, 720], { y: 1400, texture: "mdf_film_gloss", doorCount: 2, handles: 2 }],
    ["open-cubes", "Открытый верхний модуль с нишами", "shelf", [800, 300, 720], { y: 1400 }],
    ["hood", "Шкаф-короб для вытяжки", "cabinet", [600, 340, 480], { y: 1600, doorCount: 1, handles: 1 }],
    ["corner-900", "Угловой навесной модуль 900 мм", "cabinet", [900, 600, 720], { y: 1400, doorCount: 1, handles: 1 }],
  ]),
  ...makeKitchenSeries("tall", [
    ["pantry-450", "Узкий пенал-кладовая 450 мм", "wardrobe", [450, 560, 2200]],
    ["pantry-800", "Широкий пенал-кладовая 800 мм", "wardrobe", [800, 560, 2200]],
    ["oven-micro", "Пенал: духовка и микроволновая печь", "wardrobe", [600, 560, 2200]],
    ["oven-drawers", "Пенал с духовкой и нижними ящиками", "wardrobe", [600, 560, 2200], { drawers: 2, handles: 2 }],
    ["fridge-side", "Пенал для холодильника с боковой секцией", "wardrobe", [900, 650, 2200]],
    ["broom", "Хозяйственный пенал для инвентаря", "wardrobe", [500, 560, 2200]],
    ["pullout", "Высокая выдвижная кладовая", "cabinet", [450, 560, 2200], { drawers: 5, handles: 5 }],
    ["oven-compact", "Компактный пенал под духовой шкаф", "wardrobe", [600, 560, 1800]],
  ]),
  ...makeKitchenSeries("special", [
    ["sink-600", "Тумба под мойку 600 мм", "cabinet", [600, 560, 850], { doorCount: 2, handles: 2 }],
    ["sink-corner", "Угловая тумба под мойку", "cabinet", [900, 900, 850], { doorCount: 1, handles: 1 }],
    ["corner-drawer", "Угловая тумба с выдвижными ящиками", "cabinet", [900, 900, 850], { drawers: 3, handles: 3 }],
    ["open-shelves", "Нижняя секция с открытыми полками", "shelf", [600, 560, 850]],
    ["wine-rack", "Открытый винный модуль", "shelf", [300, 560, 850]],
    ["island-1200", "Компактный кухонный остров 1200 мм", "cabinet", [1200, 800, 900], { drawers: 2, handles: 2, countertop: "quartz" }],
    ["island-2000", "Большой кухонный остров 2000 мм", "cabinet", [2000, 1000, 900], { drawers: 4, handles: 4, countertop: "quartz" }],
    ["island-seating", "Остров с посадочным местом", "cabinet", [1800, 950, 900], { drawers: 3, handles: 3, countertop: "quartz" }],
  ]),
];

const WARDROBE_VARIATIONS = [
  make("w-mirror-double", "wardrobe", "wardrobe", "Шкаф с двумя зеркальными фасадами", [1600, 600, 2300], { texture: "mdf_film_gloss", handles: 2 }),
  make("w-four-door", "wardrobe", "wardrobe", "Четырёхстворчатый шкаф", [2400, 600, 2400], { handles: 4 }),
  make("w-sliding-three", "wardrobe", "wardrobe_sliding", "Шкаф-купе с тремя дверями", [2700, 650, 2400], { texture: "wood_dark_oak", handles: 3 }),
  make("w-sliding-mirror", "wardrobe", "wardrobe_sliding", "Шкаф-купе с зеркальными дверями", [2200, 650, 2400], { texture: "mdf_film_gloss", handles: 2 }),
  make("w-open-double", "wardrobe", "shelf", "Открытая гардеробная секция с двумя штангами", [1600, 550, 2400]),
  make("w-corner-open", "wardrobe", "wardrobe_corner", "Открытая угловая гардеробная система", [1600, 1200, 2400]),
  make("w-mezzanine", "wardrobe", "wardrobe", "Шкаф с антресольной секцией", [1800, 600, 2600], { handles: 4 }),
  make("w-drawer-wardrobe", "wardrobe", "wardrobe", "Шкаф с внутренними выдвижными ящиками", [1200, 600, 2300], { drawers: 3, handles: 4 }),
  make("w-shoe", "wardrobe", "cabinet", "Обувной шкаф с откидными секциями", [1000, 350, 1200], { drawers: 3, handles: 3 }),
  make("w-narrow", "wardrobe", "wardrobe", "Узкий шкаф для прихожей", [500, 450, 2100], { handles: 1 }),
  make("w-dressing-table", "wardrobe", "cabinet", "Комод с зеркалом для гардеробной", [1200, 500, 900], { drawers: 5, handles: 5, countertop: "quartz" }),
  make("w-overhead", "wardrobe", "cabinet", "Антресольный шкаф", [1800, 600, 600], { y: 1800, doorCount: 3, handles: 3 }),
];

// These identifiers intentionally match the original accordion sections in
// index.html. The library extends those sections instead of creating new ones.
export const HARD_FURNITURE_CATEGORIES = [
  ["living", "Гостиная"],
  ["kitchen", "Кухня"],
  ["wardrobe", "Гардеробная"],
  ["bathroom", "Ванная"],
  ["bedroom", "Спальня"],
  ["office", "Кабинет"],
];

export const HARD_FURNITURE_LIBRARY = Object.freeze([
  // Кухня: разные конструкции и назначения, а не размерный ряд одного шкафа.
  make("k-base-hinged", "kitchen", "cabinet", "Нижний шкаф с распашными фасадами", [600, 560, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 0, handles: 2 }),
  make("k-base-drawers", "kitchen", "cabinet", "Нижний шкаф с выдвижными ящиками", [600, 560, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 3, handles: 3 }),
  make("k-sink", "kitchen", "cabinet", "Шкаф под мойку", [800, 560, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 0, handles: 2 }),
  make("k-oven-base", "kitchen", "cabinet", "Тумба под духовой шкаф", [600, 560, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 1, handles: 1 }),
  make("k-corner-base", "kitchen", "cabinet", "Угловой нижний шкаф", [900, 900, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 0, handles: 1 }),
  make("k-blind-corner", "kitchen", "cabinet", "Шкаф глухого угла", [1000, 560, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 0, handles: 1 }),
  make("k-bottle-pullout", "kitchen", "cabinet", "Выдвижная бутылочница", [200, 560, 850], { texture: "mdf_film_matte", countertop: "skif", drawers: 1, handles: 1 }),
  make("k-open-base", "kitchen", "shelf", "Открытая нижняя секция", [600, 560, 850], { texture: "mdf_film_matte", countertop: "skif" }),
  make("k-wall-hinged", "kitchen", "cabinet", "Навесной шкаф с распашными фасадами", [800, 340, 720], { texture: "mdf_film_matte", y: 1400, drawers: 0, handles: 2 }),
  make("k-wall-lift", "kitchen", "cabinet", "Навесной шкаф с подъёмным фасадом", [800, 340, 480], { texture: "mdf_film_matte", y: 1600, drawers: 0, handles: 1 }),
  make("k-wall-glass", "kitchen", "cabinet", "Навесной шкаф-витрина", [600, 340, 720], { texture: "mdf_film_gloss", y: 1400, drawers: 0, handles: 2 }),
  make("k-wall-corner", "kitchen", "cabinet", "Угловой навесной шкаф", [600, 600, 720], { texture: "mdf_film_matte", y: 1400, drawers: 0, handles: 1 }),
  make("k-wall-open", "kitchen", "shelf", "Открытая навесная полка", [600, 260, 600], { texture: "mdf_film_matte", y: 1450 }),
  make("k-tall-pantry", "kitchen", "wardrobe", "Пенал с полками", [600, 560, 2200], { texture: "mdf_film_matte" }),
  make("k-tall-oven", "kitchen", "wardrobe", "Пенал для встраиваемой духовки", [600, 560, 2200], { texture: "mdf_film_matte" }),
  make("k-tall-fridge", "kitchen", "wardrobe", "Пенал для встроенного холодильника", [600, 650, 2200], { texture: "mdf_film_matte" }),
  make("k-island", "kitchen", "cabinet", "Остров с рабочей зоной", [1600, 900, 900], { texture: "mdf_film_matte", countertop: "quartz", drawers: 4, handles: 4 }),
  make("k-peninsula", "kitchen", "cabinet", "Полуостров с барной зоной", [1400, 700, 900], { texture: "mdf_film_matte", countertop: "skif", drawers: 2, handles: 2 }),
  ...KITCHEN_VARIATIONS,

  // Гостиная.
  make("l-tv", "living", "cabinet", "ТВ-тумба", [1600, 420, 520], { drawers: 2, handles: 2 }),
  make("l-sideboard", "living", "cabinet", "Буфет с ящиками", [1400, 450, 1100], { drawers: 3, handles: 5 }),
  make("l-display", "living", "wardrobe", "Шкаф-витрина", [900, 420, 2000], { texture: "mdf_film_gloss" }),
  make("l-bookcase", "living", "shelf", "Книжный шкаф", [1000, 350, 2100]),
  make("l-asymmetric", "living", "shelf", "Асимметричный стеллаж", [1200, 350, 1900]),
  make("l-wall-cabinet", "living", "cabinet", "Навесная тумба для гостиной", [1200, 350, 420], { y: 700, drawers: 0, handles: 2 }),
  make("l-media-wall", "living", "wardrobe", "Модульная ТВ-стенка", [2600, 450, 2100]),
  make("l-coffee", "living", "table", "Журнальный стол", [1000, 600, 450]),
  make("l-console", "living", "table", "Консольный стол", [1100, 350, 800]),

  // Гардеробная.
  make("w-single", "wardrobe", "wardrobe", "Одностворчатый шкаф", [600, 600, 2300]),
  make("w-double", "wardrobe", "wardrobe", "Двухстворчатый шкаф", [1200, 600, 2300]),
  make("w-triple", "wardrobe", "wardrobe", "Трёхстворчатый шкаф", [1800, 600, 2300]),
  make("w-sliding", "wardrobe", "wardrobe_sliding", "Шкаф-купе", [2200, 650, 2400], { texture: "wood_dark_oak" }),
  make("w-corner", "wardrobe", "wardrobe_corner", "Угловой гардеробный шкаф", [1200, 1200, 2400]),
  make("w-open", "wardrobe", "shelf", "Открытая гардеробная секция", [1000, 550, 2400]),
  make("w-dresser", "wardrobe", "cabinet", "Комод с шестью ящиками", [1400, 480, 900], { drawers: 6, handles: 6 }),
  make("w-linen", "wardrobe", "wardrobe", "Бельевой шкаф", [800, 500, 2100]),
  make("w-island", "wardrobe", "cabinet", "Гардеробный остров", [1400, 800, 950], { drawers: 6, handles: 6, countertop: "quartz" }),
  ...WARDROBE_VARIATIONS,

  // Ванная.
  make("ba-vanity-drawers", "bathroom", "cabinet", "Тумба под раковину с ящиками", [800, 500, 700], { texture: "mdf_film_matte", y: 150, drawers: 2, handles: 2 }),
  make("ba-vanity-doors", "bathroom", "cabinet", "Тумба под раковину с дверцами", [800, 500, 700], { texture: "mdf_film_matte", y: 150, drawers: 0, handles: 2 }),
  make("ba-wall", "bathroom", "cabinet", "Навесной шкаф для ванной", [600, 250, 700], { texture: "mdf_film_matte", y: 1300, drawers: 0, handles: 2 }),
  make("ba-mirror", "bathroom", "cabinet", "Зеркальный шкаф", [800, 180, 700], { texture: "mdf_film_gloss", y: 1300, drawers: 0, handles: 2 }),
  make("ba-tall", "bathroom", "wardrobe", "Пенал для ванной", [400, 350, 1900], { texture: "mdf_film_matte" }),
  make("ba-laundry", "bathroom", "wardrobe", "Шкаф для стиральной машины", [700, 650, 2200], { texture: "mdf_film_matte" }),
  make("ba-hamper", "bathroom", "cabinet", "Тумба с корзиной для белья", [500, 450, 900], { texture: "mdf_film_matte", drawers: 0, handles: 1 }),

  // Спальня.
  make("b-night", "bedroom", "cabinet", "Прикроватная тумба", [500, 420, 500], { drawers: 2, handles: 2 }),
  make("b-dresser", "bedroom", "cabinet", "Комод для спальни", [1200, 480, 900], { drawers: 4, handles: 4 }),
  make("b-highboy", "bedroom", "cabinet", "Высокий узкий комод", [700, 480, 1250], { drawers: 5, handles: 5 }),
  make("b-vanity", "bedroom", "table", "Туалетный столик", [1100, 450, 760]),
  make("b-floating-vanity", "bedroom", "cabinet", "Подвесной туалетный столик", [1000, 400, 240], { y: 700, drawers: 2, handles: 2 }),
  make("b-overbed", "bedroom", "cabinet", "Надкроватный шкаф-мост", [2200, 450, 600], { y: 1700, drawers: 0, handles: 4 }),
  make("b-chest", "bedroom", "cabinet", "Сундук для хранения", [1200, 500, 520], { drawers: 0, handles: 1 }),

  // Кабинет.
  make("o-desk", "office", "table", "Письменный стол", [1400, 700, 750]),
  make("o-desk-storage", "office", "table", "Рабочий стол с тумбой", [1600, 700, 750], { drawers: 3, handles: 3 }),
  make("o-corner-desk", "office", "table", "Угловой рабочий стол", [1600, 1200, 750]),
  make("o-pedestal", "office", "cabinet", "Мобильная офисная тумба", [450, 500, 620], { drawers: 3, handles: 3 }),
  make("o-file", "office", "cabinet", "Картотечный шкаф", [700, 500, 1300], { drawers: 4, handles: 4 }),
  make("o-bookcase", "office", "shelf", "Офисный стеллаж", [1000, 380, 2100]),
  make("o-closed", "office", "wardrobe", "Закрытый офисный шкаф", [1000, 450, 2100]),
  make("o-wall", "office", "cabinet", "Навесной офисный шкаф", [1000, 350, 600], { y: 1450, drawers: 0, handles: 2 }),
  make("o-meeting", "office", "table", "Стол для переговоров", [2400, 1100, 750]),
].map(Object.freeze));
