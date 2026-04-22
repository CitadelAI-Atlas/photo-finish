import { describe, it, expect } from 'vitest'
import { generateField, generateRaceConditions, generateCard } from '@/engine/field'
import { Rng } from '@/engine/rng'
import type { RaceClass } from '@/engine/types'

describe('Field Generation', () => {
  it('generates the correct number of horses', () => {
    const rng = new Rng(42)
    const conditions = generateRaceConditions(rng, 'MCL')
    const field = generateField(rng, conditions, 6)
    expect(field.length).toBe(6)
  })

  it('assigns unique post positions', () => {
    const rng = new Rng(42)
    const conditions = generateRaceConditions(rng, 'CLM')
    const field = generateField(rng, conditions, 8)
    const posts = field.map(e => e.postPosition)
    expect(new Set(posts).size).toBe(8)
    expect(posts).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('generates unique horse names within a field', () => {
    const rng = new Rng(42)
    const conditions = generateRaceConditions(rng, 'MCL')
    const field = generateField(rng, conditions, 10)
    const names = field.map(e => e.horse.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('assigns unique jockeys within a field', () => {
    const rng = new Rng(42)
    const conditions = generateRaceConditions(rng, 'MCL')
    const field = generateField(rng, conditions, 10)
    const jockeys = field.map(e => e.horse.jockeyId)
    expect(new Set(jockeys).size).toBe(jockeys.length)
  })

  it('generates PSR within class range', () => {
    const rng = new Rng(123)
    const classes: RaceClass[] = ['MCL', 'CLM', 'ALW', 'STK']
    const ranges = {
      MCL: [25, 70], CLM: [40, 85], ALW: [55, 95], STK: [70, 115],
    }

    for (const cls of classes) {
      const conditions = generateRaceConditions(rng, cls)
      const field = generateField(rng, conditions, 10)
      for (const entry of field) {
        const [min, max] = ranges[cls]!
        expect(entry.horse.psr).toBeGreaterThanOrEqual(min)
        expect(entry.horse.psr).toBeLessThanOrEqual(max)
      }
    }
  })

  it('PSR distribution centers near class mean over many horses', () => {
    const rng = new Rng(999)
    const conditions = generateRaceConditions(rng, 'CLM')
    const psrs: number[] = []
    for (let i = 0; i < 100; i++) {
      const field = generateField(rng, conditions, 8)
      for (const e of field) psrs.push(e.horse.psr)
    }
    const mean = psrs.reduce((a, b) => a + b, 0) / psrs.length
    // CLM mean is 62, should be within ±5
    expect(mean).toBeGreaterThan(57)
    expect(mean).toBeLessThan(67)
  })

  it('generates a card with 6 races', () => {
    const rng = new Rng(42)
    const card = generateCard(rng, 'AQU', ['MCL', 'CLM'], 8)
    expect(card.races.length).toBe(6)
    expect(card.trackCode).toBe('AQU')
  })

  it('featured race (last) is one class above available', () => {
    const rng = new Rng(42)
    const card = generateCard(rng, 'AQU', ['MCL'], 6)
    const lastRace = card.races[5]!
    // MCL only available, so featured should be CLM
    expect(lastRace.conditions.raceClass).toBe('CLM')
  })

  it('scratches do not drop field below 4 runners', () => {
    // Run many iterations to test scratch logic
    const rng = new Rng(77)
    for (let i = 0; i < 200; i++) {
      const card = generateCard(rng, 'AQU', ['MCL'], 6)
      for (const race of card.races) {
        const active = race.entries.filter(e => !e.scratched).length
        expect(active).toBeGreaterThanOrEqual(4)
      }
    }
  })
})
