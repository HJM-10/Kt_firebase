ALTER TABLE `Equipment` ADD COLUMN `venueId` INTEGER NULL,
 ADD COLUMN `brand` VARCHAR(191) NULL, ADD COLUMN `model` VARCHAR(191) NULL,
 ADD COLUMN `material` VARCHAR(191) NULL, ADD COLUMN `ballType` VARCHAR(191) NULL,
 ADD COLUMN `condition` VARCHAR(191) NULL;
ALTER TABLE `Equipment` ADD CONSTRAINT `Equipment_venueId_fkey` FOREIGN KEY (`venueId`) REFERENCES `Venue`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `EquipmentRental` MODIFY `status` ENUM('PENDING_PAYMENT','CONFIRMED','CANCELLED','RETURNED') NOT NULL DEFAULT 'CONFIRMED',
 ADD COLUMN `returnedAt` DATETIME(3) NULL, ADD COLUMN `damageNotes` TEXT NULL,
 ADD COLUMN `damagedQuantity` INTEGER NOT NULL DEFAULT 0;
ALTER TABLE `PromoCode` ADD COLUMN `perCustomerLimit` INTEGER NOT NULL DEFAULT 1;
ALTER TABLE `Payment` ADD COLUMN `paidAt` DATETIME(3) NULL;
UPDATE `Payment` SET `paidAt` = `updatedAt` WHERE `status` IN ('PAID','REFUNDED');
CREATE INDEX `EquipmentRental_equipmentId_status_dates_idx` ON `EquipmentRental` (`equipmentId`, `status`, `rentalDate`, `returnDate`);
-- Existing confirmed rentals with unpaid fees become expiring payment holds.
UPDATE `EquipmentRental` r JOIN `Payment` p ON p.rentalId = r.id
 SET r.status = 'PENDING_PAYMENT', p.expiresAt = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE)
 WHERE r.status = 'CONFIRMED' AND p.status = 'PENDING';
