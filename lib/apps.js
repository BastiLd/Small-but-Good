export const MFU_NEXUS_BATTLE_INTRO_TEXT = `Das ist mein Bot.
Er ist für ein Marvel-Kartenspiel gemacht.
Du kannst mit den Karten gegen Freunde oder gegen den Bot kämpfen, auf Missionen gehen und ein Story-Mode ist ebenfalls in Arbeit.
Mehr Infos gibt es auf dem Server. Wenn du Interesse hast, komm gern in die Marvel-Community.`;

export const MARVEL_FAN_UNIVERSE_INTRO_TEXT = `Marvel Film News
Marvel Film Infos

Tippe auf den Film und du erfährst, ob es eine Post-Credit-Scene gibt und ob es mehrere gibt,
damit du weißt, ob du warten musst oder direkt am Ende des Filmes gehen kannst.

Du willst Infos zu einem Charakter, kein Problem.
Suche ihn und du bekommst alle Infos, die du brauchst.

Comic- und Game-Infos kommen bald dazu.`;

export const PERRY_RAT_INTRO_TEXT = `Das ist ein Freund von mir, der richtig coole Animationen macht und richtig gut Videos bearbeiten kann. Schaut euch gerne sein Projekt an!`;

export const APPS = [
  {
    id: "mfu-nexus-battle",
    title: "MFU Nexus Battle",
    shortDesc: "Marvel-Kartenkämpfe, Missionen und Story-Mode auf Discord.",
    longDescription: MFU_NEXUS_BATTLE_INTRO_TEXT,
    screenshots: ["/images/Logo_Nexus_Battle.png"],
    introImage: "/images/Logo_Nexus_Battle.png",
    introText: MFU_NEXUS_BATTLE_INTRO_TEXT,
    platform: "discord",
    platformLabel: "Discord",
    store_url: "https://discord.gg/QFrGdyaGPj",
    type: "discord_bot",
    typeLabel: "Discord-Bot",
    private: true,
    creatorHandle: "@creator",
    contact_url: "https://discord.gg/wy5gV6RHKf",
    features: [
      "1v1-Kartenkämpfe gegen Freunde oder den Bot",
      "Tägliche Belohnungen und Kartenfortschritt",
      "Missionsmodus mit Belohnungen",
      "Interaktiver Story-Mode (in Arbeit)"
    ],
    commands: [
      { name: "täglich", signature: "/täglich", desc: "Hole deine tägliche Belohnung ab." },
      { name: "mission", signature: "/mission", desc: "Schicke dein Team auf eine Mission." },
      { name: "geschichte", signature: "/geschichte", desc: "Starte eine interaktive Story." },
      { name: "kampf", signature: "/kampf", desc: "Kämpfe im 1v1 gegen Spieler oder Bot." },
      { name: "sammlung", signature: "/sammlung", desc: "Zeige deine Karten-Sammlung." },
      { name: "verbessern", signature: "/verbessern", desc: "Verstärke deine Karten mit Infinitydust." },
      { name: "anfang", signature: "/anfang", desc: "Startmenü mit Schnellzugriff." }
    ],
    cardsPreview: [
      "Black Widow",
      "Iron Man",
      "Captain America",
      "Hulk",
      "Hawkeye",
      "Doctor Strange",
      "Black Panther",
      "Star-Lord"
    ],
    dbTables: []
  },
  {
    id: "marvel-fan-universe-app",
    title: "Marvel Fan Universe App",
    shortDesc: "Marvel-Film-News, Charakter-Infos und Post-Credit-Hinweise.",
    longDescription: MARVEL_FAN_UNIVERSE_INTRO_TEXT,
    screenshots: ["/images/MFU-App.png"],
    introImage: "/images/MFU-App.png",
    introText: MARVEL_FAN_UNIVERSE_INTRO_TEXT,
    platform: "app",
    platformLabel: "App",
    store_url: "",
    type: "fan_app",
    typeLabel: "Fan-App",
    private: false,
    features: [
      "Marvel Film News",
      "Marvel Film Infos",
      "Post-Credit-Scene-Hinweise pro Film",
      "Charaktersuche mit allen wichtigen Infos",
      "Comic- und Game-Infos kommen bald dazu."
    ],
    commands: [],
    cardsPreview: [],
    dbTables: []
  },
  {
    id: "perryrat",
    title: "PerryRat",
    shortDesc:
      "Das ist ein Freund von mir, der richtig coole Animationen macht und richtig gut Videos bearbeiten kann. Schaut euch gerne sein Projekt an!",
    longDescription: "",
    screenshots: ["/images/Perry-Rat_notinvbackg.png"],
    introImage: "/images/Perry-Rat_notinvbackg.png",
    introText: PERRY_RAT_INTRO_TEXT,
    detailBodyImage: "/images/Perry Videos.png",
    detailBodyImageAlt: "Eine Auswahl von Videos vom PerryRat-Kanal",
    platform: "youtube",
    platformLabel: "YouTube",
    store_url: "https://www.youtube.com/@Perryrat",
    type: "creator_channel",
    typeLabel: "Animationskanal",
    private: false,
    creatorHandle: "@Perryrat",
    features: [],
    commands: [],
    cardsPreview: [],
    dbTables: []
  }
];

export function getAppById(appId) {
  return APPS.find((app) => app.id === appId) || null;
}
