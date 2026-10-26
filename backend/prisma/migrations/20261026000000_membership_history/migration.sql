ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_membershipId_fkey`;
DROP INDEX `Payment_membershipId_key` ON `Payment`;
CREATE INDEX `Payment_membershipId_idx` ON `Payment`(`membershipId`);
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE `MembershipChange` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `membershipId` INTEGER NOT NULL,
  `paymentId` INTEGER NULL,
  `tier` ENUM('BASIC', 'SILVER', 'GOLD') NOT NULL,
  `kind` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `startDate` DATETIME(3) NULL,
  `endDate` DATETIME(3) NULL,
  `activatedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MembershipChange_paymentId_key`(`paymentId`),
  INDEX `MembershipChange_membershipId_createdAt_idx`(`membershipId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MembershipChange_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `Membership`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `MembershipChange_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
UPDATE `Membership` SET `endDate` = DATE_ADD(`startDate`, INTERVAL 1 YEAR) WHERE `tier` <> 'BASIC' AND `endDate` IS NULL AND `isActive` = true;
INSERT INTO `MembershipChange` (`membershipId`, `paymentId`, `tier`, `kind`, `status`, `startDate`, `endDate`, `activatedAt`, `createdAt`)
SELECT m.id, p.id, m.tier, 'PURCHASE', CASE WHEN p.status = 'PENDING' THEN 'PENDING' WHEN m.isActive = true THEN 'ACTIVE' ELSE 'EXPIRED' END, m.startDate, m.endDate, CASE WHEN m.isActive = true THEN m.startDate ELSE NULL END, m.createdAt
FROM `Membership` m LEFT JOIN `Payment` p ON p.membershipId = m.id;
