import { Module, Global } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { CacheService } from './cache.service';
import { TenantAuthGuard } from './guards/tenant-auth.guard';
import { ProductionReadinessGuard } from './guards/production-readiness.guard';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [AuthModule],
  providers: [CryptoService, CacheService, TenantAuthGuard, ProductionReadinessGuard],
  exports: [CryptoService, CacheService, TenantAuthGuard, ProductionReadinessGuard, AuthModule],
})
export class CommonModule {}
