CREATE TABLE `local_kv` (
	`store` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	PRIMARY KEY(`store`, `key`)
);
