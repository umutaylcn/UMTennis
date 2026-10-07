# Player photo provenance (2026-10-07)

These six live-fixture portraits are edits of identified, genuine match photographs. The edit removes the background only; it must not invent the player, extend a cropped body, or change identity. The source photos are preserved in the local workspace under `assets/player_sources/raw/`.

| Player | Site cutout | Original photo | Source page | Notes |
| --- | --- | --- | --- | --- |
| Sho Shimabukuro | `public/players/cutouts/844.png` | `sho-shimabukuro-tennismagazine.jpg` | https://tennismagazine.jp/article/detail/24793 | 2023 Wimbledon action photo. Replaces a previous portrait with no traceable real-photo source. |
| Ilia Simakin | `public/players/cutouts/658.png` | `ilia-simakin-matchstat.jpg` | https://matchstat.com/tennis/h2h-odds-bets/Ilia%20Simakin/Tom%20Paris/ | Challenger action photo. |
| Nicolas Mejia | `public/players/cutouts/132.png` | `nicolas-mejia-colombiasports.webp` | https://colombiasports.net/que-esta-pasando/challenger-de-bogota-nicolas-mejia-se-consagra-ante-un-gran-juan-sebastian-gomez | Bogotá Challenger action photo. |
| Kimmer Coppejans | `public/players/cutouts/101.png` | `kimmer-coppejans-starsport.jpg` | https://starsporttv.be/fr/content/us-open-kimmer-coppejans-battu-au-troisieme-tour-des-qualifications | 2025 US Open qualifying action photo. |
| Pavel Kotov | `public/players/cutouts/659.png` | `pavel-kotov-tennistv.jpg` | https://www.tennistv.com/players/K09F/pavel-kotov/ | ATP Media action photo. |
| Bernard Tomic | `public/players/cutouts/1104.png` | `bernard-tomic-commons.jpg` | https://commons.wikimedia.org/wiki/File:Bernard_Tomic_2,_Wimbledon_2013_-_Diliff.jpg | Photo by David Iliff, CC BY-SA 3.0. Background removed; derivative released under the same license. |

The old Sho intermediate is retained locally at `assets/player_sources/rejected-ai/844-suspected-generated.png` for review, but it is no longer used by the site or the cutout preparation script.

For future additions, record the original source URL and preserve the original photograph before preparing a cutout. If there is no verifiable source photo, keep the silhouette instead of creating a player image from scratch.
