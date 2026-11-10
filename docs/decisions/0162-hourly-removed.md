# 0162: Edit feed's "Hourly" goes

**In one line:** Edit feed's "Hourly" goes, since Automatic is now at most hourly too: the choice is Automatic · Daily; a stored hour behaves as Automatic and shows as it

*3 November 2026. Once feeds were checked at most hourly (decision 0161),
"Hourly" did exactly what "Automatic" does. The owner: "You're allowed to
touch it. We go by less, but better."*

**Decision.** Edit feed's **Check for new articles** offers **Automatic ·
Daily**. The server accepts only `automatic` and `daily` (`folders::Check`);
an old tab that still sends `hourly` gets the usual "nine turtles was
updated. Reload" note.

**Stored values stay.** A feed someone set to Hourly keeps
`check_at_most = 3600` in the database. It behaves exactly as 0 does (the
shortest wait is an hour anyway), and Edit feed shows it as Automatic
(`checkFrom` in `web/src/lib/shapes.ts`); saving Edit feed writes 0. No
data is rewritten, so nothing needs a backup or a structure change.
