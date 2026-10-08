export const money = (value: number) =>
  `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value < 0.1 ? 3 : 2,
    maximumFractionDigits: value < 0.1 ? 3 : 2,
  })}`;
export const billions = (value: number) =>
  `${(value / 1_000_000_000).toFixed(2)}B`;
export const percent = (value: number) => `${value.toFixed(1)}%`;
