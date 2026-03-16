import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  private cache = new Map<string, string>();

  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache(): Promise<void> {
    const settings = await this.settingsRepository.find();
    this.cache.clear();

    for (const setting of settings) {
      this.cache.set(setting.key, setting.value);
    }
  }

  async getPublicSettings(): Promise<Record<string, string | null>> {
    const settings = await this.settingsRepository.find({
      where: { isPublic: true },
      order: { key: 'ASC' },
    });

    return settings.reduce(
      (acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      },
      {} as Record<string, string | null>,
    );
  }

  async getAllSettings(): Promise<Setting[]> {
    return this.settingsRepository.find({
      order: { key: 'ASC' },
    });
  }

  async getSettingValue(key: string): Promise<string | null> {
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    const setting = await this.settingsRepository.findOne({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    this.cache.set(setting.key, setting.value);
    return setting.value;
  }

  async updateSetting(key: string, value: string): Promise<Setting> {
    let setting = await this.settingsRepository.findOne({
      where: { key },
    });

    if (!setting) {
      throw new NotFoundException(`Setting not found: ${key}`);
    }

    setting.value = value;
    setting = await this.settingsRepository.save(setting);

    this.cache.set(setting.key, setting.value);
    return setting;
  }

  async createSetting(data: {
    key: string;
    value: string;
    isPublic?: boolean;
    description?: string;
  }): Promise<Setting> {
    const setting = this.settingsRepository.create({
      key: data.key,
      value: data.value,
      isPublic: data.isPublic ?? false,
      description: data.description,
    });

    const saved = await this.settingsRepository.save(setting);
    this.cache.set(saved.key, saved.value);
    return saved;
  }
}
