CREATE DATABASE IF NOT EXISTS prism_document;
USE prism_document;

CREATE TABLE IF NOT EXISTS cpu (
    `dateTime` DATETIME NOT NULL,
    `cpuMHz` DECIMAL(8,3) NOT NULL,
    `cpuMHzMin` DECIMAL(8,3) NOT NULL,
    `cpuMHzMax` DECIMAL(8,3) NOT NULL,
    PRIMARY KEY (`dateTime`)
);

CREATE TABLE IF NOT EXISTS memory_info (
    `dateTime` DATETIME NOT NULL,
    `MemTotal` INT(10) NOT NULL,
    `MemFree` INT(10) NOT NULL,
    PRIMARY KEY (`dateTime`)
);

CREATE TABLE IF NOT EXISTS disk_info (
    `dateTime` DATETIME NOT NULL,
    `size` DECIMAL(5,1) NOT NULL,
    `used` DECIMAL(5,1) NOT NULL,
    `avail` DECIMAL(5,1) NOT NULL,
    `usePercent` TINYINT(3) NOT NULL,
    PRIMARY KEY (`dateTime`)
);

CREATE TABLE IF NOT EXISTS process_info (
    `dateTime` DATETIME NOT NULL,
    `pid` MEDIUMINT(8) NOT NULL,
    `user` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `cpuPercent` DECIMAL(4,0) NOT NULL,
    `memPercent` DECIMAL(4,0) NOT NULL,
    `command` VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    PRIMARY KEY (`dateTime`, `pid`),
    KEY idx_process_info_datetime (`dateTime`),
    KEY idx_process_info_mem (`memPercent`)
);

CREATE TABLE IF NOT EXISTS users (
    `user` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `password` VARCHAR(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `admin` CHAR(1) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `email` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `phone` VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    `description` VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    PRIMARY KEY (`user`)
);
