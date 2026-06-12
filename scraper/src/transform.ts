export interface ApiVenue {
  IdRecinto: number;
  Recinto: string;
  Ocupacion: number;
  Entradas: number;
  Salidas: number;
  Aforo: number;
}

export interface Reading {
  id: string;
  timestamp: string;
  venueId: number;
  venueName: string;
  occupancy: number;
  entries: number;
  exits: number;
  capacity: number;
}

export function toReadings(venues: ApiVenue[], timestamp: string): Reading[] {
  return venues
    .filter((v) => v.Aforo > 0)
    .map((v) => ({
      id: crypto.randomUUID(),
      timestamp,
      venueId: v.IdRecinto,
      venueName: v.Recinto,
      occupancy: v.Ocupacion,
      entries: v.Entradas,
      exits: v.Salidas,
      capacity: v.Aforo,
    }));
}
