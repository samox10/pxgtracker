export type Recipe = {
  nome: string;
  icone: string;
  pontosNecessarios: number;
  materiais: Record<string, number>;
};

export const dicionarioCrafts: Record<string, Recipe> = {
  critical_catch: {
    nome: "Critical Catch Charm (Tier 1)",
    icone: "Critical_Catch_Charm_(Tier_1).png",
    pontosNecessarios: 1500,
    materiais: {
      "Whiskers Fin": 22,
      "Mole Hair": 22,
      "Corrupted Doll Star": 20,
      "Star Remains": 1
    }
  },
critical_catch_2: {
    nome: "Critical Catch Upgrade (Tier 2)",
    icone: "Critical_Catch_Upgrade_(Tier_2).png",
    pontosNecessarios: 9000,
    materiais: {
      "Corrupted Pot Of Lava": 70,
      "Black Wool Ball": 70,
      "Fire Monkey Hair": 70,
      "Royal Mane": 70,
      "Cave Nail": 70,
      "Flame Tail": 3,
      "Turtle Shell": 1,
      "Dragon Remains": 2
    }
  },
  critical_catch_3: {
    nome: "Critical Catch Upgrade (Tier 3)",
    icone: "Critical_Catch_Upgrade_(Tier_3).png",
    pontosNecessarios: 15000,
    materiais: {
      "Corrupted Dragon Tooth": 50,
      "Mole Hair": 50,
      "Psychic Mustache": 30,
      "Corrupted Doll Star": 30,
      "Corrupted Gem Star": 30,
      "Alolan Electric Rat Tail": 6,
      "Royal Tail": 6,
      "Catfish Whiskers": 5,
      "Gleam Tail": 5,
      "Golden Nugget": 5,
      "Violet Luchador Mask": 4
    }
  },
  critical_catch_4: {
    nome: "Critical Catch Upgrade (Tier 4)",
    icone: "Critical_Catch_Upgrade_(Tier_4).png",
    pontosNecessarios: 21000,
    materiais: {
      "Corrupted Poisonous Tail": 100,
      "Corrupted Magnet": 100,
      "Big Eagle Feather": 50,
      "Corrupted Miss Trace": 50,
      "Red Spike": 50,
      "Curly Pig Tail": 50,
      "Nightmare Gem": 3500,
      "Bagworm Pink Leaves": 10,
      "Eel Remains": 2,
      "Traces of Voodoo Doll": 4,
      "Virtual Head": 3,
      "Magnet Remains": 2
    }
  },
    critical_catch_5: {
    nome: "Critical Catch Upgrade (Tier 5)",
    icone: "Critical_Catch_Upgrade_(Tier_5).png",
    pontosNecessarios: 30000,
    materiais: {
      "Ice Crystal": 100,
      "Big Ice Ball": 80,
      "Corrupted Ice Orb": 80,
      "Corrupted Ice Piece": 80,
      "Land Shark Horn": 80,
      "Whiskers Fin": 80,
      "Brutal Fin": 25,
      "Gear Nose": 25,
      "Twin Stings": 4,
      "Dog Collar": 2,
      "Magnet Remains": 5,
      "Catfish Tail": 3,
      "Blade Horn": 3,
      "Giant Tusk": 3,
      "Sentry Remains": 40,
      "Golden Nugget": 1
    }
  },
  critical_catch_6: {
    nome: "Critical Catch Upgrade (Tier 6)",
    icone: "Critical_Catch_Upgrade_(Tier_6).png",
    pontosNecessarios: 36000,
    materiais: {
      "Toxic Gosme": 150,
      "Petite Leaves": 150,
      "Bagworm Green Leaves": 120,
      "Corrupted Pinsir Horn": 120,
      "Green Hair": 120,
      "Corrupted Pot Of Moss Bug": 120,
      "Corrupted Vines": 120,
      "Sand Pouch": 120,
      "Continent Thorn": 10,
      "Electric Fish Tail": 5,
      "Frosty Hand": 5,
      "Bear Feet": 4,
      "Giant Dragon Pearl": 3,
      "Dog Tail": 3,
      "Sentry Remains": 40
    }
  }
};



export const dicionarioTrocas = [
  { nome: "Leek Shield", auraCusto: 2, icone: "leek_shield.png" },
  { nome: "Leek Lance", auraCusto: 2, icone: "leek_lance.png" },
  { nome: "Star Remains", auraCusto: 3, icone: "Star_Remains.png" },
  { nome: "Twin Stings", auraCusto: 3, icone: "twin_stings.png" },
  { nome: "Dragon Remains", auraCusto: 3, icone: "dragon_remains.png" },
  { nome: "Black Venom Flute", auraCusto: 3, icone: "black_venom_flute.png" }
];