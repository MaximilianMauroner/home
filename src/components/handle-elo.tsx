import { $, useStore } from "@builder.io/qwik";

// ELO system constants
const INITIAL_RATING = 1200;
const K_FACTOR = 32;

export type Item = {
  name: string;
  [key: string]: any;
};

// Item interface
export type EloItem = {
  id: number;
  rating: number;
  round: number;
  lastDifference: number;
  item: Item;
  winsAgainst: number[];
  lossesAgainst: number[];
};

export type EloRankingStore = {
  items: EloItem[];
  itemOne: number;
  itemTwo: number;
  round: number;
};

// Utility function to calculate the expected score
function getExpectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Return updated copies of items rather than mutating originals
function getUpdatedRatings(
  itemA: EloItem,
  itemB: EloItem,
  result: number,
): { updatedA: EloItem; updatedB: EloItem } {
  const newRoundA = itemA.round + 1;
  const newRoundB = itemB.round + 1;

  const expectedA = getExpectedScore(itemA.rating, itemB.rating);
  const expectedB = 1 - expectedA;

  const scoreA = result === 1 ? 1 : 0;
  const scoreB = result === 1 ? 0 : 1;

  const diffA = K_FACTOR * (scoreA - expectedA);
  const diffB = K_FACTOR * (scoreB - expectedB);

  return {
    updatedA: {
      ...itemA,
      rating: itemA.rating + diffA,
      round: newRoundA,
      lastDifference: diffA,
    },
    updatedB: {
      ...itemB,
      rating: itemB.rating + diffB,
      round: newRoundB,
      lastDifference: diffB,
    },
  };
}

// Ensure transitive consistency
function enforceTransitivity(items: EloItem[]) {
  const updatedItems = [...items];

  for (let i = 0; i < updatedItems.length; i++) {
    for (let j = 0; j < updatedItems[i].winsAgainst.length; j++) {
      const winner = updatedItems[i];
      const loser = updatedItems.find(
        (item) => item.id === updatedItems[i].winsAgainst[j],
      );

      if (loser) {
        for (let k = 0; k < loser.winsAgainst.length; k++) {
          const transitiveLoser = updatedItems.find(
            (item) => item.id === loser.winsAgainst[k],
          );
          if (
            transitiveLoser &&
            !winner.winsAgainst.includes(transitiveLoser.id)
          ) {
            winner.winsAgainst.push(transitiveLoser.id);
            transitiveLoser.lossesAgainst.push(winner.id);
          }
        }
      }
    }
  }

  return updatedItems;
}

// Add this function before getRandomItems
function hasCompleteTransitiveRanking(items: EloItem[]): boolean {
  // Create adjacency matrix for the graph
  const n = items.length;
  const graph: boolean[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(false));

  // Fill direct relationships
  items.forEach((item) => {
    item.winsAgainst.forEach((winnerId) => {
      graph[item.id][winnerId] = true;
    });
  });

  // Floyd-Warshall algorithm to find transitive relationships
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (graph[i][k] && graph[k][j]) {
          graph[i][j] = true;
        }
      }
    }
  }

  // Check if every pair of items has a relationship
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && !graph[i][j] && !graph[j][i]) {
        return false;
      }
    }
  }

  return true;
}

// Custom hook to manage Elo ranking logic
export function useEloRanking(initialItems: Item[]) {
  const store = useStore<EloRankingStore>({
    items: initialItems.map((item, index) => ({
      item: { ...item },
      id: index,
      rating: INITIAL_RATING,
      round: 0,
      lastDifference: 0,
      winsAgainst: [],
      lossesAgainst: [],
    })),
    itemOne: 0,
    itemTwo: 1,
    round: 0,
  });

  const getRandomItems = $(() => {
    // Check if we have complete transitive ranking
    if (hasCompleteTransitiveRanking(store.items)) {
      store.itemOne = -1;
      store.itemTwo = -1;
      return;
    }

    // Original weighted random selection logic continues...
    const weights = store.items.map((item) => 1 / Math.pow(item.round + 1, 2));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    const getWeightedRandomIndex = () => {
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < store.items.length; i++) {
        if (rand < weights[i]) return i;
        rand -= weights[i];
      }
      return store.items.length - 1;
    };

    let indexA = getWeightedRandomIndex();
    let indexB = getWeightedRandomIndex();
    let attempts = 0;
    const maxAttempts = 100;

    // Ensure indexB is not the same as indexA and they do not have a history
    while (
      (indexB === indexA ||
        store.items[indexA].winsAgainst.includes(store.items[indexB].id) ||
        store.items[indexA].lossesAgainst.includes(store.items[indexB].id)) &&
      attempts < maxAttempts
    ) {
      indexB = getWeightedRandomIndex();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      indexA = -1;
      indexB = -1;
    }

    store.itemOne = indexA;
    store.itemTwo = indexB;
  });

  const handleCompare = $((indexA: number, indexB: number, winner: number) => {
    const { updatedA, updatedB } = getUpdatedRatings(
      store.items[indexA],
      store.items[indexB],
      winner,
    );

    // Update the items in the store immutably
    store.items = store.items.map((item, idx) =>
      idx === indexA
        ? updatedA
        : idx === indexB
          ? updatedB
          : { ...item, lastDifference: 0 },
    );

    // Update winsAgainst and lossesAgainst
    if (winner === 1) {
      updatedA.winsAgainst.push(updatedB.id);
      updatedB.lossesAgainst.push(updatedA.id);
    } else {
      updatedB.winsAgainst.push(updatedA.id);
      updatedA.lossesAgainst.push(updatedB.id);
    }

    store.round += 1;

    // Sort items by rating after updating
    store.items = [...store.items].sort((a, b) => b.rating - a.rating);

    // Enforce transitive consistency across all items
    store.items = enforceTransitivity(store.items);

    // Pick new items after updating
    getRandomItems();
  });

  return { store, handleCompare, getRandomItems };
}
