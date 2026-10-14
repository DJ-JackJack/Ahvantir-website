module.exports = {
  supabase: {
    url: 'https://fbfqeijisvckwmkqzjtd.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZnFlaWppc3Zja3dta3F6anRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3OTI4MzMsImV4cCI6MjA5NjM2ODgzM30.UzGAdE12QnFEKvsTsuA2UiiV-1qUu0f0b_VQUMCdXnI',
  },
  /**
   * The other setting, for the header switcher.
   *
   * Blanking `url` removes the control site-wide without touching a template,
   * which is the intended off-switch if dawnbreak.ahvantir.world is ever down
   * or not yet resolving.
   */
  sister: {
    label: "Dawnbreak City",
    url: "https://dawnbreak.ahvantir.world/",
  },

  site: {
    title: "Ahvantir",
    subtitle: "A Living World",
    description:
      "The living lore encyclopedia for the Ahvantir campaign setting — the great city of Aru'Mas and the world beyond.",
    url: "https://ahvantir.world",
    author: "Krys (M4st3r_0f_G4m3s)",
  },
  categories: [
    {
      slug: "history",
      label: "History",
      icon:
        '<path d="M8 21h11a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/>',
      color: "#d4aa40",
      description: "Ages, eras, and the pivotal events that shaped the world",
    },
    {
      slug: "locations",
      label: "Locations",
      icon:
        '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
      color: "#3dcee0",
      description: "The city of Aru'Mas, its districts, and the wider world",
    },
    {
      slug: "factions",
      label: "Factions",
      icon:
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="M12 8v6"/>',
      color: "#7b1d2a",
      description: "Powers, orders, guilds, and the forces that vie for influence",
    },
    {
      slug: "characters",
      label: "Characters",
      icon:
        '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
      color: "#e06030",
      description: "Notable figures — the living, the dead, and the legendary",
    },
    {
      slug: "religion",
      label: "Religion",
      icon:
        '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
      color: "#5aaa28",
      description: "Gods, spirits, divine orders, and the nature of faith",
    },
    {
      slug: "magic",
      label: "Magic",
      icon:
        '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
      color: "#1eaabf",
      description: "Arcane systems, magical phenomena, and the forces of power",
    },
    {
      slug: "cosmology",
      label: "Cosmology",
      icon:
        '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.6" transform="rotate(-24 12 12)"/>',
      color: "#7a5a28",
      description: "The planes, the Primordem, and the shape of existence",
    },
    {
      slug: "culture",
      label: "Culture",
      icon:
        '<path d="M3 21h18M5 21V8l7-5 7 5v13M10 21v-6h4v6"/>',
      color: "#e06030",
      description: "Society, law, agriculture, species, and daily life",
    },
  ],
};
