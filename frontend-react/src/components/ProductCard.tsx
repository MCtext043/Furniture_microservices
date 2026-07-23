import { Heart, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Product } from '../services/api';
import { assetUrl } from '../services/api';
import { money } from '../lib/utils';
import { Button } from './ui/button';

export function ProductCard({product,onCart,onFavorite,favorite=false,pending=false}:{product:Product;onCart?:(p:Product)=>void;onFavorite?:(p:Product)=>void;favorite?:boolean;pending?:boolean}) {
 const image=product.photos?.[0]?.object_key;
 return <article className="group overflow-hidden rounded-[1.75rem] border bg-card transition duration-300 hover:-translate-y-1 hover:shadow-xl">
  <Link to={`/catalog/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-muted">
   {image?<img src={assetUrl(image)} alt={product.name} loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105"/>:<div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent)),transparent_55%)] text-5xl font-display text-primary/25">W</div>}
   <Button size="icon" variant="secondary" disabled={pending} className="absolute right-3 top-3 rounded-full" onClick={e=>{e.preventDefault();onFavorite?.(product)}} aria-label={favorite?'Удалить из избранного':'Добавить в избранное'}><Heart className={`size-4 ${favorite?'fill-current text-primary':''}`}/></Button>
  </Link>
  <div className="p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">{product.brand||'Woodcraft'}</p><Link to={`/catalog/${product.id}`}><h3 className="mt-1 line-clamp-2 font-display text-xl font-semibold">{product.name}</h3></Link><div className="mt-5 flex items-center justify-between gap-3"><b>{money(product.price)}</b><Button size="icon" disabled={pending||product.stock<=0} onClick={()=>onCart?.(product)} aria-label="Добавить в корзину"><ShoppingBag className="size-4"/></Button></div></div>
 </article>
}
