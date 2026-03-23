import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { queryClient } from "~/lib/queryClient";
import type { Cart, Order } from "@acme/shared";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<Order | null>(null);

  const { data: cart, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: () => api.get<Cart>("/cart"),
    enabled: !!user,
  });

  const checkout = useMutation({
    mutationFn: () => api.post<Order>("/checkout", { name, email }),
    onSuccess: (data) => {
      setOrder(data);
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  if (!user) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sign in to checkout
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

  if (order) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Order Confirmed!
        </h2>
        <p className="text-gray-600 mb-2">
          Order ID: <span className="font-mono">{order.id}</span>
        </p>
        <p className="text-gray-600 mb-6">
          Total: <span className="font-bold">${order.total.toFixed(2)}</span>
        </p>
        <p className="text-gray-500 mb-8">
          Your agentic personas are being deployed to your workspace. You'll
          receive a confirmation email at {order.customerEmail}.
        </p>
        <Link
          to="/"
          className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Nothing to checkout
        </h2>
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
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Order Summary
        </h3>
        <div className="space-y-3 mb-4">
          {cart.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <span className="text-gray-700">
                {item.persona.name}{" "}
                <span className="text-gray-400">x{item.quantity}</span>
              </span>
              <span className="font-medium">
                ${(item.persona.price * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="border-t pt-3 flex justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">${cart.total.toFixed(2)}</span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          checkout.mutate();
        }}
        className="bg-white rounded-xl border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Contact Information
        </h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              placeholder="jane@example.com"
            />
          </div>
        </div>

        {checkout.error && (
          <p className="mt-4 text-red-600 text-sm">
            {checkout.error.message}
          </p>
        )}

        <button
          type="submit"
          disabled={checkout.isPending}
          className="mt-6 w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {checkout.isPending ? "Processing..." : "Place Order"}
        </button>
      </form>
    </div>
  );
}
