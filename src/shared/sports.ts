/** Every sport the app knows. Adding one = a module under src/sports/<id> plus an entry here. */
export const SPORTS = [
  { id: "run", label: "Run" },
  { id: "hike", label: "Hike" },
] as const;

export type SportId = (typeof SPORTS)[number]["id"];

export const isSportId = (value: string): value is SportId => SPORTS.some((s) => s.id === value);
