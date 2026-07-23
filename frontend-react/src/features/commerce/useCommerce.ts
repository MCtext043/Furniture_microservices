import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, schemas, type Product } from '../../services/api';
import { useAuth } from '../auth/AuthProvider';

export const commerceKeys = {
  products: ['catalog', 'products'] as const,
  cart: (user: string | null) => ['commerce', 'cart', user] as const,
  wishlist: (user: string | null) => ['commerce', 'wishlist', user] as const,
};

export function useProducts() {
  return useQuery({ queryKey: commerceKeys.products, queryFn: ({ signal }) => api.get('/catalog/products?limit=100&sort_by=name', schemas.product.array(), signal) });
}

export function useCommerce() {
  const { user } = useAuth();
  const client = useQueryClient();
  const products = useProducts();
  const cart = useQuery({ queryKey: commerceKeys.cart(user), queryFn: ({ signal }) => api.get(`/catalog/users/${encodeURIComponent(user!)}/cart/items`, schemas.cartItem.array(), signal), enabled: Boolean(user) });
  const wishlist = useQuery({ queryKey: commerceKeys.wishlist(user), queryFn: ({ signal }) => api.get(`/catalog/users/${encodeURIComponent(user!)}/wishlist`, schemas.wishlistItem.array(), signal), enabled: Boolean(user) });
  const invalidate = () => Promise.all([client.invalidateQueries({ queryKey: commerceKeys.cart(user) }), client.invalidateQueries({ queryKey: commerceKeys.wishlist(user) })]);
  const addCart = useMutation({ mutationFn: (productId: number) => api.post(`/catalog/users/${encodeURIComponent(user!)}/cart/items`, { product_id: productId, quantity: 1 }, schemas.cartItem), onSuccess: invalidate });
  const updateCart = useMutation({ mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) => api.patch(`/catalog/users/${encodeURIComponent(user!)}/cart/items/${itemId}`, { quantity }, schemas.cartItem), onSuccess: invalidate });
  const removeCart = useMutation({ mutationFn: (itemId: number) => api.delete(`/catalog/users/${encodeURIComponent(user!)}/cart/items/${itemId}`), onSuccess: invalidate });
  const toggleWishlist = useMutation({ mutationFn: async (productId: number) => wishlist.data?.some(x => x.product_id === productId) ? api.delete(`/catalog/users/${encodeURIComponent(user!)}/wishlist/products/${productId}`) : api.post(`/catalog/users/${encodeURIComponent(user!)}/wishlist/products/${productId}`, undefined, schemas.wishlistItem), onSuccess: invalidate });
  const productMap = new Map((products.data ?? []).map(p => [p.id, p]));
  const cartRows = (cart.data ?? []).map(item => ({ item, product: productMap.get(item.product_id) })).filter((row): row is { item: typeof row.item; product: Product } => Boolean(row.product));
  const favoriteProducts = (wishlist.data ?? []).map(item => productMap.get(item.product_id)).filter((product): product is Product => Boolean(product));
  const subtotal = cartRows.reduce((sum, row) => sum + row.product.price * row.item.quantity, 0);
  return { user, products, cart, wishlist, cartRows, favoriteProducts, subtotal, addCart, updateCart, removeCart, toggleWishlist, cartCount: (cart.data ?? []).reduce((sum, row) => sum + row.quantity, 0), wishlistCount: wishlist.data?.length ?? 0 };
}
