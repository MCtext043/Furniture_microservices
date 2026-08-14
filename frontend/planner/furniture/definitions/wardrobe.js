function normalizedSections(config) {
  return config.sections?.length ? config.sections : [{width:config.width,modules:[{type:"shelves",count:5}]}];
}

function wardrobeParts(config) {
  const t=Number(config.bodyThickness)||18, sections=normalizedSections(config); const parts=[];
  const add=(id,role,width,height,quantity=1,materialId="body")=>parts.push({id,role,dimensions:{width,height,thickness:t},quantity,materialId,edgeBanding:{front:2},drilling:[]});
  add("outer-side","panel",config.depth,config.height,2); add("top-bottom","panel",config.width-2*t,config.depth,2);
  if(sections.length>1)add("divider","panel",config.depth,config.height-2*t,sections.length-1);
  sections.forEach((section,index)=>section.modules.forEach((module)=>{if(module.type==="shelves")add(`section-${index}-shelf`,"shelf",section.width-t,config.depth-t,module.count||1);if(module.type==="drawers")add(`section-${index}-drawer-front`,"facade",section.width-6,180,module.count||1,"facade");if(module.type==="rail")add(`section-${index}-rail`,"rail",section.width-80,25,1,"hardware")}));
  if(config.doorMode!=="open")add("door","facade",config.width/(config.doorCount||2)-4,config.height-8,config.doorCount||2,config.mirrorFacade?"mirror":"facade");
  return parts;
}

export function registerWardrobeDefinition(registry) {
  for(const type of ["wardrobe","wardrobe_sliding","wardrobe_corner","wardrobe.system"]) registry.register({
    type,definitionId:"wardrobe.system.v1",title:"Wardrobe system",category:"wardrobe",
    defaults:{width:1600,depth:600,height:2400,bodyThickness:18,doorCount:2,doorMode:type==="wardrobe_sliding"?"sliding":"hinged",sections:[]},
    constraints:{width:[600,5000],depth:[350,1000],height:[1000,3200]},schema:{sections:"array",doorMode:"string",mirrorFacade:"boolean"},
    validateConfiguration(c){const total=normalizedSections(c).reduce((s,x)=>s+Number(x.width||0),0);const errors=Math.abs(total-c.width)>2?["section widths must equal wardrobe width"]:[];return{valid:!errors.length,errors}},
    getBounds:({configuration:c})=>({width:c.width,depth:c.depth,height:c.height}),
    buildBom:({configuration:c})=>({parts:wardrobeParts(c),assembly:["Assemble carcass","Install wardrobe modules","Install doors"]}),
    buildGeometry(placement,context){return context.buildLegacy({...placement,type:type==="wardrobe.system"?"wardrobe":type})},
  });
}
