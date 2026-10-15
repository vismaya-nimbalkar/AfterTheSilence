"use client";

import { createContext, useCallback, useContext, useState, useEffect } from "react";

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");

  const setPreviewModeFromPage = useCallback((enabled) => {
    setPreviewMode(Boolean(enabled));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ats_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch (error) {
      console.error("Could not load the saved cart:", error);
    } finally {
      setCartLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem("ats_cart", JSON.stringify(cart));
    } catch (error) {
      console.error("Could not save the cart:", error);
    }
  }, [cart, cartLoaded]);

  const cartProductIds = cart.map((item) => item.id).join(",");

  const refreshCartAvailability = useCallback(async () => {
    if (!cartLoaded) return;
    if (!cartProductIds) {
      setAvailabilityChecked(true);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityChecked(false);
    setAvailabilityError("");

    try {
      const response = await fetch(
        `/api/shop/products${previewMode ? "?preview=1" : ""}`,
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not check product availability.");
      }

      const productsById = new Map((data.products || []).map((product) => [product.id, product]));
      setCart((currentCart) =>
        currentCart.map((item) => {
          const product = productsById.get(item.id);
          return {
            ...item,
            is_published: Boolean(product),
            is_in_stock: Boolean(product) && product.is_in_stock !== false,
          };
        })
      );
      setAvailabilityChecked(true);
    } catch (error) {
      setAvailabilityError(error.message || "Could not check product availability.");
    } finally {
      setAvailabilityLoading(false);
    }
  }, [cartLoaded, cartProductIds, previewMode]);

  useEffect(() => {
    if (cartLoaded) refreshCartAvailability();
  }, [cartLoaded, refreshCartAvailability]);

  const addToCart = (product, quantity = 1) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const clearCart = () => setCart([]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        subtotal,
        isOpen,
        setIsOpen,
        availabilityLoading,
        availabilityChecked,
        availabilityError,
        refreshCartAvailability,
        previewMode,
        setPreviewMode: setPreviewModeFromPage,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}