import { Controller, Get } from '@nestjs/common';
import { LtaDataMallService } from './lta-datamall.service';
import { OneMapService } from './onemap.service';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly lta: LtaDataMallService,
    private readonly oneMap: OneMapService,
  ) {}

  @Get('status')
  status() {
    return { ltaDataMall: this.lta.status(), oneMap: this.oneMap.status() };
  }
}
