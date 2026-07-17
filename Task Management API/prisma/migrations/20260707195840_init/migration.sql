-- CreateTable
CREATE TABLE [User] (
    [id] NVARCHAR(191) NOT NULL,
    [email] NVARCHAR(191) NOT NULL,
    [password] NVARCHAR(191) NOT NULL,
    [name] NVARCHAR(191) NULL,
    [role] NVARCHAR(191) NOT NULL DEFAULT N'USER',
    [createdAt] DATETIME2(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,

    CONSTRAINT [User_pkey] PRIMARY KEY ([id]),
    CONSTRAINT [User_role_check] CHECK ([role] IN (N'USER', N'ADMIN'))
);

-- CreateTable
CREATE TABLE [Task] (
    [id] NVARCHAR(191) NOT NULL,
    [title] NVARCHAR(191) NOT NULL,
    [description] NVARCHAR(MAX) NULL,
    [status] NVARCHAR(191) NOT NULL DEFAULT N'TODO',
    [ownerId] NVARCHAR(191) NOT NULL,
    [createdAt] DATETIME2(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2(3) NOT NULL,

    CONSTRAINT [Task_pkey] PRIMARY KEY ([id]),
    CONSTRAINT [Task_status_check] CHECK ([status] IN (N'TODO', N'IN_PROGRESS', N'DONE'))
);

-- CreateIndex
CREATE UNIQUE INDEX [User_email_key] ON [User]([email]);

-- AddForeignKey
ALTER TABLE [Task] ADD CONSTRAINT [Task_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;
