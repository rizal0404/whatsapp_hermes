import { prisma } from '../database/prisma';

export class SettingsRepository {
  async get(key: string): Promise<string | null> {
    const setting = await prisma.gatewaySettings.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await prisma.gatewaySettings.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await prisma.gatewaySettings.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }
}

export const settingsRepository = new SettingsRepository();
