import { Module } from '@nestjs/common';
import { StationsModule } from '../stations/stations.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [StationsModule],
  providers: [SessionsService],
  controllers: [SessionsController],
})
export class SessionsModule {}
