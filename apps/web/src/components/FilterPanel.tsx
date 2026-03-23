const specialties = [
  "Engineering",
  "Design",
  "Data",
  "Security",
  "DevOps",
  "Product",
] as const;

const tiers = ["Starter", "Pro", "Enterprise"] as const;

const sortOptions = [
  { value: "rating-desc", label: "Top Rated" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "name-asc", label: "Name: A-Z" },
] as const;

interface FilterPanelProps {
  specialty?: string;
  tier?: string;
  sort?: string;
  onSpecialtyChange: (v: string | undefined) => void;
  onTierChange: (v: string | undefined) => void;
  onSortChange: (v: string | undefined) => void;
}

export function FilterPanel({
  specialty,
  tier,
  sort,
  onSpecialtyChange,
  onTierChange,
  onSortChange,
}: FilterPanelProps) {
  return (
    <div className="lg:w-56 flex-shrink-0 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Specialty</h3>
        <div className="flex flex-wrap lg:flex-col gap-2">
          {specialties.map((s) => (
            <button
              key={s}
              onClick={() =>
                onSpecialtyChange(specialty === s ? undefined : s)
              }
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-left ${
                specialty === s
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Tier</h3>
        <div className="flex flex-wrap lg:flex-col gap-2">
          {tiers.map((t) => (
            <button
              key={t}
              onClick={() => onTierChange(tier === t ? undefined : t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-left ${
                tier === t
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Sort By</h3>
        <select
          value={sort ?? ""}
          onChange={(e) =>
            onSortChange(e.target.value || undefined)
          }
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          <option value="">Default</option>
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
