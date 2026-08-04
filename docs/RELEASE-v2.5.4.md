# Chrona v2.5.4

- Radar now renders only currently enabled groups.
- Radar date bounds recalculate from visible events and periods with compact padding.
- Group visibility changes are debounced to avoid repeated radar jumps during rapid toggling.
- The same behavior applies to the horizontal desktop/tablet radar and vertical iPhone radar.
- An empty visible-group set keeps the last radar range while showing no event marks.
