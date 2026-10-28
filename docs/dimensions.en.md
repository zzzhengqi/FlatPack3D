# KALLAX dimensions — guess list (English)

This file is an English translation of the "猜测清单" (guess list) section of [dimensions.md](dimensions.md). The Chinese file is the source; numbering and content are kept identical, and nothing is added. Units are cm.

## Guess list

### Phase 1: shelving unit

1. Panel thickness: outer frame panels about 4.0, inner panels about 1.6. The drawings only show that the outer frame panels are clearly thicker; the values are worked back from the overall size.
2. Compartment inner size about 33.52, calculated from item 1.
3. All panels are treated as 39 deep, assuming they are flush front and back.
4. The top and bottom panels run the full 182 and cover the ends of the side panels; the side panels are 174 and sit between them (inferred from the screw positions in steps 1, 18 and 21).
5. "The grey panel is the bottom, the white panel is the top" follows the inference in the analysis report.
6. 4 dowels at each end of a long shelf (the report only says 32 in total), at −15, −5, 5 and 15 in the depth direction.
7. 2 dowels on each edge of a divider, at ±10 in the depth direction.
8. 2 long screws per corner, driven vertically from the outer face of the top/bottom panel into the end of the side panel, at ±10 in the depth direction.
9. The 12 felt pads sit directly under the two side panels and the 4 columns of dividers, one row at the front and one at the back.
10. Hardware sizes have no source: dowel Ø0.8×4, screw Ø0.7×10, felt pad Ø4.2×0.3.
11. During assembly the unit lies flat on its back; the −72° lift in step 23 is an arbitrary angle; step 24 rotates it upright about the rear edge of the bottom panel.
12. The first side panel is taken as the left side panel, and the open side of the unit as the front (the instructions do not mark left and right).

### Phase 2: insert with door, insert with 2 drawers, full set

Insert coordinates use the centre of the compartment's inner space as the origin (x right, y up, z towards the front); the depth direction matches the shelving unit (compartment front edge z = +19.5, rear edge z = −19.5).
Chain of reasoning: nominal insert size 33×33 (product page) → front face of the door/drawer fronts flush with the compartment front edge (product images) → front panel thickness → frame front edge → frame depth.

| Item | Approximate value |
|---|---|
| Insert frame width × height | 33 × 33, on the compartment floor, y ∈ [−16.76, 16.24] |
| Folding frame panel thickness | 0.7 |
| Narrow strip width | 4.0 (folded onto the outside of the side panel, at the front edge) |
| Door / drawer front thickness | 1.6, front face z = 19.5 |
| Frame front edge | z = 17.6 (0.3 behind the back of the front panel at 17.9) |
| Frame depth | 37.1 (17.6 to −19.5) |
| Inner face of the frame side panels | x = ±15.1 |
| Drawer front | 33 × 16.35 × 1.6, gap of 0.3 between the two |
| Drawer box | width 27.6 × height 13 × depth 35.7; sides and back 1.2 thick, bottom 0.3 thick |
| Runner cross-section | 0.65 × 2.5, one on the frame side and one on the drawer side |

13. The insert frame is modelled at the nominal 33×33 and sits on the compartment floor, leaving a gap of about 0.26–0.52 at the top and sides (the compartment inner size of 33.52 is itself approximate).
14. The front faces of the door and drawer fronts are flush with the compartment front edge: from the product images (seen from the front, the door and drawer fronts are flush with the front edge of the unit); the instructions do not show this.
15. Door and drawer fronts are about 1.6 thick: on the door-insert cover (2× render) the door's edge looks about 2.3 times as thick as the frame panel's edge, multiplied by the 0.7 of item 16.
16. Folding frame panels are about 0.7 thick: on the 2× render of door p4 the front edge of the side panel is about 10 px thick and the frame about 470 px tall, converted at 33 cm tall.
17. Narrow strips are about 4 wide: on the two covers the narrow strip takes about 11%–17% of the visible depth of the side panel; perspective makes the front part look larger, so the smaller value of 4 is used.
18. The rear edge of the frame is flush with the rear edge of the compartment: the instructions give no basis for this; it just makes the frame as deep as possible. This gives a frame depth of 37.1.
19. The door is 33×33 and covers the whole front of the insert (including both narrow strips). The narrow strip visible to the left of the door on the cover is the outside of the strip seen from the side, not a part showing at the front (judged from the 2× render).
20. The hinges are on the back of the door on the hinge side, about 2.9 from the door edge, 11 above and below the centre (in the drawings on p9 and p14 the hinges sit at roughly 1/6 of the door height). In 3D the hinges and hinge mounting plates are schematic blocks.
21. Positions of the frame screws 124386: on the hinge side of the door insert they follow the mounting plates (±11 from the centre, 2 per plate), on the other side ±11 from the centre; on both sides of the drawer insert ±8 from the centre (the holes in the narrow strips on the cover are at roughly 1/4 and 3/4 of the height). Front to back they are within the narrow strip; the screws go through the side panel and the narrow strip into the compartment wall.
22. Knobs: the door knob is 2.5 from the edge on the opening side, at mid-height (product images); drawer knobs are in the middle of the front (cover and product images).
23. Bumper pads: on the door, at the upper and lower corners of the opening side on the back (report section 2); on the drawers, at the two upper corners on the back of the front, where the upper-right one comes from the 2× render of p8 and the upper-left one is placed by symmetry (**uncertain**).
24. The two drawer fronts are (33 − 0.3) / 2 = 16.35 tall; the drawer box is about 13 tall (in the p8 drawing the sides are about 0.8 of the front height), and the box bottom is 1 above the bottom of the front.
25. Drawer box width 27.6 = frame inner width 30.2 minus two runners (0.65 + 0.65) on each side; sides and back 1.2 thick, bottom 0.3 thick, box depth 35.7 (back about 1 from the frame back panel). All guesses.
26. The runners on the frame are part of the frame (report: already fitted to the side panels) and are not counted as hardware; cross-section 0.65×2.5, length 35; the drawer-side runners are 34 long, 1.25 above the box bottom.
27. Positions of the connecting bolts 118331, dowels 101345, cam locks 119030 and nails 110519 in the drawers are schematic: symmetric left and right, the first three at the front end and the nails at the back end; their sizes have no source.
28. On the hinges-on-right route, the same door panel is rotated 180° about its own centre (hinges move to the right, knob to the left). Basis: step 2 of the instructions fits the hinges to the door before the routes split, so it can only be the same door turned over. This item is an inference.
29. The pencil lines drawn with the marking gauge are drawn on the inside of the front edge of the compartment floor, 2 from the side walls, at the frame front edge z = 17.6. The size of the gauge itself is unknown; the gauge is not drawn in 3D.
30. For clarity, the demo shows the folding frame (door step 1, drawer step 1), the door (door step 2) and the two drawers (drawer steps 2–9) standing upright in front of the compartment, and pushes them in at later steps. The instructions assemble them lying flat on the floor.

### Phase 3: interaction (click a manual drawing to jump, line-art view)

31. When a manual page has two steps, the click areas are split as "the earlier step in the top half, the later step in the bottom half" (the layout seen when reading page by page). The real dividing line is not necessarily at the middle of the page.
32. The step drawings on door-insert p5 and p10 are taken as the top 45%, and on p11 as the bottom 62% (these three pages also have route thumbnails or the ⓘ adjustment notes). The proportions are judged by eye.
33. The light and mid greys used in the line-art view for highlighted parts, the grey face of the bottom panel and the hardware are there to tell parts apart; they are not the instructions' colours. The instructions use grey only on a few faces.

### Phase 4: wall attachment, Room view

34. In option A the wall fittings 115753 sit in the top corners of the top-left and top-right compartments: against the line where the inside face of the outer side panel meets the back plane, about 3 below the top panel. p27 only shows them in the top corners of these two compartments; the exact distance is a guess.
35. The sizes of the wall fittings, keyhole plates 103693, corner cover caps and L-shaped brackets 10091413 have no source; in 3D they are schematic plates and blocks.
36. In option A the wall is behind the unit, with a 0.3 gap between the back of the unit and the wall; in option B the wall is on the left of the unit (judged from the drawings in report section 7), with the vertical leg of the bracket, taken as 0.25 thick, between the left side panel and the wall.
37. The two brackets in option B are at the left end of the top panel, at ±10 in the depth direction, lined up with the two long screws from step 1 (whose positions are themselves the guess in item 8).
38. In step 26 of option B the demo first moves the unit 25 to the right, then fixes the brackets, and pushes the unit back in step 28. In the p32 overall drawing the unit stands apart from the wall on the left, and step 28 on p34 shows "push the unit towards the wall"; the distance of 25 is a guess.
39. One wall screw (not included) per wall fitting or bracket: the "2x" on p28 and p32 means doing it once for each of the two fittings (brackets) (report section 8). The Ø0.5×5 shape is a guess; which screw to actually use depends on the wall, and in 3D it is only schematic.
40. In Room view the wall sizes (option A 400×260, option B 300×260), the eye height of 160, the walking speed of 150 per second and the turning speed of 60° per second are demo settings, not from the instructions; the cyan outlines are drawn on the wall from the unit's outline and the fitting positions.

### Phase 5: detail circle and motions

41. The sizes of the Z-shaped hex key 100001 (short leg 2.6, long leg 7.5, other short leg 3.6, thickness 0.6) and of the screwdriver (shaft 8, handle 10 long and 2.4 thick) are schematic; they only appear while a screw is being turned.
42. Screwing in starts with the tip just entering the hole (0.8 of the screw length from the final position) and takes 4 turns; screwing out also takes 4 turns over 0.8 of the length; the tightening in step 27 of option A takes 1.5 turns; the cam lock in drawer step 4 turns half a turn. The instructions give none of these turn counts, depths or angles.
43. The direction of rotation follows the opposite wrench arrows on p33 and p35: seen from the screw head, screwing in is clockwise and screwing out anticlockwise (report section 8). The arrows on other pages are drawn in perspective and are hard to read, so the same rule is used everywhere.
44. In step 27 of option A the keyhole plate is adjusted ±0.5 left-right and up-down: p29 only shows double arrows, not how far.
45. Timing: hardware flies in over 1.1 s, a screw turns in over 2 s, turning in place and tightening take 1.4 s, each sliding adjustment 1.6 s; in continuous play the demo pauses 1.5 s after each step. All demo settings.
46. By default the detail circle shows the first item of the smallest kind of hardware in the step, together with any other small items within 12 cm, with a second circle for those farther away; only step 27 of option A follows the p29 leader to the top-right compartment and shows the right-hand one. Which item each detail circle in the instructions shows has not been matched page by page.

### Hinge positions of the two door-insert routes (basis in the instructions)

- The p6–p10 route: steps 6 and 7 on p7 and p8 fit the two hinge mounting plates on the left wall of the compartment; step 9 on p9 hangs the hinges on the left and the door opens to the left. Hence "**hinges on left**".
- The p11–p15 route: steps 6 and 7 on p13 fit the two mounting plates on the right wall; step 9 on p14 hangs the hinges on the right and the door opens to the right. Hence "**hinges on right**".
- Based on p7, p9, p13 and p14 re-rendered at 2× resolution; see section 7 of the analysis report.

### Full-set layout (this layout comes from the product images, not from the assembly instructions)

Based on two "KALLAX shelving unit + 10 inserts" product images in `refs/` (black-brown pe748007, white stained oak effect pe618893), which have the same layout:

- Rows 1 and 2 from the top: empty;
- Row 3: 5 door inserts, all with the knob on the right, so they have their **hinges on the left** (the door opens to the left);
- Row 4: 5 double-drawer inserts;
- Row 5: empty.

The instructions only say that an insert goes into a single compartment; they do not say which compartment.
