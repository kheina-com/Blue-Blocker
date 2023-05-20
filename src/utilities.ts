export function abbreviate(value: number): string {
  if (value >= 1e10) {
    return `${Math.round(value / 1e9)}B`;
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e7) {
    return `${Math.round(value / 1e6)}M`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e4) {
    return `${Math.round(value / 1e3)}K`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return `${value}`;
}

export function commafy(x: number): string {
  // from https://stackoverflow.com/a/2901298
  let parts = x.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

// 64bit random number generator. I believe it's not truly 64 bit
// due to floating point bullshit, but it's good enough
const MaxId = 0xffffffffffffffff;
export const RefId = (): number => Math.round(Math.random() * MaxId);
