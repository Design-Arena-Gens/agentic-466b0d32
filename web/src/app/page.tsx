'use client';

import { FormEvent, useMemo, useState } from "react";

type Pitch = {
  placeId: string;
  vibeSummary: string;
  angle: string;
  personalizedMessage: string;
};

type Business = {
  place_id: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  googleMapsUrl: string;
  editorial_summary?: { overview?: string };
  opening_hours?: { weekday_text?: string[] };
  reviews?: Array<{
    author_name?: string;
    text?: string;
    rating?: number;
  }>;
  pitch: Pitch | null;
};

type ApiResponse = {
  businesses: Business[];
  metadata?: {
    totalFound: number;
    totalWithoutWebsite: number;
    query: string;
    executedAt: string;
  };
  error?: string;
  details?: Record<string, string[]>;
};

const radiusOptions = [
  { label: "500 m", value: 500 },
  { label: "1 km", value: 1000 },
  { label: "3 km", value: 3000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "20 km", value: 20000 },
  { label: "50 km", value: 50000 },
];

const toneOptions = [
  { label: "Tonalité par défaut", value: "" },
  { label: "Très chaleureuse", value: "chaleureux et enthousiaste" },
  { label: "Premium", value: "haut de gamme, exclusif" },
  { label: "Ultra direct", value: "direct et orienté ROI" },
  { label: "Créatif", value: "créatif et audacieux" },
];

export default function Home() {
  const [query, setQuery] = useState("restaurant");
  const [location, setLocation] = useState("Paris, France");
  const [radius, setRadius] = useState<number>(5000);
  const [maxResults, setMaxResults] = useState<number>(5);
  const [vibe, setVibe] = useState("");
  const [tone, setTone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Business[]>([]);
  const [metadata, setMetadata] = useState<ApiResponse["metadata"] | null>(
    null,
  );
  const [copiedPlaceId, setCopiedPlaceId] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setCopiedPlaceId(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          location,
          radius,
          maxResults,
          vibe: vibe || undefined,
          tone: tone || undefined,
        }),
      });

      const data: ApiResponse = await response.json();
      if (!response.ok) {
        const details = data.details
          ? Object.values(data.details).flat().join(", ")
          : data.error;
        setError(details ?? "Une erreur est survenue.");
        setResults([]);
        setMetadata(data.metadata ?? null);
        return;
      }

      setResults(data.businesses ?? []);
      setMetadata(data.metadata ?? null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur réseau, réessaie dans quelques instants.",
      );
      setResults([]);
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  };

  const copyMessage = async (message: string, placeId: string) => {
    try {
      await navigator.clipboard.writeText(message);
      setCopiedPlaceId(placeId);
      setTimeout(() => setCopiedPlaceId(null), 3000);
    } catch {
      setError(
        "Impossible de copier dans le presse-papiers. Copie manuellement.",
      );
    }
  };

  const emptyState = useMemo(
    () =>
      !loading &&
      !error &&
      metadata &&
      (!results || results.length === 0),
    [loading, error, metadata, results],
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-800 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 pb-16 pt-12">
        <header className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
            Agent IA · Prospection Web
          </p>
          <h1 className="text-4xl font-semibold leading-tight">
            Détecte les commerces sans site web,&nbsp;
            <span className="text-sky-300">
              trouve la vibe parfaite et lance un message qui convertit.
            </span>
          </h1>
          <p className="max-w-2xl text-base text-slate-300">
            Sélectionne un type de commerce, une zone, et laisse l’agent
            analyser Google Maps pour révéler les opportunités à fort impact.
            Chaque fiche inclut un angle d&apos;attaque affûté et un message
            prêt à être envoyé.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur-md md:grid-cols-[2fr,1fr]"
        >
          <div className="space-y-4">
            <div>
              <label
                htmlFor="query"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Type de commerce ou mot-clé
              </label>
              <input
                id="query"
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                placeholder="Ex: barber shop, yoga studio, etc."
                required
              />
            </div>
            <div>
              <label
                htmlFor="location"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Zone géographique ciblée
              </label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                placeholder="Ville, arrondissement, quartier..."
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="radius"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Rayon d&apos;analyse
                </label>
                <select
                  id="radius"
                  value={radius}
                  onChange={(event) =>
                    setRadius(Number(event.target.value) || 5000)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                >
                  {radiusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="maxResults"
                  className="mb-2 block text-sm font-medium text-white/80"
                >
                  Nombre maximum de prospects
                </label>
                <input
                  id="maxResults"
                  type="number"
                  min={1}
                  max={8}
                  value={maxResults}
                  onChange={(event) =>
                    setMaxResults(
                      Math.min(8, Math.max(1, Number(event.target.value))),
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="vibe"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Vibe recherchée (optionnel)
              </label>
              <textarea
                id="vibe"
                value={vibe}
                onChange={(event) => setVibe(event.target.value)}
                className="h-24 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                placeholder="Style, positionnement, cible idéale..."
              />
            </div>
            <div>
              <label
                htmlFor="tone"
                className="mb-2 block text-sm font-medium text-white/80"
              >
                Tonalité du message (optionnel)
              </label>
              <select
                id="tone"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-base text-white focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                {toneOptions.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              {loading ? "Analyse en cours..." : "Lancer l'agent"}
            </button>
          </div>
        </form>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-100">
            {error}
          </div>
        )}

        {metadata && (
          <div className="flex flex-wrap items-center gap-4 text-sm text-white/60">
            <span>
              Requête:&nbsp;
              <span className="font-medium text-white">
                {metadata.query}
              </span>
            </span>
            <span>
              Prospects sans site:&nbsp;
              <span className="font-medium text-sky-300">
                {metadata.totalWithoutWebsite}
              </span>{" "}
              / {metadata.totalFound}
            </span>
            <span>
              Exécution:&nbsp;
              {new Date(metadata.executedAt).toLocaleString()}
            </span>
          </div>
        )}

        {emptyState && (
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-10 text-center text-sm text-white/70">
            Aucun commerce sans site web dans cette zone. Essaie un autre
            mot-clé, élargis le rayon ou change de ville.
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {results.map((business) => (
            <article
              key={business.place_id}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 p-6 backdrop-blur"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {business.name}
                  </h2>
                  <p className="text-sm text-white/70">
                    {business.formatted_address ?? "Adresse non renseignée"}
                  </p>
                </div>
                <a
                  href={business.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-sky-200 transition hover:border-sky-300 hover:bg-sky-500/10"
                >
                  Voir sur Maps
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                {business.rating ? (
                  <span>
                    ⭐ {business.rating.toFixed(1)} ({business.user_ratings_total}{" "}
                    avis)
                  </span>
                ) : (
                  <span>⭐ Aucun avis public</span>
                )}

                {business.business_status && (
                  <span className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] uppercase tracking-wide">
                    {business.business_status.replaceAll("_", " ")}
                  </span>
                )}

                {business.types && business.types.length > 0 && (
                  <span className="truncate rounded-full border border-white/10 bg-white/10 px-2 py-1 text-[11px] uppercase tracking-wide">
                    {business.types.slice(0, 3).join(" · ")}
                  </span>
                )}
              </div>

              {business.editorial_summary?.overview && (
                <p className="text-sm text-white/70">
                  {business.editorial_summary.overview}
                </p>
              )}

              {business.pitch ? (
                <div className="space-y-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">
                    Vibe perçue
                  </p>
                  <p className="text-sm text-sky-100">
                    {business.pitch.vibeSummary}
                  </p>

                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">
                    Angle recommandé
                  </p>
                  <p className="text-sm text-sky-100">{business.pitch.angle}</p>

                  <p className="text-xs uppercase tracking-[0.2em] text-sky-200">
                    Message à envoyer
                  </p>
                  <div className="rounded-xl bg-slate-950/40 p-3 text-sm text-white/90">
                    {business.pitch.personalizedMessage}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyMessage(
                        business.pitch!.personalizedMessage,
                        business.place_id,
                      )
                    }
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300 transition hover:text-sky-200"
                  >
                    {copiedPlaceId === business.place_id
                      ? "Message copié ✓"
                      : "Copier le message"}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                  Message non généré (clé Groq absente ou réponse vide). Tu
                  peux tout de même contacter ce commerce avec ton propre
                  pitch.
                </div>
              )}

              {business.opening_hours?.weekday_text && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                  <p className="mb-2 font-semibold text-white/70">
                    Horaires & insights
                  </p>
                  <ul className="space-y-1">
                    {business.opening_hours.weekday_text.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
