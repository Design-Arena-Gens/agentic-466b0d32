import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  query: z.string().min(2, "La requête doit contenir au moins 2 caractères."),
  location: z.string().min(2, "Indique une zone géographique valide."),
  radius: z
    .number()
    .int()
    .min(500, "Le rayon minimum est de 500 mètres.")
    .max(50000, "Le rayon maximum est de 50 km.")
    .default(5000)
    .optional(),
  vibe: z.string().max(280).optional(),
  tone: z.string().max(120).optional(),
  maxResults: z.number().int().min(1).max(8).default(5).optional(),
});

type GoogleGeocodeResult = {
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
};

type GooglePlaceSummary = {
  formatted_address?: string;
  name?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  place_id: string;
};

type GooglePlaceDetails = {
  place_id: string;
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  opening_hours?: {
    weekday_text?: string[];
  };
  editorial_summary?: {
    overview?: string;
  };
  reviews?: Array<{
    author_name?: string;
    text?: string;
    rating?: number;
  }>;
};

type GroqPitch = {
  placeId: string;
  vibeSummary: string;
  angle: string;
  personalizedMessage: string;
};

type EnrichedBusiness = GooglePlaceDetails & {
  googleMapsUrl: string;
  distanceText?: string;
};

const GOOGLE_PLACES_TEXT_SEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACES_DETAILS =
  "https://maps.googleapis.com/maps/api/place/details/json";
const GOOGLE_GEOCODE =
  "https://maps.googleapis.com/maps/api/geocode/json";

async function geocodeLocation(address: string, apiKey: string) {
  const geocodeUrl = new URL(GOOGLE_GEOCODE);
  geocodeUrl.searchParams.set("address", address);
  geocodeUrl.searchParams.set("key", apiKey);

  const res = await fetch(geocodeUrl.toString());
  if (!res.ok) {
    throw new Error("Geocoding request failed.");
  }
  const data = await res.json();
  if (data.status !== "OK" || !data.results?.length) {
    throw new Error("Impossible de localiser cette zone.");
  }

  const primary: GoogleGeocodeResult = data.results[0];
  return primary.geometry.location;
}

async function fetchPlaces(
  query: string,
  coords: { lat: number; lng: number },
  radius: number,
  apiKey: string,
) {
  const url = new URL(GOOGLE_PLACES_TEXT_SEARCH);
  url.searchParams.set("query", query);
  url.searchParams.set("location", `${coords.lat},${coords.lng}`);
  url.searchParams.set("radius", String(radius));
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("La recherche Google Places a échoué.");
  }
  const data = await response.json();
  if (!["OK", "ZERO_RESULTS"].includes(data.status)) {
    throw new Error(
      data.error_message ??
        "Google Places a retourné une réponse inattendue.",
    );
  }

  const summaries: GooglePlaceSummary[] = data.results ?? [];
  return summaries;
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<GooglePlaceDetails | null> {
  const url = new URL(GOOGLE_PLACES_DETAILS);
  url.searchParams.set("place_id", placeId);
  url.searchParams.set(
    "fields",
    [
      "place_id",
      "name",
      "formatted_address",
      "formatted_phone_number",
      "website",
      "rating",
      "user_ratings_total",
      "business_status",
      "types",
      "opening_hours",
      "editorial_summary",
      "reviews",
    ].join(","),
  );
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    return null;
  }
  const data = await res.json();
  if (data.status !== "OK") {
    return null;
  }

  return data.result as GooglePlaceDetails;
}

function buildMapsUrl(placeId: string) {
  return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
}

async function buildGroqPitch(
  businesses: EnrichedBusiness[],
  options: {
    query: string;
    vibe?: string;
    tone?: string;
  },
) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    return [];
  }

  const payload = {
    model: "llama3-70b-8192",
    temperature: 0.4,
    max_tokens: 1200,
    messages: [
      {
        role: "system",
        content:
          "Tu es un stratège business spécialisé dans la prospection commerciale pour des agences web. Produis uniquement du JSON valide.",
      },
      {
        role: "user",
        content: [
          `Tu reçois une liste de commerces qui n'ont pas de site web et que nous souhaitons démarcher pour proposer la création d'un site.`,
          `Analyse le profil de chaque commerce et résume la vibe perçue, identifie un angle d'approche hyper pertinent et rédige un message personnalisé et chaleureux (max 120 mots) en français.`,
          options.vibe
            ? `Prends en compte le style ou vibe recherchée: "${options.vibe}".`
            : null,
          options.tone
            ? `Adopte un ton "${options.tone}".`
            : `Adopte un ton confiant, empathique et orienté résultats.`,
          `Les données des commerces (JSON): ${JSON.stringify(
            businesses.map((biz) => ({
              placeId: biz.place_id,
              name: biz.name,
              address: biz.formatted_address,
              phone: biz.formatted_phone_number,
              rating: biz.rating,
              reviews: biz.user_ratings_total,
              types: biz.types,
              summary: biz.editorial_summary?.overview,
              reviewsSamples: biz.reviews?.slice(0, 2),
            })),
          )}`,
          `Réponds STRICTEMENT au format JSON suivant: {"businesses":[{"placeId":"","vibeSummary":"","angle":"","personalizedMessage":""}]}.`,
          `Ne retourne jamais de texte hors JSON.`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
  };

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const content =
    data.choices?.[0]?.message?.content?.replace(/```json|```/g, "") ?? "";

  try {
    const parsed = JSON.parse(content) as { businesses?: GroqPitch[] };
    return parsed.businesses ?? [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleKey) {
    return NextResponse.json(
      {
        error:
          "Configure la variable d'environnement GOOGLE_MAPS_API_KEY avant d'utiliser ce service.",
      },
      { status: 500 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    body = bodySchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Entrée invalide.", details: error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Requête invalide." },
      { status: 400 },
    );
  }

  const radius = body.radius ?? 5000;
  const maxResults = body.maxResults ?? 5;

  try {
    const coords = await geocodeLocation(body.location, googleKey);
    const summaries = await fetchPlaces(
      body.query,
      coords,
      radius,
      googleKey,
    );

    if (!summaries.length) {
      return NextResponse.json({
        businesses: [],
        metadata: {
          totalFound: 0,
          totalWithoutWebsite: 0,
          location: coords,
          query: body.query,
          executedAt: new Date().toISOString(),
          note: "Aucun commerce trouvé pour cette combinaison.",
        },
      });
    }

    const subset = summaries
      .slice(0, maxResults * 2)
      .map((summary) => summary.place_id);

    const details = await Promise.all(
      subset.map(async (placeId) => {
        const detail = await fetchPlaceDetails(placeId, googleKey);
        if (!detail) {
          return null;
        }

        const enriched: EnrichedBusiness = {
          ...detail,
          googleMapsUrl: buildMapsUrl(detail.place_id),
        };
        return enriched;
      }),
    );

    const filtered = details
      .filter((item): item is EnrichedBusiness => Boolean(item))
      .filter((item) => !item.website)
      .slice(0, maxResults);

    if (!filtered.length) {
      return NextResponse.json({
        businesses: [],
        metadata: {
          totalFound: summaries.length,
          totalWithoutWebsite: 0,
          location: coords,
          query: body.query,
          executedAt: new Date().toISOString(),
          note: "Les commerces trouvés disposent déjà d'un site web.",
        },
      });
    }

    const groqPitches = await buildGroqPitch(filtered, {
      query: body.query,
      vibe: body.vibe,
      tone: body.tone,
    });

    const combined = filtered.map((biz) => {
      const pitch = groqPitches.find(
        (item) => item.placeId === biz.place_id,
      );

      return {
        ...biz,
        pitch: pitch ?? null,
      };
    });

    return NextResponse.json({
      businesses: combined,
      metadata: {
        totalFound: summaries.length,
        totalWithoutWebsite: filtered.length,
        location: coords,
        query: body.query,
        executedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Une erreur inattendue est survenue.",
      },
      { status: 500 },
    );
  }
}
