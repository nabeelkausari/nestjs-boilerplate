import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RouteService } from './route.service';

@Injectable()
export class LoadBalancerService {
  private readonly logger = new Logger(LoadBalancerService.name);
  private readonly serviceEndpoints: Map<
    string,
    { index: number; urls: string[] }
  > = new Map();

  constructor(private readonly routeService: RouteService) {}

  async getServiceInstance(serviceId: string): Promise<string> {
    let endpoints = this.serviceEndpoints.get(serviceId);

    // Always refresh endpoints to ensure we have the latest status
    const urls = await this.routeService.getActiveEndpoints(serviceId);
    if (!urls || urls.length === 0) {
      throw new ServiceUnavailableException('Service Unavailable');
    }
    endpoints = { index: 0, urls };
    this.serviceEndpoints.set(serviceId, endpoints);

    if (!endpoints.urls || endpoints.urls.length === 0) {
      throw new ServiceUnavailableException('Service Unavailable');
    }

    // Round-robin selection
    const url = endpoints.urls[endpoints.index];
    endpoints.index = (endpoints.index + 1) % endpoints.urls.length;

    return url;
  }

  async refreshEndpoints(serviceId: string): Promise<void> {
    const urls = await this.routeService.getActiveEndpoints(serviceId);
    this.serviceEndpoints.set(serviceId, { index: 0, urls });
  }

  async clearEndpoints(serviceId: string): Promise<void> {
    this.serviceEndpoints.delete(serviceId);
  }

  async clearAllEndpoints(): Promise<void> {
    this.serviceEndpoints.clear();
  }
}
