"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Flag,
  History,
  ImagePlus,
  MapPin,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  holeState,
  matchPosition,
  nextHole,
  playingOrder,
  strokesOnHole,
} from "@/lib/scoring";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  getMyProfile,
  searchGolfers,
  sendFriendRequest,
  signIn,
  signOut,
  signUp,
  updateMyProfile,
} from "@/lib/press-data";

type Player = { id: number; name: string; handicap: number; team: "A" | "B" };
type Language = "af" | "en";
type SocialProfile = {
  name: string;
  nickname: string;
  homeClub: string;
  excuse: string;
  photo: string;
};
type Friend = {
  id: string;
  name: string;
  nickname: string;
  club: string;
  initials: string;
};
const defaultPlayers: Player[] = [
  { id: 1, name: "Golfer 1", handicap: 0, team: "A" },
  { id: 2, name: "Golfer 2", handicap: 0, team: "A" },
  { id: 3, name: "Golfer 3", handicap: 0, team: "B" },
  { id: 4, name: "Golfer 4", handicap: 0, team: "B" },
];
const pars = [4, 4, 3, 5, 4, 4, 5, 3, 4, 4, 5, 4, 3, 4, 4, 5, 3, 4];
const indexes = [7, 3, 15, 1, 11, 5, 17, 13, 9, 8, 4, 12, 16, 2, 10, 6, 18, 14];
const holes = pars.map((par, i) => ({
  number: i + 1,
  par,
  stroke: indexes[i],
}));
const formats = [
  "Betterball Match Play",
  "Fourball Match Play",
  "Betterball Stableford",
  "Individual Stableford",
  "Combined Stableford",
  "Stroke Play",
  "Skins",
];
const formatLabels: Record<Language, Record<string, string>> = {
  af: {
    "Betterball Match Play": "Beterbal Putjiespel",
    "Fourball Match Play": "Vierbal Putjiespel",
    "Betterball Stableford": "Beterbal Stableford",
    "Individual Stableford": "Individuele Stableford",
    "Combined Stableford": "Gekombineerde Stableford",
    "Stroke Play": "Houespel",
    Skins: "Skins",
  },
  en: Object.fromEntries(formats.map((format) => [format, format])),
};
const banter = {
  af: [
    "Die selfvertroue is verdag hoog vir so vroeg in die rondte.",
    "Die telkaart is gewaarsku. Die bome nog nie.",
    "Vier golfers. Agtien putjies. Heelwat kreatiewe verduidelikings.",
    "Geen gimmes is beseer tydens die maak van hierdie wedstryd nie.",
  ],
  en: [
    "Confidence: suspiciously high for this early in the round.",
    "The scorecard has been warned. The trees have not.",
    "Four golfers. Eighteen holes. Several creative explanations.",
    "No gimmes were harmed in the making of this match.",
  ],
};
const suggestedGolfers: Friend[] = [
  {
    id: "demo-1",
    name: "Piet Birdie",
    nickname: "Kaptein Kalkulator",
    club: "Voorbeeld Gholfklub",
    initials: "PB",
  },
  {
    id: "demo-2",
    name: "Jan Yster",
    nickname: "Mnr. Mulligan",
    club: "Voorbeeld Gholfklub",
    initials: "JY",
  },
  {
    id: "demo-3",
    name: "Koos Woods",
    nickname: "Die Stil Sluipmoordenaar",
    club: "Voorbeeld Gholfklub",
    initials: "KW",
  },
];

export default function Home() {
  const [screen, setScreen] = useState<
    "home" | "setup" | "play" | "history" | "profile"
  >("home");
  const [step, setStep] = useState(1);
  const [language, setLanguage] = useState<Language>("af");
  const af = language === "af";
  const [players, setPlayers] = useState<Player[]>(defaultPlayers);
  const [course, setCourse] = useState("Wingate Park Country Club");
  const [format, setFormat] = useState(formats[0]);
  const [startingHole, setStartingHole] = useState(1);
  const [currentHole, setCurrentHole] = useState(0);
  const [scores, setScores] = useState<Record<number, Record<number, number>>>(
    {},
  );
  const [presses, setPresses] = useState<number[]>([]);
  const [toast, setToast] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [profileTab, setProfileTab] = useState<"me" | "friends">("me");
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] =
    useState<Friend[]>(suggestedGolfers);
  const [friendRequests, setFriendRequests] = useState<string[]>([]);
  const [myProfile, setMyProfile] = useState<SocialProfile>({
    name: "Jou Naam",
    nickname: "Die Bewysstuk",
    homeClub: "Jou tuisklub",
    excuse: "Die wind het net gewaai wanneer ék geslaan het.",
    photo: "",
  });
  useEffect(() => {
    const saved = localStorage.getItem("the-press-state");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.players) setPlayers(data.players);
        if (data.language) setLanguage(data.language);
        if (data.myProfile) setMyProfile(data.myProfile);
        if (data.friendRequests) setFriendRequests(data.friendRequests);
      } catch {}
    }
  }, []);
  useEffect(
    () =>
      localStorage.setItem(
        "the-press-state",
        JSON.stringify({ players, language, myProfile, friendRequests }),
      ),
    [players, language, myProfile, friendRequests],
  );
  useEffect(() => {
    if (!supabase) return;
    const load = async (email: string) => {
      setUserEmail(email);
      if (!email) return;
      try {
        const p = await getMyProfile();
        setMyProfile((old) => ({
          name: p.display_name || old.name,
          nickname: p.nickname || "",
          homeClub: p.home_club || "",
          excuse: p.fun_answer || old.excuse,
          photo: p.avatar_url || "",
        }));
      } catch {}
    };
    void supabase.auth
      .getSession()
      .then(({ data }) => load(data.session?.user.email || ""));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void load(session?.user.email || "");
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!userEmail || friendSearch.trim().length < 2) {
      setFriendResults(suggestedGolfers);
      return;
    }
    const timer = setTimeout(() => {
      void searchGolfers(friendSearch)
        .then((rows) =>
          setFriendResults(
            rows.map((p: any) => ({
              id: p.id,
              name: p.display_name,
              nickname: p.nickname || "Nog sonder ’n bynaam",
              club: p.home_club || "Klub onbekend",
              initials: String(p.display_name || "GO")
                .slice(0, 2)
                .toUpperCase(),
            })),
          ),
        )
        .catch(() => setFriendResults([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [friendSearch, userEmail]);
  const hole = holes[currentHole],
    holeScores = scores[hole?.number] || {};
  const completedHoles = useMemo(
    () =>
      holes
        .filter((h) =>
          players.every(
            (p) =>
              Number.isInteger(scores[h.number]?.[p.id]) &&
              scores[h.number][p.id] > 0,
          ),
        )
        .map((h) => h.number),
    [scores, players],
  );
  const match = useMemo(() => {
    const position = matchPosition(completedHoles, players, scores, holes);
    return position.difference === 0
      ? af
        ? "GELYKOP"
        : "ALL SQUARE"
      : `${Math.abs(position.difference)} ${af ? "VOOR" : "UP"} · ${af ? "SPAN" : "TEAM"} ${position.difference > 0 ? "A" : "B"}`;
  }, [completedHoles, scores, players, af]);
  const score = (id: number, n: number) =>
    setScores((old) => ({
      ...old,
      [hole.number]: { ...(old[hole.number] || {}), [id]: Math.max(1, n) },
    }));
  const say = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(""), 2600);
  };
  const submitAuth = async () => {
    setAuthMessage("");
    try {
      if (authMode === "signup") {
        await signUp(authEmail, authPassword, authName);
        setAuthMessage(
          "Profile created. Check your email if confirmation is required.",
        );
      } else {
        await signIn(authEmail, authPassword);
        setAuthMessage("Welcome back. The clubhouse remembers you.");
      }
    } catch (error) {
      setAuthMessage(
        error instanceof Error ? error.message : "Account action failed.",
      );
    }
  };
  const addProfilePhoto = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setMyProfile((old) => ({ ...old, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };
  const saveSocialProfile = async () => {
    try {
      if (userEmail)
        await updateMyProfile({
          displayName: myProfile.name,
          nickname: myProfile.nickname,
          homeClub: myProfile.homeClub,
          funAnswer: myProfile.excuse,
        });
      say(
        af
          ? "Profiel gestoor. Die verskoning is nou amptelik op rekord."
          : "Profile saved. The excuse is now officially on record.",
      );
    } catch (error) {
      say(
        error instanceof Error
          ? error.message
          : af
            ? "Profiel kon nie stoor nie."
            : "Profile could not be saved.",
      );
    }
  };
  const requestFriend = async (id: string) => {
    try {
      if (userEmail && !id.startsWith("demo-")) await sendFriendRequest(id);
      setFriendRequests((old) => (old.includes(id) ? old : [...old, id]));
    } catch (error) {
      say(
        error instanceof Error
          ? error.message
          : af
            ? "Versoek kon nie stuur nie."
            : "Request could not be sent.",
      );
    }
  };
  const goNext = () => {
    const missing = players
      .filter((p) => !scores[hole.number]?.[p.id])
      .map((p) => p.name);
    if (missing.length) {
      say(
        `${missing.join(", ")} ${af ? (missing.length === 1 ? "kort nog ’n telling" : "kort nog tellings") : missing.length === 1 ? "still needs a score" : "still need scores"}.`,
      );
      return;
    }
    const order = playingOrder(startingHole);
    if (hole.number === order[order.length - 1]) {
      setScreen("history");
      say(
        af
          ? "Rondte voltooi. Die bewyse is veilig."
          : "Round complete. The evidence is secure.",
      );
      return;
    }
    const number = nextHole(hole.number, startingHole);
    setCurrentHole(number - 1);
  };
  const goPrevious = () => {
    const order = playingOrder(startingHole);
    const index = order.indexOf(hole.number);
    setCurrentHole(order[Math.max(0, index - 1)] - 1);
  };
  return (
    <main className="min-h-dvh pb-24">
      <header>
        <div className="header-inner">
          <button onClick={() => setScreen("home")} className="brand">
            <span>
              <Flag />
            </span>
            <b>
              THE PRESS
              <small>
                {af ? "Golf. Griewe. Glorie." : "Golf. Grudges. Glory."}
              </small>
            </b>
          </button>
          <div className="header-actions">
            <button
              className="language-toggle"
              onClick={() => setLanguage(af ? "en" : "af")}
              aria-label="Change language"
            >
              <b>{language.toUpperCase()}</b>
              <span>{af ? "EN" : "AF"}</span>
            </button>
            <button
              onClick={() => setScreen("profile")}
              className="avatar"
              aria-label={af ? "Maak golferprofiel oop" : "Open golfer profile"}
            >
              {userEmail ? userEmail.slice(0, 2).toUpperCase() : "GO"}
            </button>
          </div>
        </div>
      </header>
      {screen === "home" && (
        <div className="wrap home">
          <section className="hero">
            <p className="eyebrow">
              <Sparkles />{" "}
              {af ? "Reg om bewyse te skep?" : "Ready to create evidence?"}
            </p>
            <h1>
              {af ? "SWAK GOLF." : "BAD GOLF."}
              <br />
              <em>{af ? "GROOT KOMPETISIE." : "GREAT COMPETITION."}</em>
            </h1>
            <p>
              {banter[language][new Date().getDay() % banter[language].length]}
            </p>
            <Button
              onClick={() => {
                setScreen("setup");
                setStep(1);
              }}
              className="main-cta"
            >
              <Plus /> {af ? "BEGIN ’N NUWE SPEL" : "START A NEW GAME"}
            </Button>
          </section>
          <section className="action-grid">
            <Action
              icon={<History />}
              title={af ? "Vorige misdade" : "Past crimes"}
              sub={
                af
                  ? "Rondtes en permanente bewyse"
                  : "Rounds & permanent evidence"
              }
              onClick={() => setScreen("history")}
            />
            <Action
              icon={<Trophy />}
              title={af ? "Punteleer" : "Leaderboard"}
              sub={
                af
                  ? "Kampioene, chokers en verskonings"
                  : "Champions, chokers & excuses"
              }
            />
            <Action
              icon={<Users />}
              title={af ? "Die gewone verdagtes" : "The usual suspects"}
              sub={
                af
                  ? `${players.length} golfers gestoor`
                  : `${players.length} golfers saved`
              }
            />
          </section>
          <div className="section-title">
            <div>
              <p className="eyebrow">{af ? "Laaste rondte" : "Last round"}</p>
              <h2>{af ? "DIE BEWYSEKAS" : "THE EVIDENCE LOCKER"}</h2>
            </div>
            <span className="stamp">{af ? "AFGEHANDEL" : "SETTLED"}</span>
          </div>
          <article className="result">
            <div>
              <small className="winner">
                {af ? "DIE BEWYSEKAS" : "THE EVIDENCE LOCKER"}
              </small>
              <h3>
                {af
                  ? "Nog geen voltooide rondtes nie"
                  : "No completed rounds yet"}
              </h3>
              <p>
                {af
                  ? "Jou eerste uitslag word hier verewig—verskonings ingesluit."
                  : "Your first result will be preserved here—excuses included."}
              </p>
            </div>
            <div className="big-result">
              0<span>&</span>0
            </div>
            <div className="right">
              <small>{af ? "STATUS" : "STATUS"}</small>
              <h3>{af ? "Skoon bladsy" : "Clean slate"}</h3>
              <p>
                {af ? "Geniet dit terwyl dit hou." : "Enjoy it while it lasts."}
              </p>
            </div>
          </article>
        </div>
      )}
      {screen === "setup" && (
        <div className="wrap setup">
          <div className="setup-head">
            <button
              onClick={() => (step > 1 ? setStep(step - 1) : setScreen("home"))}
            >
              <ChevronLeft />
              {af ? "Terug" : "Back"}
            </button>
            <span>
              {af ? "STAP" : "STEP"} {step} {af ? "VAN" : "OF"} 3
            </span>
          </div>
          <div className="progress">
            {[1, 2, 3].map((s) => (
              <i className={s <= step ? "on" : ""} key={s} />
            ))}
          </div>
          {step === 1 && (
            <section>
              <p className="eyebrow">
                <Flag /> {af ? "Die slagveld" : "The battlefield"}
              </p>
              <h1 className="setup-title">
                {af
                  ? "WAAR VERLOOR ONS VANDAG BALLE?"
                  : "WHERE ARE WE LOSING BALLS?"}
              </h1>
              <label>{af ? "Gholfbaan" : "Golf course"}</label>
              <input
                className="big-input"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
              <label className="start-label">
                {af ? "Begin-putjie" : "Starting hole"}
              </label>
              <div className="start-options">
                <button
                  className={startingHole === 1 ? "selected" : ""}
                  onClick={() => setStartingHole(1)}
                >
                  {af ? "PUTJIE" : "HOLE"} 1
                </button>
                <button
                  className={startingHole === 10 ? "selected" : ""}
                  onClick={() => setStartingHole(10)}
                >
                  {af ? "PUTJIE" : "HOLE"} 10
                </button>
              </div>
              <div className="scan">
                <span>
                  <Camera />
                </span>
                <div>
                  <b>
                    {af
                      ? "Neem ’n foto van die telkaart"
                      : "Photograph the scorecard"}
                  </b>
                  <p>
                    {af
                      ? "Ons skep die putjies, pars en voorgeesyfers. Jy bevestig alles voor julle speel."
                      : "We’ll create the holes, pars and stroke indexes. You confirm everything before play."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    say(
                      af
                        ? "Telkaart-skandering is volgende op die afslaantyd."
                        : "Scorecard scanning is next on the tee sheet.",
                    )
                  }
                >
                  {af ? "SKANDEER" : "SCAN"}
                </Button>
              </div>
              <div className="course-preview">
                <span>18 {af ? "PUTJIES" : "HOLES"}</span>
                <b>PAR 72</b>
                <span>
                  {af ? "BEGIN OP" : "STARTING ON"} {startingHole}
                </span>
              </div>
            </section>
          )}
          {step === 2 && (
            <section>
              <p className="eyebrow">
                <Users /> {af ? "Vandag se slagoffers" : "Today’s victims"}
              </p>
              <h1 className="setup-title">
                {af ? "KIES JOU VIERBAL" : "PICK YOUR FOURBALL"}
              </h1>
              <div className="players">
                {players.map((p) => (
                  <div className="player" key={p.id}>
                    <span className={`team t${p.team}`}>{p.team}</span>
                    <input
                      value={p.name}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) =>
                        setPlayers(
                          players.map((x) =>
                            x.id === p.id ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                    <div className="hcp">
                      <small>{af ? "SPEEL HCP" : "PLAYING HCP"}</small>
                      <button
                        onClick={() =>
                          setPlayers(
                            players.map((x) =>
                              x.id === p.id
                                ? {
                                    ...x,
                                    handicap: Math.max(0, x.handicap - 1),
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        −
                      </button>
                      <b>{p.handicap}</b>
                      <button
                        onClick={() =>
                          setPlayers(
                            players.map((x) =>
                              x.id === p.id
                                ? { ...x, handicap: x.handicap + 1 }
                                : x,
                            ),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="swap"
                      onClick={() =>
                        setPlayers(
                          players.map((x) =>
                            x.id === p.id
                              ? { ...x, team: x.team === "A" ? "B" : "A" }
                              : x,
                          ),
                        )
                      }
                    >
                      {af ? "SPAN" : "TEAM"} {p.team}
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="add"
                onClick={() =>
                  setPlayers((old) => [
                    ...old,
                    {
                      id: Math.max(0, ...old.map((p) => p.id)) + 1,
                      name: `${af ? "Golfer" : "Golfer"} ${old.length + 1}`,
                      handicap: 0,
                      team:
                        old.filter((p) => p.team === "A").length <=
                        old.filter((p) => p.team === "B").length
                          ? "A"
                          : "B",
                    },
                  ])
                }
              >
                <UserPlus />{" "}
                {af ? "Voeg nog ’n golfer by" : "Add another golfer"}
              </button>
              <p className="tip">
                {af
                  ? "Vandag se baanvoorgee word handmatig ingetik. Geen indeksberekeninge nie. Geen nonsens nie."
                  : "Playing handicap is entered manually for today’s course. No index calculations. No nonsense."}
              </p>
            </section>
          )}
          {step === 3 && (
            <section>
              <p className="eyebrow">
                <Swords /> {af ? "Kies jou wapen" : "Choose your weapon"}
              </p>
              <h1 className="setup-title">
                {af ? "HOE BAKLE ONS VANDAG?" : "HOW ARE WE FIGHTING?"}
              </h1>
              <div className="formats">
                {formats.map((f, i) => (
                  <button
                    key={f}
                    disabled={i > 0}
                    onClick={() => setFormat(f)}
                    className={format === f ? "selected" : ""}
                  >
                    {formatLabels[language][f]}
                    {format === f ? (
                      <span>✓</span>
                    ) : i > 0 ? (
                      <small>{af ? "BINNEKORT" : "SOON"}</small>
                    ) : null}
                  </button>
                ))}
              </div>
              <p className="tip">
                {af
                  ? "Vir Woensdag is Beterbal Putjiespel die getoetste formaat. Die ander formate kom terug sodra hul berekeninge volledig getoets is."
                  : "For Wednesday, Betterball Match Play is the tested format. The others return as soon as their calculations are fully tested."}
              </p>
              <div className="rules">
                <Settings2 />
                <div>
                  <b>{af ? "Press-reëls" : "Press rules"}</b>
                  <p>
                    {af
                      ? "Handmatige press · begin op die volgende putjie · onbeperkte presses"
                      : "Manual press · starts on the next hole · unlimited presses"}
                  </p>
                </div>
                <strong>{af ? "AAN" : "ON"}</strong>
              </div>
            </section>
          )}
          <Button
            onClick={() =>
              step < 3
                ? setStep(step + 1)
                : (setScreen("play"), setCurrentHole(startingHole - 1))
            }
            className="next"
          >
            {step < 3
              ? af
                ? "VOLGENDE"
                : "NEXT"
              : af
                ? "LAAT DIE NONSENS BEGIN"
                : "LET THE NONSENSE BEGIN"}
            <ChevronRight />
          </Button>
        </div>
      )}
      {screen === "play" && hole && (
        <div className="wrap play">
          <div className="score-hero">
            <div>
              <p>{course}</p>
              <h1>
                {af ? "PUTJIE" : "HOLE"} {hole.number}
              </h1>
              <span>
                PAR {hole.par} · {af ? "VOORGEE" : "STROKE"} {hole.stroke}
              </span>
            </div>
            <div>
              <small>{formatLabels[language][format]}</small>
              <b>{match}</b>
              <span>
                {presses.length
                  ? `${presses.length} ${af ? "AKTIEWE PRESS" : "ACTIVE PRESS"}${presses.length > 1 ? "ES" : ""}`
                  : af
                    ? "GEEN AKTIEWE PRESS"
                    : "NO ACTIVE PRESS"}
              </span>
            </div>
          </div>
          <div className="hole-legend">
            <span>
              <i className="legend-current" />
              {af ? "Nou" : "Current"}
            </span>
            <span>
              <i className="legend-complete" />
              {af ? "Voltooi" : "Complete"}
            </span>
            <span>
              <i className="legend-partial" />
              {af ? "Onvoltooi" : "Incomplete"}
            </span>
          </div>
          <div className="hole-strip">
            {holes.map((h, i) => {
              const state = holeState(
                h.number,
                hole.number,
                players.map((p) => p.id),
                scores,
              );
              return (
                <button
                  key={h.number}
                  aria-label={`${af ? "Putjie" : "Hole"} ${h.number}, ${state}`}
                  onClick={() => setCurrentHole(i)}
                  className={state}
                >
                  {state === "complete" ? "✓" : ""}
                  {h.number}
                </button>
              );
            })}
          </div>
          <div className="score-grid">
            {players.map((p) => {
              const val = holeScores[p.id] ?? hole.par,
                shots = strokesOnHole(p.handicap, hole.stroke);
              return (
                <article className="score-player" key={p.id}>
                  <div className="player-top">
                    <span className={`team t${p.team}`}>{p.team}</span>
                    <div>
                      <h3>{p.name}</h3>
                      <p>
                        HCP {p.handicap} ·{" "}
                        {shots
                          ? af
                            ? `${shots} hou${Math.abs(shots) > 1 ? "e" : ""}`
                            : `${shots} shot${Math.abs(shots) > 1 ? "s" : ""}`
                          : af
                            ? "geen hou"
                            : "no shot"}
                      </p>
                    </div>
                    <div className="net">
                      <small>NET</small>
                      <b>{holeScores[p.id] ? val - shots : "–"}</b>
                    </div>
                  </div>
                  <div className="score-controls">
                    <button onClick={() => score(p.id, val - 1)}>−</button>
                    <button
                      className={`score-value ${!holeScores[p.id] ? "pending-score" : ""}`}
                      onClick={() => score(p.id, hole.par)}
                      aria-label={`${p.name}: ${af ? "tik par" : "enter par"}`}
                    >
                      {holeScores[p.id] ?? "PAR"}
                    </button>
                    <button onClick={() => score(p.id, val + 1)}>+</button>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="play-actions">
            <Button variant="outline" onClick={goPrevious}>
              <ChevronLeft />
              {af ? "Vorige" : "Previous"}
            </Button>
            <Button
              className="press"
              onClick={() => {
                setPresses((x) => [...x, hole.number]);
                say(
                  af
                    ? "PRESS AANVAAR — iemand raak nou benoud."
                    : "PRESS ACCEPTED — somebody is panicking.",
                );
              }}
            >
              <Swords />
              PRESS!
            </Button>
            <Button className="next-hole" onClick={goNext}>
              {hole.number === playingOrder(startingHole).at(-1)
                ? af
                  ? "Voltooi rondte"
                  : "Finish round"
                : af
                  ? "Volgende putjie"
                  : "Next hole"}
              <ChevronRight />
            </Button>
          </div>
          <div className="banter">
            <small>
              {af ? "REGSTREEKS VAN DIE SKOONVELD" : "LIVE FROM THE FAIRWAY"}
            </small>
            <p>
              {completedHoles.length < 5
                ? af
                  ? "Baie golf oor. Ongelukkig moet julle dit nog speel."
                  : "Plenty of golf left. Unfortunately, you’ll have to play it."
                : match === (af ? "GELYKOP" : "ALL SQUARE")
                  ? af
                    ? "Gelykop. Niemand het nog die reg verdien om grootmond te wees nie."
                    : "All square. Nobody has earned the right to be loud yet."
                  : af
                    ? `${match}. Die verloorspan gaan kyk nou skielik weer na die voorgee-wiskunde.`
                    : `${match}. The losing team is checking the handicap maths.`}
            </p>
          </div>
        </div>
      )}
      {screen === "history" && (
        <div className="wrap history">
          <button className="back" onClick={() => setScreen("home")}>
            <ChevronLeft />
            {af ? "Terug" : "Back"}
          </button>
          <p className="eyebrow">
            <History /> {af ? "Permanente bewyse" : "Permanent evidence"}
          </p>
          <h1 className="setup-title">
            {af ? "VORIGE MISDADE" : "PAST CRIMES"}
          </h1>
          {completedHoles.length === 18 ? (
            <article className="history-card">
              <div className="date">
                <b>18</b>
                <span>{af ? "PUTJIES" : "HOLES"}</span>
              </div>
              <div>
                <small>{formatLabels[language][format]}</small>
                <h2>{course}</h2>
                <p>
                  {match} · {presses.length} PRESS
                  {presses.length === 1 ? "" : "ES"}
                </p>
              </div>
              <span className="stamp">{af ? "AFGEHANDEL" : "SETTLED"}</span>
            </article>
          ) : (
            <div className="empty">
              <Trophy />
              <h3>
                {af
                  ? "Dis waar die legendes gaan ophoop."
                  : "This is where the legends will pile up."}
              </h3>
              <p>
                {af
                  ? "Voltooi jou eerste rondte en dit gaan reguit bewyskas toe."
                  : "Finish your first round and it will join the evidence locker."}
              </p>
            </div>
          )}
        </div>
      )}
      {screen === "profile" && (
        <div className="wrap profile-screen">
          <button className="back" onClick={() => setScreen("home")}>
            <ChevronLeft />
            {af ? "Terug" : "Back"}
          </button>
          <p className="eyebrow">
            <Users />{" "}
            {af ? "Jou klubhuis-identiteit" : "Your clubhouse identity"}
          </p>
          <h1 className="setup-title">{af ? "MY PROFIEL" : "MY PROFILE"}</h1>
          {!isSupabaseConfigured && (
            <div className="connection-card">
              <Sparkles />
              <div>
                <b>{af ? "Voorskou-modus is aan" : "Preview mode is on"}</b>
                <p>
                  {af
                    ? "Jy kan die hele profiel- en vriendevloei probeer. Supabase aktiveer môre die regte logins en gedeelde data."
                    : "Try the complete profile and friends flow. Supabase activates real logins and shared data tomorrow."}
                </p>
              </div>
            </div>
          )}
          <div className="social-tabs">
            <button
              className={profileTab === "me" ? "active" : ""}
              onClick={() => setProfileTab("me")}
            >
              {af ? "MY PROFIEL" : "MY PROFILE"}
            </button>
            <button
              className={profileTab === "friends" ? "active" : ""}
              onClick={() => setProfileTab("friends")}
            >
              {af ? "VRIENDE" : "FRIENDS"}
              <span>{friendRequests.length}</span>
            </button>
          </div>
          {profileTab === "me" ? (
            <div className="profile-editor">
              <div className="profile-photo-wrap">
                {myProfile.photo ? (
                  <img src={myProfile.photo} alt={myProfile.name} />
                ) : (
                  <div className="profile-photo-fallback">
                    {myProfile.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <label className="photo-button">
                  <ImagePlus />
                  {af ? "KIES FOTO" : "CHOOSE PHOTO"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => addProfilePhoto(e.target.files?.[0])}
                  />
                </label>
              </div>
              <div className="profile-fields">
                <label>{af ? "Naam" : "Name"}</label>
                <input
                  value={myProfile.name}
                  onChange={(e) =>
                    setMyProfile({ ...myProfile, name: e.target.value })
                  }
                />
                <label>{af ? "Golf-bynaam" : "Golf nickname"}</label>
                <input
                  value={myProfile.nickname}
                  onChange={(e) =>
                    setMyProfile({ ...myProfile, nickname: e.target.value })
                  }
                />
                <label>{af ? "Tuisklub" : "Home club"}</label>
                <div className="field-icon">
                  <MapPin />
                  <input
                    value={myProfile.homeClub}
                    onChange={(e) =>
                      setMyProfile({ ...myProfile, homeClub: e.target.value })
                    }
                  />
                </div>
                <label>
                  {af
                    ? "Wat is jou mees betroubare golfverskoning?"
                    : "What is your most reliable golf excuse?"}
                </label>
                <textarea
                  value={myProfile.excuse}
                  onChange={(e) =>
                    setMyProfile({ ...myProfile, excuse: e.target.value })
                  }
                />
                <Button onClick={saveSocialProfile}>
                  {af ? "STOOR MY BEWYSE" : "SAVE MY EVIDENCE"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="friends-panel">
              <div className="friend-search">
                <Search />
                <input
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder={
                    af
                      ? "Soek ’n golfer op The Press"
                      : "Search for a golfer on The Press"
                  }
                />
              </div>
              <p className="friends-label">
                {af ? "GOLFERS WAT JY DALK KEN" : "GOLFERS YOU MAY KNOW"}
              </p>
              <div className="friend-list">
                {friendResults.map((g) => (
                    <article className="friend-card" key={g.id}>
                      <div className="friend-avatar">{g.initials}</div>
                      <div>
                        <h3>{g.name}</h3>
                        <p>
                          “{g.nickname}” · {g.club}
                        </p>
                      </div>
                      <button
                        className={friendRequests.includes(g.id) ? "sent" : ""}
                        onClick={() => void requestFriend(g.id)}
                      >
                        {friendRequests.includes(g.id) ? (
                          <>
                            <UserCheck />
                            {af ? "VERSOEK GESTUUR" : "REQUEST SENT"}
                          </>
                        ) : (
                          <>
                            <UserPlus />
                            {af ? "VOEG VRIEND BY" : "ADD FRIEND"}
                          </>
                        )}
                      </button>
                    </article>
                  ))}
              </div>
            </div>
          )}
          {isSupabaseConfigured && !userEmail && (
            <div className="auth-card">
              <div className="auth-tabs">
                <button
                  className={authMode === "signin" ? "active" : ""}
                  onClick={() => setAuthMode("signin")}
                >
                  {af ? "MELD AAN" : "SIGN IN"}
                </button>
                <button
                  className={authMode === "signup" ? "active" : ""}
                  onClick={() => setAuthMode("signup")}
                >
                  {af ? "SKEP PROFIEL" : "CREATE PROFILE"}
                </button>
              </div>
              {authMode === "signup" && (
                <>
                  <label>{af ? "Naam" : "Display name"}</label>
                  <input
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder={af ? "Jou naam" : "Your name"}
                  />
                </>
              )}
              <label>E-pos</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="jy@voorbeeld.co.za"
              />
              <label>{af ? "Wagwoord" : "Password"}</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder={
                  af ? "Minstens 8 karakters" : "At least 8 characters"
                }
              />
              <Button className="next" onClick={submitAuth}>
                {authMode === "signup"
                  ? af
                    ? "SKEP MY PROFIEL"
                    : "CREATE MY PROFILE"
                  : af
                    ? "GAAN KLUBHUIS BINNE"
                    : "ENTER THE CLUBHOUSE"}
              </Button>
              {authMessage && <p className="auth-message">{authMessage}</p>}
            </div>
          )}
          {userEmail && (
            <button
              className="signout-link"
              onClick={async () => {
                await signOut();
                setAuthMessage(af ? "Jy is afgemeld." : "Signed out.");
              }}
            >
              {af ? "Meld af" : "Sign out"} · {userEmail}
            </button>
          )}
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
      <nav>
        <button
          onClick={() => setScreen("home")}
          className={screen === "home" ? "active" : ""}
        >
          <Flag />
          {af ? "Tuis" : "Home"}
        </button>
        <button
          onClick={() => {
            setScreen("setup");
            setStep(1);
          }}
          className={screen === "setup" ? "active" : ""}
        >
          <Plus />
          {af ? "Nuwe spel" : "New game"}
        </button>
        <button
          onClick={() => setScreen("history")}
          className={screen === "history" ? "active" : ""}
        >
          <History />
          {af ? "Geskiedenis" : "History"}
        </button>
        <button>
          <Trophy />
          {af ? "Tabel" : "Table"}
        </button>
      </nav>
    </main>
  );
}

function Action({
  icon,
  title,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  onClick?: () => void;
}) {
  return (
    <button className="action" onClick={onClick}>
      {icon}
      <span>
        <b>{title}</b>
        <small>{sub}</small>
      </span>
      <ChevronRight />
    </button>
  );
}
