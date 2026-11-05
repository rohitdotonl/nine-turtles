-- The weekly email comes once a week or not at all (the owner's review of
-- what to remove, point 12, decision 0184). A reader who had chosen twice a
-- week now has it on Saturday mornings, and `weekly_moved` makes their next
-- email say so in one line, once (`weekly::send_one`).
INSERT INTO person_settings (person_id, name, value)
    SELECT person_id, 'weekly_moved', '1' FROM person_settings
    WHERE name = 'weekly' AND value = 'twice';
UPDATE person_settings SET value = 'weekly' WHERE name = 'weekly' AND value = 'twice';
