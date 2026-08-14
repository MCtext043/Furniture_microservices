const KITCHEN_TYPES = {
  "kitchen.base_cabinet": { title: "Base cabinet", defaults: { width: 600, depth: 560, height: 850, shelfCount: 1, drawerCount: 0, doorCount: 1, plinthHeight: 100 } },
  "kitchen.wall_cabinet": { title: "Wall cabinet", defaults: { width: 600, depth: 340, height: 720, shelfCount: 2, drawerCount: 0, doorCount: 1, plinthHeight: 0 } },
  "kitchen.tall_cabinet": { title: "Tall cabinet", defaults: { width: 600, depth: 560, height: 2200, shelfCount: 4, drawerCount: 0, doorCount: 2, plinthHeight: 100 } },
  "kitchen.drawer_cabinet": { title: "Drawer cabinet", defaults: { width: 600, depth: 560, height: 850, shelfCount: 0, drawerCount: 3, doorCount: 0, plinthHeight: 100 } },
  "kitchen.sink_cabinet": { title: "Sink cabinet", defaults: { width: 800, depth: 560, height: 850, shelfCount: 0, drawerCount: 0, doorCount: 2, plinthHeight: 100 } },
  "kitchen.oven_cabinet": { title: "Oven cabinet", defaults: { width: 600, depth: 560, height: 850, shelfCount: 0, drawerCount: 1, doorCount: 0, plinthHeight: 100 } },
  "kitchen.corner_base": { title: "Corner base", defaults: { width: 1000, depth: 1000, height: 850, shelfCount: 1, drawerCount: 0, doorCount: 1, plinthHeight: 100 } },
  "kitchen.corner_wall": { title: "Corner wall", defaults: { width: 650, depth: 650, height: 720, shelfCount: 2, drawerCount: 0, doorCount: 1, plinthHeight: 0 } },
  "kitchen.open_shelf": { title: "Open shelf", defaults: { width: 600, depth: 320, height: 720, shelfCount: 3, drawerCount: 0, doorCount: 0, plinthHeight: 0 } },
  "kitchen.filler": { title: "Filler", defaults: { width: 100, depth: 560, height: 850, shelfCount: 0, drawerCount: 0, doorCount: 0, plinthHeight: 100 } },
  "kitchen.end_panel": { title: "End panel", defaults: { width: 18, depth: 560, height: 850, shelfCount: 0, drawerCount: 0, doorCount: 0, plinthHeight: 0 } },
  "kitchen.island": { title: "Island", defaults: { width: 1600, depth: 900, height: 900, shelfCount: 2, drawerCount: 3, doorCount: 2, plinthHeight: 100 } },
};

function productionParts(config) {
  const t = Number(config.bodyThickness) || 18; const w=config.width, d=config.depth, h=config.height; const bodyH=h-(config.plinthHeight||0);
  const part=(id,role,width,height,quantity=1,materialId="body")=>({id,role,dimensions:{width,height,thickness:t},quantity,materialId,edgeBanding:{front:2},drilling:[]});
  return [part("side","panel",d,bodyH,2),part("bottom","panel",w-2*t,d),part("top-rail","rail",w-2*t,100,2),
    ...(config.shelfCount?[part("shelf","shelf",w-2*t,d-t,config.shelfCount)]:[]),
    ...(config.doorCount?[part("facade","facade",w/config.doorCount-3,bodyH-6,config.doorCount,"facade")]:[]),
    ...(config.drawerCount?[part("drawer-front","facade",w-6,bodyH/config.drawerCount-4,config.drawerCount,"facade")]:[])];
}

export function registerKitchenDefinitions(registry) {
  for (const [type, meta] of Object.entries(KITCHEN_TYPES)) registry.register({
    type, definitionId:`${type}.v1`, title:meta.title, category:"kitchen", defaults:meta.defaults,
    constraints:{width:[50,2400],depth:[250,1200],height:[200,2600]}, schema:{bodyThickness:"number",doorCount:"integer",shelfCount:"integer",drawerCount:"integer",facadeType:"string",openingDirection:"string"},
    validateConfiguration(c){const e=[];for(const k of ["width","depth","height"])if(!(Number(c[k])>0))e.push(`${k} must be positive`);return{valid:!e.length,errors:e}},
    getBounds:({configuration:c})=>({width:c.width,depth:c.depth,height:c.height}),
    buildBom:({configuration:c})=>({parts:productionParts({...meta.defaults,...c}),assembly:[`Assemble ${meta.title}`]}),
    buildGeometry(placement,context){return context.buildLegacy({...placement,type:"cabinet",configuration:{...meta.defaults,...placement.configuration}})},
  });
}

export class KitchenRun {
  constructor(modules = []) { this.modules = modules; }
  buildProduction() {
    const base = this.modules.filter((item) => item.type !== "kitchen.wall_cabinet" && item.type !== "kitchen.corner_wall");
    const width = base.reduce((sum,item)=>sum+Number(item.configuration.width||0),0);
    return { parts: width ? [{id:"continuous-countertop",role:"countertop",dimensions:{width,depth:Math.max(...base.map(x=>Number(x.configuration.depth)||0))+30,thickness:38},quantity:1,materialId:"countertop",edgeBanding:{front:2},drilling:[]}] : [] };
  }
}
