ALTER TABLE `Venue` ADD COLUMN `address` VARCHAR(500) NULL,
  ADD COLUMN `latitude` DOUBLE NULL, ADD COLUMN `longitude` DOUBLE NULL;
ALTER TABLE `User` ADD COLUMN `firebaseUid` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `User_firebaseUid_key` ON `User` (`firebaseUid`);
CREATE INDEX `BookingSlot_venueId_date_startTime_idx` ON `BookingSlot` (`venueId`, `date`, `startTime`);
CREATE INDEX `Payment_status_expiresAt_idx` ON `Payment` (`status`, `expiresAt`);
