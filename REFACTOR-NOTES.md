# Chrona v2.1.3 structure

Chrona uses one authoritative JavaScript startup file (`timeline.js`) to avoid partial-load and cache-order failures.

Component styling remains separated:

- `css/phone-period.css` — phone period rails
- `css/year-ruler.css` — yellow year ruler and labels
- `css/search.css` — expanding search control

JavaScript behavior stays in the relevant named functions inside `timeline.js`. Do not append duplicate component overrides at the end of `styles.css`.
