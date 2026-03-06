export const MFU_INTRO_TEXT = `This is my Bot.
It is a Bot for a card game, about marvel.
You can fight with the Cards against a friend or the Bot and you can go on missions and a story mode is comming.
More Info in the Server, so if you are interrested come and join the marvel Community.`;

export const APPS = [
  {
    id: "mfu-nexus-battle",
    title: "MFU Nexus Battle",
    shortDesc: "Marvel card battles, missions and story mode on Discord.",
    longDescription: MFU_INTRO_TEXT,
    screenshots: ["/images/Logo_Nexus_Battle.png"],
    introImage: "/images/Logo_Nexus_Battle.png",
    introText: MFU_INTRO_TEXT,
    platform: "discord",
    store_url: "https://discord.com",
    type: "discord_bot",
    private: true,
    creatorHandle: "@creator",
    contact_url: "https://discord.com",
    features: [
      "1v1 card fights against friends or against the bot",
      "Daily rewards and card progression",
      "Mission mode with rewards",
      "Interactive story mode (in progress)"
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
      "Iron-Man",
      "Captain America",
      "Hulk",
      "Hawkeye",
      "Doctor Strange",
      "Black Panther",
      "Star Lord"
    ],
    dbTables: [
      "karten",
      "collections",
      "fight_requests",
      "mission_requests",
      "user_daily",
      "guild_config",
      "guild_allowed_channels",
      "user_card_buffs"
    ]
  }
];

export function getAppById(appId) {
  return APPS.find((app) => app.id === appId) || null;
}