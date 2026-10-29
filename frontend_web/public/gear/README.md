# Demo rental product imagery

Six original illustrative product images generated with the built-in imagegen tool on 29 October 2026: padel racket, padel ball can, cricket bat/leather ball, football, field hockey stick/ball and table tennis set. These are generic sample products, not verified venue inventory or branded product claims. All source images are stored here with transparency. Exact prompts are in prompts.json.

The isolated demo is populated by backend/scripts/seed-arena-preview.js followed by backend/scripts/seed-studio-preview.js. The latter refuses production and non-demo databases. It supplies the correct ball types, sample rates/quantities and venue associations. Images are served from /gear/. No seed script runs automatically in production.
