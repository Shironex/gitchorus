import { Injectable } from '@nestjs/common';
import { BaseLogService } from '../shared/base-log.service';

@Injectable()
export class ReviewLogService extends BaseLogService {
  constructor() {
    super('review');
  }
}
