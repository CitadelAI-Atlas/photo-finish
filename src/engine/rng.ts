// Seeded PRNG (xoshiro128**) for reproducible simulations + normal distribution helpers.
// Using a seedable RNG lets us replay races deterministically for testing.

export class Rng {
  private s: Uint32Array

  constructor(seed: number) {
    // SplitMix32 to expand a single seed into 4 state words
    this.s = new Uint32Array(4)
    for (let i = 0; i < 4; i++) {
      seed += 0x9e3779b9
      let z = seed
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b)
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35)
      z = z ^ (z >>> 16)
      this.s[i] = z >>> 0
    }
  }

  // Returns a float in [0, 1)
  next(): number {
    const s = this.s
    const result = Math.imul(rotl(Math.imul(s[1]!, 5), 7), 9)
    const t = s[1]! << 9
    s[2]! ^= s[0]!
    s[3]! ^= s[1]!
    s[1]! ^= s[2]!
    s[0]! ^= s[3]!
    s[2] ^= t
    s[3] = rotl(s[3]!, 11)
    return (result >>> 0) / 0x100000000
  }

  // Integer in [min, max] inclusive
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  // Normal distribution via Box-Muller transform
  normal(mean: number, stddev: number): number {
    const u1 = this.next() || 0.0001  // avoid log(0)
    const u2 = this.next()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    return mean + z * stddev
  }

  // Pick a random element from an array
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!
  }

  // Pick N unique elements from an array
  pickN<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr]
    const result: T[] = []
    for (let i = 0; i < n && copy.length > 0; i++) {
      const idx = Math.floor(this.next() * copy.length)
      result.push(copy.splice(idx, 1)[0]!)
    }
    return result
  }

  // Weighted pick: weights array parallel to arr
  weightedPick<T>(arr: readonly T[], weights: readonly number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i]!
      if (r <= 0) return arr[i]!
    }
    return arr[arr.length - 1]!
  }

  // Shuffle array in place (Fisher-Yates)
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!]
    }
    return arr
  }
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k))
}

// Create an Rng with a random seed (for gameplay)
export function createRng(): Rng {
  return new Rng(Math.floor(Math.random() * 0xffffffff))
}
