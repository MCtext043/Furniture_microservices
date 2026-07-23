import { describe, expect, it } from 'vitest';
import { normalizeSearch, rankProducts } from './utils';
describe('catalog search',()=>{it('normalizes russian queries',()=>{expect(normalizeSearch('  Тёмный   Дуб ')).toBe('тёмный дуб')});it('ranks exact and prefix matches first',()=>{const rows=[{name:'Стол из дуба'},{name:'Дубовый шкаф'},{name:'Стол'}];expect(rankProducts(rows,'стол').map(x=>x.name)).toEqual(['Стол','Стол из дуба'])})});
