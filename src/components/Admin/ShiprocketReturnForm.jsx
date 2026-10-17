"use client";

import { useState } from "react";

export default function ShiprocketReturnForm({ order, action, products, productsError, disabled, onCancel, onSubmit }) {
  const normalItems = (order.items || []).filter((item) =>
    Number(item.shipping_weight_kg) > 0
      && Number(item.shipping_length_cm) > 0
      && Number(item.shipping_width_cm) > 0
      && Number(item.shipping_height_cm) > 0
  );
  const availableProducts = products.filter((product) => product.is_published && product.is_in_stock !== false);
  const [returnQuantities, setReturnQuantities] = useState(() => Object.fromEntries(
    normalItems.map((item) => [String(item.product_id), String(item.quantity)])
  ));
  const [replacementItems, setReplacementItems] = useState(() => [
    { product_id: availableProducts[0]?.id || "", quantity: 1 },
  ]);

  const submit = (event) => {
    event.preventDefault();
    const selectedItems = normalItems
      .map((item) => ({ product_id: item.product_id, quantity: Number(returnQuantities[String(item.product_id)] || 0) }))
      .filter((item) => item.quantity > 0);
    const selectedReplacements = replacementItems
      .filter((item) => item.product_id && Number(item.quantity) > 0)
      .map((item) => ({ ...item, quantity: Number(item.quantity) }));
    onSubmit({
      items: selectedItems,
      replacementItems: action === "exchange" ? selectedReplacements : undefined,
    });
  };

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-dark/10 p-4 dark:border-light/10">
      <h4 className="text-xs font-bold uppercase opacity-70">
        {action === "exchange" ? "Return and replacement shipment" : "Return pickup"}
      </h4>
      <div className="space-y-2">
        {normalItems.map((item) => (
          <label key={item.product_id} className="flex items-center justify-between gap-4 text-xs">
            <span>{item.title} (ordered: {item.quantity})</span>
            <input
              type="number"
              min="0"
              max={item.quantity}
              value={returnQuantities[String(item.product_id)] || "0"}
              aria-label={`Return quantity for ${item.title}`}
              onChange={(event) => setReturnQuantities((current) => ({
                ...current,
                [String(item.product_id)]: event.target.value,
              }))}
              className="w-20 rounded-lg border border-dark/10 bg-transparent px-2 py-2 dark:border-light/10"
            />
          </label>
        ))}
      </div>
      {action === "exchange" && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold">Replacement products</h5>
          {productsError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{productsError}</p>}
          {replacementItems.map((item, index) => (
            <div key={index} className="flex gap-2">
              <select
                required
                aria-label="Replacement product"
                value={item.product_id}
                onChange={(event) => setReplacementItems((current) => current.map((entry, row) => (
                  row === index ? { ...entry, product_id: event.target.value } : entry
                )))}
                className="min-w-0 flex-1 rounded-lg border border-dark/10 bg-transparent px-2 py-2 text-xs dark:border-light/10"
              >
                <option value="">Choose a normal product</option>
                {availableProducts.map((product) => (
                  <option key={product.id} value={product.id}>{product.title}</option>
                ))}
              </select>
              <input
                type="number"
                required
                min="1"
                max="99"
                aria-label="Replacement quantity"
                value={item.quantity}
                onChange={(event) => setReplacementItems((current) => current.map((entry, row) => (
                  row === index ? { ...entry, quantity: event.target.value } : entry
                )))}
                className="w-20 rounded-lg border border-dark/10 bg-transparent px-2 py-2 text-xs dark:border-light/10"
              />
              {replacementItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReplacementItems((current) => current.filter((_, row) => row !== index))}
                  className="rounded-lg border border-dark/10 px-2 text-xs dark:border-light/10"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            disabled={!availableProducts.length}
            onClick={() => setReplacementItems((current) => [...current, {
              product_id: availableProducts[0]?.id || "",
              quantity: 1,
            }])}
            className="text-xs underline disabled:opacity-50"
          >
            Add replacement product
          </button>
          {!availableProducts.length && (
            <p className="text-xs text-amber-700 dark:text-amber-300">No normal products are currently available to exchange.</p>
          )}
        </div>
      )}
      <p className="text-xs opacity-60">Shiprocket will pick up the selected units from the customer. Exchange replacement shipping is booked to the original address.</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-dark/10 px-3 py-2 text-xs dark:border-light/10">
          Close
        </button>
        <button
          type="submit"
          disabled={disabled || !normalItems.length || !availableProducts.length && action === "exchange"}
          className="rounded-lg bg-dark px-3 py-2 text-xs font-semibold text-light disabled:opacity-50 dark:bg-light dark:text-dark"
        >
          {disabled ? "Creating..." : action === "exchange" ? "Create exchange" : "Create return pickup"}
        </button>
      </div>
    </form>
  );
}
