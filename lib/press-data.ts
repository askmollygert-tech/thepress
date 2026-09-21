import { supabase } from "./supabase";

function client() {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  return supabase;
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await client().auth.signUp({ email, password, options: { data: { display_name: displayName } } });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function createGuestProfile(displayName: string, email?: string, preferredPlayingHandicap?: number) {
  const { data: auth } = await client().auth.getUser();
  if (!auth.user) throw new Error("Sign in before adding a guest golfer.");
  const { data, error } = await client().from("profiles").insert({
    display_name: displayName, email: email || null, preferred_playing_handicap: preferredPlayingHandicap ?? null,
    is_guest: true, created_by: auth.user.id,
  }).select().single();
  if (error) throw error;
  return data;
}

export async function createRound(input: {
  courseName: string; scheduledAt?: string; startingHole: number; format: string;
  players: Array<{ profileId: string; team: "A" | "B" | "INDIVIDUAL"; playingHandicap: number; isGuest?: boolean }>;
}) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("Sign in before creating a round.");
  const { data: round, error: roundError } = await db.from("rounds").insert({
    course_name: input.courseName, scheduled_at: input.scheduledAt || null, starting_hole: input.startingHole,
    format: input.format, created_by: auth.user.id,
  }).select().single();
  if (roundError) throw roundError;
  const { error: playersError } = await db.from("round_players").insert(input.players.map((player) => ({
    round_id: round.id, profile_id: player.profileId, team: player.team, playing_handicap: player.playingHandicap,
    invitation_status: player.isGuest ? "guest" : "pending",
  })));
  if (playersError) throw playersError;
  return round;
}

export async function saveScore(roundId: string, profileId: string, holeNumber: number, grossScore: number) {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) throw new Error("Sign in before scoring.");
  const { data, error } = await db.from("scores").upsert({
    round_id: roundId, profile_id: profileId, hole_number: holeNumber, gross_score: grossScore,
    entered_by: auth.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "round_id,profile_id,hole_number" }).select().single();
  if (error) throw error;
  return data;
}

export function subscribeToRound(roundId: string, onChange: () => void) {
  const db = client();
  const channel = db.channel(`round:${roundId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "scores", filter: `round_id=eq.${roundId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "presses", filter: `round_id=eq.${roundId}` }, onChange)
    .subscribe();
  return () => { void db.removeChannel(channel); };
}

