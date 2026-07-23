# API contracts used by React frontend

All browser requests use `VITE_API_BASE_URL` (default `/api`), `credentials: include`, and a Bearer token when authenticated.

| Function | Endpoint | Method | Request | Response | Frontend |
|---|---|---|---|---|---|
| Login | `/auth/token` | POST | `{username,password}` | token | `AuthProvider`, `AuthPage` |
| Session | `/auth/me` | GET | Bearer | JWT claims | `AuthProvider` |
| Categories | `/catalog/categories` | GET | - | `Category[]` | `CatalogPage`, `AdminPage` |
| Catalog | `/catalog/products` | GET | `limit`, `sort_by`, filters | `Product[]` with photos | catalog/admin/commerce |
| Product | `/catalog/products/{id}` | GET | numeric ID | `Product` | `ProductPage` |
| Cart list | `/catalog/users/{user}/cart/items` | GET | string user ID | `CartItem[]` | `useCommerce` |
| Cart add | same | POST | `{product_id,quantity}` | `CartItem` | `useCommerce` |
| Cart quantity | `.../cart/items/{item_id}` | PATCH | `{quantity}` | `CartItem` | `CollectionPage` |
| Cart remove | `.../cart/items/{item_id}` | DELETE | - | 204 | `CollectionPage` |
| Wishlist list | `/catalog/users/{user}/wishlist` | GET | - | `WishlistItem[]` | `useCommerce` |
| Wishlist toggle | `.../wishlist/products/{product_id}` | POST/DELETE | - | item/204 | cards/pages |
| User projects | `/planner/projects/user/{user}` | GET | - | `Project[]` | account/planner |
| Save project | `/planner/projects[/{id}]` | POST/PATCH | project payload + versioned `bom_json` | `Project` | planner service |
| Legacy furniture | `/planner/projects/{id}/furniture` | GET/POST | placement payload | placement(s) | planner adapter |
| Submit project | `/planner/projects/{id}/submit` | POST | `{selected_tier}` | `Project` | planner |
| User orders | `/catalog/crm/orders/user/{user}` | GET | - | `Order[]` | account |
| Create application | `/catalog/crm/orders/submit-project` | POST | project, pricing, material lines | `Order` | planner |
| Admin CRUD | `/catalog/products[/{id}]` | POST/PATCH/DELETE | product create/update | product/204 | admin |
| Images | `/assets/objects/{object_key}` | GET | encoded path | image bytes | product UI |

Cart and wishlist responses contain IDs only. `useCommerce` joins them with the catalog query; components never assume a nested product response.
