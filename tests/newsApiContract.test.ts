/**
 * Contract test — the Django `/api/news/` payload against the frontend's
 * NewsItem type and workspace logic.
 *
 * The fixture is a verbatim capture of a live response from the backend
 * (`apps/news`). It guards the seam between the two repos: if the API stops
 * emitting the shape the workspace expects — a renamed field, a snake_case
 * regression, a paginated envelope instead of a bare array — these fail.
 *
 * Refresh with:
 *   curl -s http://localhost:8000/api/news/ -o tests/fixtures/newsApiResponse.json
 */
import { describe, expect, it } from 'vitest'
import {
  cloneNewsFilters,
  filterNewsItems,
  sortNewsItems,
} from '~/utils/newsWorkspace'
import type { NewsItem } from '~/types/news'
import { NEWS_KINDS, politicalScaleFromValue, sentimentLabelFromValue } from '~/types/news'
import fixture from './fixtures/newsApiResponse.json'

// JSON imports widen string literals (kind: "editorial" → string), so the
// fixture can't be type-checked against NewsItem's unions at compile time.
// The enum/shape checks below are the real contract guard (they run).
const apiItems = fixture as unknown as NewsItem[]

const REQUIRED_KEYS = [
  'id', 'kind', 'title', 'content', 'excerpt', 'category', 'type',
  'assets', 'currencies', 'commodities', 'tags', 'source', 'author',
  'politicalLeaning', 'economicLeaning', 'sentiment', 'controversyIndex',
  'weight', 'publishedAt', 'isPinned', 'savedByUser', 'readByUser',
  'userReaction', 'comments', 'shares', 'counters', 'predictionSummary',
] as const

describe('news API contract', () => {
  it('returns a non-empty bare array, not a paginated envelope', () => {
    expect(Array.isArray(apiItems)).toBe(true)
    expect(apiItems.length).toBeGreaterThan(0)
    expect(apiItems[0]).not.toHaveProperty('results')
  })

  it('emits every required NewsItem key in camelCase on every item', () => {
    for (const item of apiItems) {
      for (const key of REQUIRED_KEYS) {
        expect(item, `item ${item.id} is missing "${key}"`).toHaveProperty(key)
      }
      expect(
        Object.keys(item).filter(k => k.includes('_')),
        `item ${item.id} leaked snake_case keys`,
      ).toEqual([])
    }
  })

  it('uses valid enum values and correctly typed nested objects', () => {
    for (const item of apiItems) {
      expect(NEWS_KINDS).toContain(item.kind)

      expect(item.source).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        type: expect.any(String),
        provenance: expect.any(String),
      })
      expect(item.author).toMatchObject({
        id: expect.any(String),
        handle: expect.any(String),
        displayName: expect.any(String),
        kind: expect.any(String),
      })
      expect(item.counters).toMatchObject({
        likes: expect.any(Number),
        dislikes: expect.any(Number),
        comments: expect.any(Number),
        shares: expect.any(Number),
        bookmarks: expect.any(Number),
        judgments: expect.any(Number),
      })

      // Anonymous reads must not leak another viewer's per-user state.
      expect(item.userReaction).toMatchObject({
        liked: expect.any(Boolean),
        disliked: expect.any(Boolean),
      })
      expect(Array.isArray(item.comments)).toBe(true)
      expect(Array.isArray(item.shares)).toBe(true)
      expect(Array.isArray(item.assets)).toBe(true)

      expect(Number.isNaN(Date.parse(item.publishedAt))).toBe(false)
    }
  })

  it('carries scores the derived-label helpers can interpret', () => {
    for (const item of apiItems) {
      expect(['left', 'center_left', 'center', 'center_right', 'right'])
        .toContain(politicalScaleFromValue(item.politicalLeaning))
      expect(['bullish', 'neutral', 'bearish'])
        .toContain(sentimentLabelFromValue(item.sentiment))
    }
  })

  it('feeds the workspace filter and sort pipeline without loss', () => {
    const unfiltered = filterNewsItems(apiItems, cloneNewsFilters(), 'feed')
    expect(unfiltered.length).toBe(apiItems.length)

    for (const mode of ['top', 'hot', 'new'] as const) {
      expect(sortNewsItems(apiItems, mode)).toHaveLength(apiItems.length)
    }

    // A category present in the payload must survive its own filter.
    const category = apiItems[0]!.category
    const filters = cloneNewsFilters()
    filters.categories = [category]
    const byCategory = filterNewsItems(apiItems, filters, 'feed')
    expect(byCategory.length).toBeGreaterThan(0)
    expect(byCategory.every(i => i.category === category)).toBe(true)
  })

  it('exposes seeded community activity rather than zeroed counters', () => {
    expect(apiItems.some(i => i.counters.likes > 0)).toBe(true)
    expect(apiItems.some(i => i.comments.length > 0)).toBe(true)
  })
})
