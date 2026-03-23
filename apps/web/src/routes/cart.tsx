import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { queryClient } from "~/lib/queryClient";
import { CartItem } from "~/components/CartItem";
import type { Cart } from "@acme/shared";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<Cart>("/cart"),
    enabled: !!user,
  });

  const updateQuantity = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      api.put<Cart>(`/cart/${itemId}`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.delete<Cart>(`/cart/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  if (!user) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sign in to view your cart
        </h2>
        <Link
          to="/login"
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Go to sign in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-6 h-24" />
        ))}
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Your cart is empty
        </h2>
        <p className="text-gray-600 mb-4">
          Browse our personas and add some to your cart.
        </p>
        <Link
          to="/"
          className="text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Browse personas
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-4">
          {cart.items.map((item) => (
            <CartItem
              key={item.id}
              item={item}
              onUpdateQuantity={(quantity) =>
                updateQuantity.mutate({ itemId: item.id, quantity })
              }
              onRemove={() => removeItem.mutate(item.id)}
            />
          ))}
        </div>

        <div className="lg:w-80">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Order Summary
            </h3>
            <div className="space-y-2 mb-4">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {item.persona.name} x{item.quantity}
                  </span>
                  <span className="text-gray-900">
                    ${(item.persona.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-lg font-bold text-gray-900">
                ${cart.total.toFixed(2)}
              </span>
            </div>
            <button
              onClick={() => navigate({ to: "/checkout" })}
              className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
