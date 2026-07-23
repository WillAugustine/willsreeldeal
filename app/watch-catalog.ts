export type WatchListing = {
  amazonId?: string;
  amazonQuery?: string;
  appleUrl?: string;
};

function movieKey(title: string, year: string) {
  return `${title.trim().toLowerCase()}|${year.trim()}`;
}

const watchCatalog: Record<string, WatchListing> = {
  [movieKey("I Swear", "2025")]: {
    amazonId: "0UAG2NRWRJA02MMHU02N5RX8WR",
    appleUrl: "https://tv.apple.com/us/movie/i-swear/umc.cmc.546n1sl9kwo0si766kvyvsnrp",
  },
  [movieKey("Demolition", "2015")]: {
    amazonId: "0GUUCZR5Y0KA5CAW7AHVVZD4VH",
    appleUrl: "https://tv.apple.com/us/movie/demolition/umc.cmc.71grcy39gioxxv391tt1x9q05",
  },
  [movieKey("End of Watch", "2012")]: {
    amazonId: "0LXZOOPH14HL3JKIQADB1735ZV",
    appleUrl: "https://tv.apple.com/us/movie/end-of-watch/umc.cmc.33wso95ht4kazo0bz9hh5nm8a",
  },
  [movieKey("Invictus", "2009")]: {
    amazonId: "0RNJQB6HUQNA3WRRCMPO5HT4R5",
    appleUrl: "https://tv.apple.com/us/movie/invictus/umc.cmc.6qat11g24b3u3sa4zwuh3uga1",
  },
  [movieKey("The Batman", "2022")]: {
    amazonId: "0TNWJYOSXYR74OY4W78E71780P",
    appleUrl: "https://tv.apple.com/us/movie/the-batman/umc.cmc.75o96q32hcm2kzx4ilop1ylmx",
  },
  [movieKey("Air", "2023")]: {
    amazonQuery: "Air 2023 Matt Damon movie",
    appleUrl: "https://tv.apple.com/us/movie/air/umc.cmc.3pebeyfhbrx7mt56rc16auzt5",
  },
  [movieKey("The Nice Guys", "2016")]: {
    amazonId: "0T1QYZ35BK0WUJFLN1S0DFGQO9",
    appleUrl: "https://tv.apple.com/us/movie/the-nice-guys/umc.cmc.3d7jpq67ivm8he8ndug7lmr63",
  },
  [movieKey("Arrival", "2016")]: {
    amazonId: "0H7L0EY2GIKM49X7W1XE17TW5U",
    appleUrl: "https://tv.apple.com/us/movie/arrival/umc.cmc.20sgkdxqbvucopzt913joa0gr",
  },
  [movieKey("Mad Max: Fury Road", "2015")]: {
    amazonId: "0FWHWHC40XCMMU7GD9KAPGDR8Y",
    appleUrl: "https://tv.apple.com/us/movie/mad-max-fury-road/umc.cmc.6xerenwn1999cjd2y6421r2ex",
  },
  [movieKey("Knives Out", "2019")]: {
    amazonId: "0QD6PFD8OU1PVD62Y0CJYI7OD3",
    appleUrl: "https://tv.apple.com/us/movie/knives-out/umc.cmc.21f7rjslttoalzd6o9c6cg5ml",
  },
  [movieKey("The Holdovers", "2023")]: {
    amazonId: "0FGT8IC8F5NA57WU6FDTWXH8XU",
    appleUrl: "https://tv.apple.com/us/movie/the-holdovers/umc.cmc.3fppeehnnl7du06td7t1k1o6v",
  },
  [movieKey("Game Night", "2018")]: {
    amazonId: "0JGJ8OC63A727VB3E7W44VXB91",
    appleUrl: "https://tv.apple.com/us/movie/game-night/umc.cmc.2x439clrd8njxzadnukr2j4th",
  },
  [movieKey("Annihilation", "2018")]: {
    amazonId: "0JDMKJ8Q1ZXZ6D7WMRWST7TXN1",
    appleUrl: "https://tv.apple.com/us/movie/annihilation/umc.cmc.487py731e7mv3zoikv5elbwlt",
  },
  [movieKey("Dungeons & Dragons: Honor Among Thieves", "2023")]: {
    amazonId: "0SVVTHUQ05OF194TQ0KF2BB3N0",
    appleUrl: "https://tv.apple.com/us/movie/dungeons--dragons-honor-among-thieves/umc.cmc.j0wchqkufsaxqt259729da33",
  },
  [movieKey("Talk to Me", "2022")]: {
    amazonId: "0S3KVWUDMZVNWBFVBXE19IQO8H",
    appleUrl: "https://tv.apple.com/us/movie/talk-to-me/umc.cmc.n327py314xa0bto2a0jvd3qy",
  },
  [movieKey("Ocean’s Eleven", "2001")]: {
    amazonId: "0SGFKZKEWLC1PTX6N5KG1IKPU8",
    appleUrl: "https://tv.apple.com/us/movie/oceans-eleven/umc.cmc.4mt9j4jqou4mlup1pc9riyo63",
  },
  [movieKey("The Wild Robot", "2024")]: {
    amazonId: "0H5X9VAJP3WU9CMN0CPCM63K2S",
    appleUrl: "https://tv.apple.com/us/movie/the-wild-robot/umc.cmc.3vk9rngh0rrmpnyhv2qwzm582",
  },
};

export function getWatchListing(title: string, year: string) {
  return watchCatalog[movieKey(title, year)];
}
