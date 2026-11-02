-- "Member timed out" used to post lifted timeouts too. Those now have their own event,
-- so channels that received them keep receiving them.
INSERT OR IGNORE INTO `log_channels` (`guild_id`, `event`, `channel_id`)
SELECT `guild_id`, 'member_untimeout', `channel_id` FROM `log_channels` WHERE `event` = 'member_timeout';
