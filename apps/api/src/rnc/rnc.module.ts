import { Module } from '@nestjs/common';
import { RncService } from './rnc.service';
import { RncController } from './rnc.controller';

@Module({
  controllers: [RncController],
  providers: [RncService],
  exports: [RncService],
})
export class RncModule {}
