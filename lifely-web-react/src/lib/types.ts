// ═══════════════════════════════════════════════════════════
// LIFELY DATA TYPES
// ═══════════════════════════════════════════════════════════

// Raw stats from Python CLI (matches stats_2025.json)
export interface RawStats {
  year: number;
  time_stats: {
    total_events: number;
    total_hours: number;
    events_per_month: Record<string, number>;
    hours_per_month: Record<string, number>;
    events_per_weekday: Record<string, number>;
    busiest_day: [string, number, number]; // [date, events, hours]
  };
  friend_stats: RawFriend[];
  location_stats: {
    top_neighborhoods: Array<[string, number]>;
    top_venues: Array<[string, number]>;
    top_cuisines: Array<[string, number]>;
    map_points: MapPoint[];
  };
  inferred_friends: RawInferredFriend[];
  activity_stats: Record<string, RawActivityCategory>;
  narrative: {
    story: string;
  };
  patterns: RawPattern[];
  experiments: RawExperiment[];
  coverage?: RawCoverage;
  llm_warnings?: string[];
}

export interface RawFriend {
  email: string;
  display_name: string | null;
  event_count: number;
  total_hours: number;
  events: RawEvent[];
}

export interface RawInferredFriend {
  name: string;
  normalized_name: string;
  event_count: number;
  total_hours: number;
  linked_email: string | null;
  events: RawEvent[];
}

export interface RawEvent {
  id: string;
  summary: string;
  date: string;
  hours: number;
  location_raw: string | null;
  venue_name: string | null;
  neighborhood: string | null;
  cuisine: string | null;
}

export interface RawActivityCategory {
  category: string;
  event_count: number;
  total_hours: number;
  top_venues: Array<[string, number]>;
  top_activities: Array<[string, number]>;
  is_interesting?: boolean;
}

export interface RawCoverage {
  total_events: number;
  events_with_location: number;
  events_classified: number;
  interesting_events: number;
}

export interface RawPattern {
  title: string;
  detail: string;
}

export interface RawExperiment {
  title: string;
  description: string;
}

export interface MapPoint {
  lat: number;
  lng: number;
  count: number;
  label: string;
}

// ═══════════════════════════════════════════════════════════
// TRANSFORMED DATA FOR UI (matches results-page-spec.md)
// ═══════════════════════════════════════════════════════════

export interface LifelyResults {
  // Beat 1: Hero
  stats: HeroData;

  // Beat 2: People
  topPeople: Person[];

  // Beat 3: Places
  places: PlacesData;

  // Beat 4: Rituals
  rituals: RitualsData;

  // Beat 5: Patterns
  patterns: Pattern[];

  // Beat 6: Narrative
  narrative: string;

  // Beat 7: Experiments
  experiments: Experiment[];
}

export interface HeroData {
  year: number;
  totalEvents: number;
  totalHours: number;
  totalPeople: number;
  busiestMonth: string;
  busiestDay: string;
}

export interface Person {
  name: string;
  displayName?: string;
  count: number;
  hours: number;
  venues: string[];
  neighborhoods: string[];
  percentage: number; // relative to top person
}

export interface PlacesData {
  neighborhoods: Array<[string, number]>;
  cuisines: Array<[string, number]>;
  mapPoints?: MapPoint[];
}

export interface RitualsData {
  categories: CategoryData[];
  totalInteresting: number;
  coverage?: {
    total: number;
    classified: number;
    interesting: number;
  };
}

export interface CategoryData {
  name: string;
  count: number;
  hours: number;
  topActivities: Array<[string, number]>;
}

export interface Activity {
  name: string;
  count: number;
  venue?: string;
}

export interface Pattern {
  icon: string;
  title: string;
  detail: string;
}

export interface Experiment {
  title: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════
// DATA TRANSFORMATION
// ═══════════════════════════════════════════════════════════

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PATTERN_ICONS: Record<string, string> = {
  busiest: '📊',
  month: '📅',
  social: '🔥',
  location: '📍',
  fitness: '💪',
  default: '✨',
};

function getPatternIcon(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('busiest')) return PATTERN_ICONS.busiest;
  if (lower.includes('month') || lower.includes('november')) return PATTERN_ICONS.month;
  if (lower.includes('social') || lower.includes('friend')) return PATTERN_ICONS.social;
  if (lower.includes('neighborhood') || lower.includes('williamsburg')) return PATTERN_ICONS.location;
  if (lower.includes('fitness') || lower.includes('yoga') || lower.includes('gym')) return PATTERN_ICONS.fitness;
  return PATTERN_ICONS.default;
}

function asPattern(title: string, detail: string): Pattern {
  return { icon: getPatternIcon(title), title, detail };
}

function buildFallbackPatterns(opts: {
  busiestMonth: string;
  busiestMonthCount: number;
  busiestDay: string;
  busiestDayCount: number;
  topNeighborhood?: [string, number];
  topPerson?: Person;
}): Pattern[] {
  const patterns: Pattern[] = [];

  patterns.push(asPattern(`Peak month: ${opts.busiestMonth}`, `${opts.busiestMonthCount} events`));
  patterns.push(asPattern(`Busiest day: ${opts.busiestDay}`, `${opts.busiestDayCount} events`));

  if (opts.topNeighborhood?.[0]) {
    patterns.push(
      asPattern(`Top neighborhood: ${opts.topNeighborhood[0]}`, `${opts.topNeighborhood[1]} moments`)
    );
  } else if (opts.topPerson?.name) {
    patterns.push(
      asPattern(`Most-seen friend: ${opts.topPerson.name}`, `${opts.topPerson.count} moments`)
    );
  }

  return patterns.slice(0, 3);
}

function buildFallbackExperiments(opts: {
  busiestDay: string;
  topNeighborhood?: [string, number];
  topCategory?: CategoryData;
}): Experiment[] {
  const experiments: Experiment[] = [];

  if (opts.topNeighborhood?.[0]) {
    experiments.push({
      title: 'One new neighborhood',
      description: `You logged ${opts.topNeighborhood[1]} moments in ${opts.topNeighborhood[0]}. Pick one Saturday elsewhere.`,
    });
  } else {
    experiments.push({
      title: 'One new plan',
      description: 'Pick one Saturday somewhere new. Keep it simple.',
    });
  }

  experiments.push({
    title: `Keep ${opts.busiestDay} lighter`,
    description: "It's your busiest day. Leave one block unscheduled.",
  });

  if (opts.topCategory) {
    const name = opts.topCategory.name.toLowerCase();
    experiments.push({
      title: `Make ${name} a ritual`,
      description: `${opts.topCategory.count} sessions this year. Try one a week for a month.`,
    });
  } else {
    experiments.push({
      title: 'One hour for you',
      description: 'Put a weekly hour on the calendar. No invites.',
    });
  }

  return experiments.slice(0, 3);
}

export function transformStats(raw: RawStats): LifelyResults {
  // Find busiest month
  const monthEntries = Object.entries(raw.time_stats.events_per_month);
  const busiestMonthEntry = monthEntries.reduce((a, b) => (b[1] > a[1] ? b : a), monthEntries[0] || ['1', 0]);
  const busiestMonthNum = busiestMonthEntry[0];
  const busiestMonthCount = busiestMonthEntry[1] ?? 0;
  const busiestMonth = MONTH_NAMES[parseInt(busiestMonthNum) - 1] || MONTH_NAMES[0];

  // Find busiest weekday
  const dayEntries = Object.entries(raw.time_stats.events_per_weekday);
  const busiestDayEntry = dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a), dayEntries[0] || ['Monday', 0]);
  const busiestDay = busiestDayEntry[0];
  const busiestDayCount = busiestDayEntry[1] ?? 0;

  // Merge and sort people (prefer inferred_friends as they have better names)
  const allPeople: Person[] = [];

  // Add inferred friends first (they have actual names)
  raw.inferred_friends.forEach(f => {
    const venues = [...new Set(f.events.filter(e => e.venue_name).map(e => e.venue_name!))].slice(0, 3);
    const neighborhoods = [...new Set(f.events.filter(e => e.neighborhood).map(e => e.neighborhood!))].slice(0, 3);
    allPeople.push({
      name: f.name,
      count: f.event_count,
      hours: f.total_hours,
      venues,
      neighborhoods,
      percentage: 0, // will calculate after
    });
  });

  // Add calendar friends (from email invites) - use email username as name
  raw.friend_stats.forEach(f => {
    const name = f.display_name || f.email.split('@')[0];
    const venues = [...new Set(f.events.filter(e => e.venue_name).map(e => e.venue_name!))].slice(0, 3);
    const neighborhoods = [...new Set(f.events.filter(e => e.neighborhood).map(e => e.neighborhood!))].slice(0, 3);
    allPeople.push({
      name,
      count: f.event_count,
      hours: f.total_hours,
      venues,
      neighborhoods,
      percentage: 0,
    });
  });

  // Sort by event count, take top 5
  allPeople.sort((a, b) => b.count - a.count);
  const topPeople = allPeople.slice(0, 5);

  // Calculate percentages relative to top person
  const maxCount = topPeople[0]?.count || 1;
  topPeople.forEach(p => {
    p.percentage = Math.round((p.count / maxCount) * 100);
  });

  // Rituals: get ALL interesting categories dynamically
  const categories: CategoryData[] = [];
  let totalInteresting = 0;

  // Get interesting categories from LLM classification
  Object.entries(raw.activity_stats).forEach(([catName, data]) => {
    if (data.is_interesting) {
      totalInteresting += data.event_count;
      categories.push({
        name: catName.charAt(0).toUpperCase() + catName.slice(1),
        count: data.event_count,
        hours: data.total_hours,
        topActivities: data.top_activities.slice(0, 5),
      });
    }
  });

  // Sort categories by event count
  categories.sort((a, b) => b.count - a.count);

  // Transform patterns
  const aiPatterns = raw.patterns || [];
  let patterns: Pattern[] = aiPatterns.map(p => ({
    icon: getPatternIcon(p.title),
    title: p.title,
    detail: p.detail,
  }));

  if (patterns.length === 0) {
    patterns = buildFallbackPatterns({
      busiestMonth,
      busiestMonthCount,
      busiestDay,
      busiestDayCount,
      topNeighborhood: raw.location_stats.top_neighborhoods?.[0],
      topPerson: topPeople[0],
    });
  }

  const aiExperiments = raw.experiments || [];
  let experiments = aiExperiments.slice(0, 3);
  if (experiments.length === 0) {
    experiments = buildFallbackExperiments({
      busiestDay,
      topNeighborhood: raw.location_stats.top_neighborhoods?.[0],
      topCategory: categories[0],
    });
  }

  return {
    stats: {
      year: raw.year,
      totalEvents: raw.time_stats.total_events,
      totalHours: Math.round(raw.time_stats.total_hours),
      totalPeople: allPeople.length,
      busiestMonth,
      busiestDay,
    },
    topPeople,
    places: {
      neighborhoods: raw.location_stats.top_neighborhoods.slice(0, 6),
      cuisines: raw.location_stats.top_cuisines.slice(0, 5),
      mapPoints: raw.location_stats.map_points,
    },
    rituals: {
      categories: categories.slice(0, 6),
      totalInteresting,
      coverage: raw.coverage ? {
        total: raw.coverage.total_events,
        classified: raw.coverage.events_classified,
        interesting: raw.coverage.interesting_events,
      } : undefined,
    },
    patterns,
    narrative: raw.narrative.story,
    experiments,
  };
}
