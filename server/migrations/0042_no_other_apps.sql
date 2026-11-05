-- Syncing with other feed reader apps ends (the owner's review of what to
-- remove, point 2, decision 0184): Reeder, NetNewsWire and other apps no
-- longer read a nine turtles account through the Google Reader API, so the
-- app passwords they signed in with go. The owner chose to delete them (his
-- standing permission for removed features' data, 3 November 2026); the
-- backup before every structure change holds them as they were.
DROP TABLE app_passwords;
