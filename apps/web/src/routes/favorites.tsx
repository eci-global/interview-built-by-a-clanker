import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { useAuth } from "~/lib/auth";
import { queryClient } from "~/lib/queryClient";
import { PersonaCard } from "~/components/PersonaCard";
import type { Persona } from "@acme/shared";

export const Route = createFileRoute("/favorites")({
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: () => api.get<{ favorites: Persona[] }>("/favorites"),
    enabled: !!user,
  });

  const removeFavorite = useMutation({
    mutationFn: (personaId: string) =>
      api.delete(`/favorites/${personaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  if (!user) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Sign in to view favorites
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
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border p-6 animate-pulse h-48"
          />
        ))}
      </div>
    );
  }

  const favorites = data?.favorites ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Favorites</h1>

      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg mb-4">
            You haven't favorited any personas yet.
          </p>
          <Link
            to="/"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Browse personas
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {favorites.map((persona) => (
            <div key={persona.id} className="relative">
              <PersonaCard persona={persona} />
              <button
                onClick={() => removeFavorite.mutate(persona.id)}
                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow hover:bg-gray-50 transition-colors"
                title="Remove from favorites"
              >
                <svg
                  className="w-5 h-5 text-red-500 fill-red-500"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
