import { Heart, Menu, Moon, ShoppingBag, Sun, User, X } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Button } from '../ui/button';
import { useTheme } from '../../features/theme/ThemeProvider';
import { useCommerce } from '../../features/commerce/useCommerce';

const links = [['Каталог', '/catalog'], ['3D-планировщик', '/planner'], ['О компании', '/about'], ['Контакты', '/contacts']];

export function SiteLayout() {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const commerce = useCommerce();
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div className="container flex h-18 items-center justify-between gap-5">
        <Link to="/" className="group flex items-center gap-3" aria-label="Woodcraft, на главную">
          <span className="grid size-10 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground transition-transform group-hover:rotate-6">W</span>
          <span><b className="block font-display text-xl leading-none">Woodcraft</b><small className="text-[10px] uppercase tracking-[.22em] text-muted-foreground">мебельная студия</small></span>
        </Link>
        <nav className="hidden items-center gap-7 lg:flex">{links.map(([label,to])=><NavLink key={to} to={to} className={({isActive})=>`text-sm font-medium transition-colors hover:text-primary ${isActive?'text-primary':'text-muted-foreground'}`}>{label}</NavLink>)}</nav>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Переключить тему">{theme==='dark'?<Sun/>:<Moon/>}</Button>
          <Button asChild variant="ghost" size="icon"><Link className="relative" to="/favorites" aria-label={`Избранное: ${commerce.wishlistCount}`}><Heart/>{commerce.wishlistCount>0&&<span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{commerce.wishlistCount}</span>}</Link></Button>
          <Button asChild variant="ghost" size="icon"><Link className="relative" to="/cart" aria-label={`Корзина: ${commerce.cartCount}`}><ShoppingBag/>{commerce.cartCount>0&&<span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{commerce.cartCount}</span>}</Link></Button>
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex"><Link to="/account" aria-label="Аккаунт"><User/></Link></Button>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={()=>setOpen(!open)} aria-label="Открыть меню">{open?<X/>:<Menu/>}</Button>
        </div>
      </div>
      {open&&<nav className="container grid gap-1 border-t py-4 lg:hidden">{links.map(([label,to])=><NavLink key={to} to={to} onClick={()=>setOpen(false)} className="rounded-xl px-4 py-3 font-medium hover:bg-muted">{label}</NavLink>)}</nav>}
    </header>
    <main><Outlet/></main>
    <footer className="border-t bg-card py-12"><div className="container grid gap-8 md:grid-cols-[1.4fr_1fr_1fr]"><div><p className="font-display text-2xl font-bold">Woodcraft</p><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Проектируем мебель, которая точно вписывается в ваш дом и образ жизни.</p></div><div><b>Навигация</b><div className="mt-3 grid gap-2 text-sm text-muted-foreground"><Link to="/catalog">Каталог</Link><Link to="/planner">Планировщик</Link><Link to="/projects">Мои проекты</Link></div></div><div><b>Связаться</b><p className="mt-3 text-sm text-muted-foreground">+7 (800) 555-35-35<br/>hello@woodcraft.local</p></div></div></footer>
  </div>;
}
