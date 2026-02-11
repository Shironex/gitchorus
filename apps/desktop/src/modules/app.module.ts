import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { GitModule } from './git';
import { ProviderModule } from './provider';
import { ValidationModule } from './validation';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: true,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000, // 1 second window
        limit: 100, // max 100 requests per second (desktop app — single user)
      },
      {
        name: 'medium',
        ttl: 10000, // 10 second window
        limit: 500, // max 500 requests per 10 seconds
      },
    ]),
    GitModule,
    ProviderModule,
    ValidationModule,
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AppModule {}
