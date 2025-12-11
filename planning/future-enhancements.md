# Future Enhancements

> Ideas deferred from v1 to keep scope tight.

---

## UI / Visualization

| Enhancement | Why Deferred | Unlock Condition |
|-------------|--------------|------------------|
| **Heat map for places** | No lat/lng data; bars work now | Add Places API or manual centroid mapping |
| **Compass (radial UI)** | High complexity, mobile-unfriendly | v2 "explorer mode" for power users |
| **Calendar heatmap** | Scope creep; not core to story | Phase 5 polish |
| **Animated map path** | Needs geospatial data | Places API integration |
| **Year-over-year comparison** | Single year is enough for v1 | Multi-year data storage |

---

## Data / Backend

| Enhancement | Why Deferred | Unlock Condition |
|-------------|--------------|------------------|
| **Lat/lng from enrichment** | LLM coords unreliable; Places API adds cost | Justify with map feature demand |
| **Multi-city support** | NYC-focused for now | User feedback, broader adoption |
| **Multi-calendar aggregation** | Complexity; OAuth scopes | Phase 5 |
| **LLM result caching** | ~$0.10/run is cheap enough | If costs rise or runs increase |
| **Streak calculations** | Phase 3 feature, not v1 UI | Before narrative generation |

---

## Interaction

| Enhancement | Why Deferred | Unlock Condition |
|-------------|--------------|------------------|
| **Tap-to-advance (desktop)** | Scroll is primary; tap is mobile | User feedback |
| **Keyboard navigation** | Accessibility nice-to-have | Accessibility audit |
| **Share to social** | Screenshots are enough for v1 | Demand for direct sharing |
| **PDF export** | Screenshot-optimized layout works | Enterprise/archival use case |

---

## Polish

| Enhancement | Why Deferred | Unlock Condition |
|-------------|--------------|------------------|
| **Light mode** | Dark-first is the brand | Strong user demand |
| **Custom themes** | One theme is enough | Power user requests |
| **Ambient audio** | Gimmicky; visuals should speak | Never (probably) |
| **Confetti/celebrations** | Keep it tasteful | If it feels right |

---

## When to Revisit

- **After v1 ships**: Gather feedback, see what people screenshot most
- **If map requests come in**: Build centroid mapping or add Places API
- **If multi-city users appear**: Generalize neighborhood handling
- **Phase 5**: Calendar heatmap, year-over-year, multi-calendar
