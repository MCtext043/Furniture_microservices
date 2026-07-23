import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductPage } from './pages/ProductPage';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { CollectionPage } from './pages/CollectionPage';
import { InfoPage } from './pages/InfoPage';
import { AdminPage } from './pages/AdminPage';
import { SmoothScroll } from './components/SmoothScroll';
const PlannerPage=lazy(()=>import('./pages/PlannerPage'));
export function App(){return <><SmoothScroll/><Suspense fallback={<div className="container py-24">Загружаем пространство...</div>}><Routes><Route element={<SiteLayout/>}><Route index element={<HomePage/>}/><Route path="catalog" element={<CatalogPage/>}/><Route path="catalog/:id" element={<ProductPage/>}/><Route path="login" element={<AuthPage mode="login"/>}/><Route path="register" element={<AuthPage mode="register"/>}/><Route path="account" element={<ProtectedRoute><AccountPage/></ProtectedRoute>}/><Route path="projects" element={<ProtectedRoute><AccountPage section="projects"/></ProtectedRoute>}/><Route path="orders" element={<ProtectedRoute><AccountPage section="orders"/></ProtectedRoute>}/><Route path="admin" element={<ProtectedRoute><AdminPage/></ProtectedRoute>}/><Route path="favorites" element={<CollectionPage type="favorites"/>}/><Route path="cart" element={<CollectionPage type="cart"/>}/><Route path="planner" element={<PlannerPage/>}/><Route path="about" element={<InfoPage type="about"/>}/><Route path="contacts" element={<InfoPage type="contacts"/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></Suspense></>}
