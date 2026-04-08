// src/data/hunts.ts

export const dicionarioHunts: Record<string, { nome: string; shiny: string; icone: string; lootEsperado: string[] }> = {
  lycanroc: { 
    nome: "Lycanroc", 
    shiny: "Golden Sudowoodo", 
    icone: "lycanroc.png", 
    lootEsperado: [
      "Wolf Tail",
      "Gold Coin",
      "Cyan Nightmare Gem",
      "Rock Stone",
      "Nightmare Gem",
      "Orebound Essence",
      "Big Stone",
      "Fluffy Lycan Tail",
      "Short Lycan Tail",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Indigo Shard",
      "Golden Nugget",
      "Black Nightmare Gem"
    ] 
  },
  alolan_persian: {
    nome: "Alolan Persian",
    shiny: "Shiny Honchkrow",
    icone: "alolanpersian.png", 
    lootEsperado: [
      "Malefic Essence",
      "Nightmare Gem",
      "Nightmare Corruption Stone",
      "Nail",
      "Black Wool Ball",
      "Darkness Stone",
      "Cyan Nightmare Gem",
      "Solid Dark Gem",
      "Yellow Big Boss Hat",
      "Dusk Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Damson Shard"
    ]
  },
  drampa: {
    nome: "Drampa",
    shiny: "Mega Drampa",
    icone: "Drampa.png",
    lootEsperado: [
      "Yellow Eyebrows",
      "Nightmare Gem",
      "Cyan Nightmare Gem",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Dragon Scale Collection",
      "Mega Shard",
      "Wingeon Essence",
      "Crystal Stone",
        ]
    },
  pyroar: {
    nome: "Pyroar",
    shiny: "Mega Pyroar",
    icone: "pyroar.png",
    lootEsperado: [
      "Cyan Nightmare Gem",
      "Nightmare Gem",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Mega Shard",
      "Heart Stone",
      "Solid Rubber Ball",
      "Royal Tail",
      "Kermes Shard",
      "Leather",
      "Royal Mane",
      "Gardestrike Essence",
      ]
    },
  houndoom: {
    nome: "Houndoom",
    shiny: "Mega Houndoom",
    icone: "houndoom.png",
    lootEsperado: [
      "Cyan Nightmare Gem",
      "Nightmare Gem",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Solidified Aura",
      "Fire Stone",
      "Corrupted Pot of Lava",
      "Pot Of Lava",
      "Strange Bone",
      "Scarlet Shard",
      "Leather",
      "Volcanic Essence",
      "Compressed Fire",
    ]
  },
  weavile: {
    nome: "Weavile",
    shiny: "Shiny Weavile",
    icone: "weavile.png",
    lootEsperado: [
      "Cyan Nightmare Gem",
      "Nightmare Gem",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Solidified Aura",
      "Azure Shard",
      "Razor Claw",
      "Wool Ball",
      "Cat Ear",
      "Ice Stone",
      "Seavell Essence",
      "Solid Ice Cube",
    ]
  },
  mixrock: {
    nome: "Mix Rock",
    shiny: "Golden Sudowoodo",
    icone: "mixrock.png",
    lootEsperado: [
      "Cyan Nightmare Gem",
      "Nightmare Gem",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Solidified Aura",
      "Indigo Shard",
      "Gold Coin",
      "Golden Nugget",
      "Rock Stone",
      "Big Stone",
      "Stone Orb",
      "Orebound Essence",
      "Branch of Stone",
      "Corrupted Tree Branch",
      "Solid Head",
    ]
  },
  porygon: {
    nome: "Porygon",
    shiny: "PorygonZ",
    icone: "porygon.png",
    lootEsperado: [
      "Cyan Nightmare Gem",
      "Nightmare Gem",
      "Nightmare Corruption Stone",
      "Toy Box",
      "Black Nightmare Gem",
      "Solidified Aura",
      "Heart Stone",
      "Virtual Body",
      "Virtual Tail",
      "Virtual Head",
      "Solid Rubber Ball",
      "Gardestrike Essence",
    ]
  },


  // PARA ADICIONAR NOVAS HUNTS, BASTA COPIAR A ESTRUTURA ACIMA E COLAR AQUI PARA BAIXO!
  // Exemplo:
  // blastoise: { nome: "Blastoise", shiny: "Shiny Blastoise", icone: "blastoise.png", lootEsperado: ["Water Stone", "Squirtle Hull"] },
};