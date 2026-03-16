// src/settings/settings.controller.ts
import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/auth/roles.guard';
import { Roles } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';
import { SettingsService } from './settings.service';
@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // Public endpoint for the Mobile App to fetch global variables on startup
  @Get('public')
  getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  // Admin-only endpoint to view all system settings
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  // Admin-only endpoint to update a setting (e.g., changing 'MAX_DAILY_TRANSFER')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Put(':key')
  async updateSetting(@Param('key') key: string, @Body('value') value: string) {
    const updatedSetting = await this.settingsService.updateSetting(key, value);
    // Refresh the in-memory cache so the backend instantly uses the new value
    await this.settingsService.refreshCache();
    return updatedSetting;
  }
}
