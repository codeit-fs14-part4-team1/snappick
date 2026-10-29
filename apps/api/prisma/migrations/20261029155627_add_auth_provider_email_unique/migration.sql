-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_provider_provider_email_key" ON "auth_providers"("provider", "provider_email");

