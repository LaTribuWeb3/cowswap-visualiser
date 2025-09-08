import { CowOrder, CowBatch, CowApiResponse } from '../types/cow-protocol';

export class CowApiService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'https://api.cow.fi', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Fetch orders from CoW Protocol API
   */
  async fetchOrders(params: {
    limit?: number;
    offset?: number;
    status?: string;
    owner?: string;
  }): Promise<CowApiResponse<CowOrder[]>> {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.status) queryParams.append('status', params.status);
      if (params.owner) queryParams.append('owner', params.owner);

      const response = await fetch(`${this.baseUrl}/orders?${queryParams}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as CowOrder[];
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch batches from CoW Protocol API
   */
  async fetchBatches(params: {
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<CowApiResponse<CowBatch[]>> {
    try {
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.offset) queryParams.append('offset', params.offset.toString());
      if (params.status) queryParams.append('status', params.status);

      const response = await fetch(`${this.baseUrl}/batches?${queryParams}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as CowBatch[];
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Fetch a specific order by UID
   */
  async fetchOrder(uid: string): Promise<CowApiResponse<CowOrder>> {
    try {
      const response = await fetch(`${this.baseUrl}/orders/${uid}`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as CowOrder;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }
}
