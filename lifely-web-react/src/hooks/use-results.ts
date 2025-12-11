import { useState, useEffect } from 'react';
import type { LifelyResults, RawStats } from '@/lib/types';
import { transformStats } from '@/lib/types';

const STORAGE_KEY = 'lifely_results';

// Mock data for development
const MOCK_STATS: RawStats = {
  year: 2025,
  time_stats: {
    total_events: 392,
    total_hours: 1807.9,
    events_per_month: { "1": 37, "2": 21, "3": 26, "4": 35, "5": 26, "6": 38, "7": 22, "8": 39, "9": 36, "10": 43, "11": 47, "12": 22 },
    hours_per_month: { "1": 117.3, "2": 93.5, "3": 106.4, "4": 106.1, "5": 198.4, "6": 305.3, "7": 106.5, "8": 221.2, "9": 172.6, "10": 235.2, "11": 80.3, "12": 64.9 },
    events_per_weekday: { "Fri": 82, "Mon": 46, "Tue": 36, "Wed": 47, "Sun": 58, "Sat": 85, "Thu": 38 },
    busiest_day: ["2025-06-14", 12, 152.4],
  },
  friend_stats: [
    { email: "angela.kaur@gmail.com", display_name: null, event_count: 4, total_hours: 8.8, events: [
      { id: "1", summary: "Dinner", date: "2025-09-13", hours: 1, location_raw: null, venue_name: "Suram Sushi", neighborhood: "Hudson Yards", cuisine: "Japanese" },
    ]},
  ],
  location_stats: {
    top_neighborhoods: [["Williamsburg", 44], ["Greenpoint", 20], ["Lower East Side", 8], ["Midtown", 8], ["Midtown West", 7], ["Koreatown", 5]],
    top_venues: [["Greenpoint Psychotherapy", 10], ["The Residence of Mr. Moto", 3], ["JFK Airport", 3]],
    top_cuisines: [["Japanese", 13], ["American", 11], ["Korean", 8], ["Chinese", 7], ["Italian", 5]],
    map_points: [],
  },
  inferred_friends: [
    { name: "Beth", normalized_name: "beth", event_count: 12, total_hours: 16.2, linked_email: null, events: [
      { id: "b1", summary: "Dinner with Beth", date: "2025-01-07", hours: 1, location_raw: null, venue_name: "Cho Dang Gol", neighborhood: "Koreatown", cuisine: "Korean" },
      { id: "b2", summary: "Dinner with Beth", date: "2025-02-16", hours: 1, location_raw: null, venue_name: "Twin Tails", neighborhood: "Midtown West", cuisine: "Seafood" },
    ]},
    { name: "Masha", normalized_name: "masha", event_count: 9, total_hours: 22, linked_email: null, events: [
      { id: "m1", summary: "Movie with Masha", date: "2025-03-15", hours: 2, location_raw: null, venue_name: "AMC 34th Street", neighborhood: "Midtown", cuisine: null },
    ]},
    { name: "Jenny", normalized_name: "jenny", event_count: 8, total_hours: 19.5, linked_email: null, events: [
      { id: "j1", summary: "Dinner with Jenny", date: "2025-05-29", hours: 1.5, location_raw: null, venue_name: "Wanpaku", neighborhood: "Greenpoint", cuisine: "Japanese" },
    ]},
    { name: "Karina", normalized_name: "karina", event_count: 7, total_hours: 15, linked_email: null, events: [
      { id: "k1", summary: "Hangout with Karina", date: "2025-06-25", hours: 2, location_raw: null, venue_name: "Five Iron Golf", neighborhood: "Midtown", cuisine: null },
    ]},
    { name: "Chloe", normalized_name: "chloe", event_count: 6, total_hours: 12, linked_email: null, events: [
      { id: "c1", summary: "Dinner with Chloe", date: "2025-04-10", hours: 1.5, location_raw: null, venue_name: "886", neighborhood: "East Village", cuisine: "Taiwanese" },
    ]},
  ],
  activity_stats: {
    health: { category: "health", event_count: 16, total_hours: 14.8, top_venues: [["Greenpoint Psychotherapy", 10]], top_activities: [["therapy", 12], ["doctor", 2]] },
    fitness: { category: "fitness", event_count: 23, total_hours: 50.8, top_venues: [["Barry's Noho", 1]], top_activities: [["yoga", 7], ["gym", 4]] },
    personal_care: { category: "personal_care", event_count: 4, total_hours: 4.3, top_venues: [["Silver Mirror", 1]], top_activities: [["haircut", 2], ["facial", 1]] },
    wellness: { category: "wellness", event_count: 2, total_hours: 3, top_venues: [["Guifei Spa", 1]], top_activities: [["meditation", 1]] },
    entertainment: { category: "entertainment", event_count: 62, total_hours: 185.6, top_venues: [["Mr. Moto", 2]], top_activities: [["dinner", 12], ["concert", 4]] },
    learning: { category: "learning", event_count: 11, total_hours: 30.5, top_venues: [], top_activities: [["workshop", 2]] },
  },
  narrative: {
    story: "In 2025, you quietly packed 392 events and 1,807 hours into a year that somehow still revolved around a few favorite orbits: Williamsburg first, then Greenpoint, and those Saturday plans that reliably tipped November into \"busiest month\" territory.\n\nYou made real space for your inner life, showing up at Greenpoint Psychotherapy and squeezing in yoga and gym sessions at places like Barry's Noho between dinners, flights through JFK, and long, wandering museum hours.\n\nYour circle sharpened into something clear and sturdy: easy evenings with Beth in Midtown West and Hell's Kitchen, lingering Greenpoint nights with Jenny, and shared movies and waterfront moments with Masha and Karina.\n\nThrough Japanese, Korean, and American meals, a couple of haircuts and facials, and even a steam scalp treatment at Guifei Spa, the year looks like a steady practice of taking yourself—and your relationships—seriously, one small, logged choice at a time."
  },
  patterns: [
    { title: "Busiest Month in November", detail: "November saw the highest event count (47), contributing significantly to overall 2025 stats." },
    { title: "Socializing in Williamsburg", detail: "Top neighborhood with 44 events, highlighted by frequent outings with friends like Beth and Masha." },
    { title: "Rise of Fitness Activities", detail: "Fitness events surged with 23 occurrences, marking a strong focus on health in 2025." },
  ],
  experiments: [
    { title: "Japanese Culinary Tour", description: "Explore top Japanese restaurants in Midtown West and Williamsburg with friends." },
    { title: "Fitness Challenge Saturdays", description: "Host fitness events every Saturday focused on yoga and gym sessions." },
    { title: "Neighborhood Workshops", description: "Organize learning workshops in Greenpoint, inviting friends." },
  ],
};

export function useResults() {
  const [results, setResults] = useState<LifelyResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // Check for URL param to use mock data
      const params = new URLSearchParams(window.location.search);
      const useMock = params.get('mock') === 'true' || import.meta.env.DEV;

      // Try to load from sessionStorage first
      const stored = sessionStorage.getItem(STORAGE_KEY);

      if (stored) {
        const raw = JSON.parse(stored) as RawStats;
        setResults(transformStats(raw));
      } else if (useMock) {
        // Use mock data in development
        setResults(transformStats(MOCK_STATS));
      } else {
        setError('No results found. Please connect your calendar first.');
      }
    } catch (e) {
      setError('Failed to load results.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResults = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.href = '/';
  };

  return { results, loading, error, clearResults };
}
