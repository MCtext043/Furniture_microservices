import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const money = (value: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value);
export const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase('ru-RU').replace(/\s+/g, ' ');
export type SearchableProduct = { name: string; description?: string | null; category?: string | null; brand?: string | null; sku?: string | null };
export function rankProducts<T extends SearchableProduct>(rows: T[], query: string): T[] { const q=normalizeSearch(query); if(!q)return rows; return rows.map((row,index)=>{const name=normalizeSearch(row.name); const category=normalizeSearch(row.category||''); const description=normalizeSearch(row.description||''); let score=-1; if(name===q)score=500; else if(name.startsWith(q))score=400; else if(name.includes(q))score=300; else if(category.includes(q))score=200; else if(description.includes(q))score=100; else if(normalizeSearch(`${row.brand||''} ${row.sku||''}`).includes(q))score=50; return {row,index,score};}).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.row); }
