export class ModelAssetLoader {
  constructor({ parse, fetchAsset = fetch, clone = (scene) => scene.clone(true) }) {
    this.parse=parse; this.fetchAsset=fetchAsset; this.clone=clone; this.cache=new Map();
  }
  key(assetKey,version){return `${assetKey}@${version||1}`}
  async load(assetKey,version=1,signal) {
    if(!assetKey)throw new Error("GLB placement has no modelAssetKey"); const key=this.key(assetKey,version);
    let promise=this.cache.get(key);
    if(!promise){promise=this.fetchAsset(`/assets/objects/${assetKey.split("/").map(encodeURIComponent).join("/")}`,{signal}).then(r=>{if(!r.ok)throw new Error(`GLB download failed (${r.status})`);return r.arrayBuffer()}).then(buffer=>this.parse(buffer));this.cache.set(key,promise);promise.catch(()=>this.cache.delete(key))}
    return this.clone(await promise);
  }
  disposeScene(scene){const seen=new Set();scene?.traverse?.(node=>{if(node.geometry&&!seen.has(node.geometry)){seen.add(node.geometry);node.geometry.dispose?.()}for(const material of (Array.isArray(node.material)?node.material:[node.material]).filter(Boolean)){if(seen.has(material))continue;seen.add(material);for(const key of ["map","normalMap","roughnessMap","metalnessMap","aoMap"]){if(material[key]&&!seen.has(material[key])){seen.add(material[key]);material[key].dispose?.()}}material.dispose?.()}})}
  invalidate(assetKey,version=1){const key=this.key(assetKey,version),promise=this.cache.get(key);this.cache.delete(key);promise?.then(scene=>this.disposeScene(scene)).catch(()=>{})}
  clear(){for(const promise of this.cache.values())promise.then(scene=>this.disposeScene(scene)).catch(()=>{});this.cache.clear()}
}
