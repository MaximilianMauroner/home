import { $, useStore } from "@builder.io/qwik";

// ELO system constants
const INITIAL_RATING = 1200;
const K_FACTOR = 32;

// Cache for expected score calculations
const expectedScoreCache = new Map<string, number>();

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
  winsAgainst: Set<number>; // Changed to Set
  lossesAgainst: Set<number>; // Changed to Set
};

export type EloRankingStore = {
  items: EloItem[];
  itemOne: number;
  itemTwo: number;
  round: number;
};

// Utility function to calculate the expected score
function getExpectedScore(ratingA: number, ratingB: number): number {
  const key = `${ratingA}-${ratingB}`;
  if (expectedScoreCache.has(key)) {
    return expectedScoreCache.get(key)!;
  }
  const score = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  expectedScoreCache.set(key, score);
  return score;
}

// Return updated copies of items rather than mutating originals
function getUpdatedRatings(
  itemA: EloItem,
  itemB: EloItem,
  result: number,
): { updatedA: EloItem; updatedB: EloItem } {
  const expectedA = getExpectedScore(itemA.rating, itemB.rating);
  const scoreA = result === 1 ? 1 : 0;
  const diffA = K_FACTOR * (scoreA - expectedA);
  const diffB = K_FACTOR * (1 - scoreA - (1 - expectedA));

  return {
    updatedA: {
      ...itemA,
      rating: itemA.rating + diffA,
      round: itemA.round + 1,
      lastDifference: diffA,
    },
    updatedB: {
      ...itemB,
      rating: itemB.rating + diffB,
      round: itemB.round + 1,
      lastDifference: diffB,
    },
  };
}

// Ensure transitive consistency
function enforceTransitivity(items: EloItem[]) {
  const length = items.length;
  const updatedItems = [...items];
  const transitiveMatrix = new Uint8Array(length * length);

  // Build initial relationship matrix
  for (let i = 0; i < length; i++) {
    for (const winnerId of updatedItems[i].winsAgainst) {
      transitiveMatrix[i * length + winnerId] = 1;
    }
  }

  // Floyd-Warshall algorithm with optimized array access
  for (let k = 0; k < length; k++) {
    for (let i = 0; i < length; i++) {
      const iOffset = i * length;
      for (let j = 0; j < length; j++) {
        if (transitiveMatrix[iOffset + k] && transitiveMatrix[k * length + j]) {
          const idx = iOffset + j;
          if (!transitiveMatrix[idx]) {
            transitiveMatrix[idx] = 1;
            updatedItems[i].winsAgainst.add(j);
            updatedItems[j].lossesAgainst.add(i);
          }
        }
      }
    }
  }

  return updatedItems;
}

// Add this function before getRandomItems
function hasCompleteTransitiveRanking(items: EloItem[]): boolean {
  const n = items.length;
  const graph = new Uint8Array(n * n);

  // Fill direct relationships more efficiently
  for (let i = 0; i < n; i++) {
    for (const winnerId of items[i].winsAgainst) {
      graph[i * n + winnerId] = 1;
    }
  }

  // Optimized Floyd-Warshall
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < n; i++) {
      const iOffset = i * n;
      for (let j = 0; j < n; j++) {
        if (graph[iOffset + k] && graph[k * n + j]) {
          graph[iOffset + j] = 1;
        }
      }
    }
  }

  // Optimized relationship check
  for (let i = 0; i < n - 1; i++) {
    const iOffset = i * n;
    for (let j = i + 1; j < n; j++) {
      if (!graph[iOffset + j] && !graph[j * n + i]) {
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
      winsAgainst: new Set<number>(),
      lossesAgainst: new Set<number>(),
    })),
    itemOne: 0,
    itemTwo: 1,
    round: 0,
  });

  const getRandomItems = $(() => {
    // Check if we have complete transitive ranking
    if (hasCompleteTransitiveRanking(store.items)) {
      store.itemOne = store.itemTwo = -1;
      return;
    }

    const length = store.items.length;
    const weights = new Float32Array(length);
    let totalWeight = 0;

    // Precalculate weights
    for (let i = 0; i < length; i++) {
      weights[i] = 1 / Math.pow(store.items[i].round + 1, 2);
      totalWeight += weights[i];
    }

    const getWeightedRandomIndex = () => {
      let rand = Math.random() * totalWeight;
      for (let i = 0; i < length; i++) {
        if (rand < weights[i]) return i;
        rand -= weights[i];
      }
      return length - 1;
    };

    let indexA = getWeightedRandomIndex();
    let indexB = getWeightedRandomIndex();
    let attempts = 0;
    const maxAttempts = 100;

    // Ensure indexB is not the same as indexA and they do not have a history
    while (
      (indexB === indexA ||
        store.items[indexA].winsAgainst.has(store.items[indexB].id) ||
        store.items[indexA].lossesAgainst.has(store.items[indexB].id)) &&
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
      updatedA.winsAgainst.add(updatedB.id);
      updatedB.lossesAgainst.add(updatedA.id);
    } else {
      updatedB.winsAgainst.add(updatedA.id);
      updatedA.lossesAgainst.add(updatedB.id);
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
