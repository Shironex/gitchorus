import { Injectable } from '@nestjs/common';
import { BaseLogService } from '../shared/base-log.service';

@Injectable()
export class ValidationLogService extends BaseLogService {
  constructor() {
    super('validation');
  }
}
