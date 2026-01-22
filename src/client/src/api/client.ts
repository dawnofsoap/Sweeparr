const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  // Try to parse JSON, but handle empty responses
  let data: any;
  const text = await response.text();
  
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    // If JSON parsing fails, wrap the text in an error
    if (!response.ok) {
      throw new ApiError(text || `HTTP ${response.status}`, response.status);
    }
    // For successful responses with invalid JSON, return empty object
    data = {};
  }
  
  if (!response.ok) {
    // Handle various error response formats
    let errorMessage = 'An error occurred';
    if (typeof data.error === 'string') {
      errorMessage = data.error;
    } else if (data.error?.message) {
      errorMessage = data.error.message;
    } else if (data.message) {
      errorMessage = data.message;
    }
    
    throw new ApiError(errorMessage, response.status, data);
  }
  
  return data;
}

export async function get<T>(endpoint: string): Promise<T> {
  // Use Cache-Control header to prevent caching instead of URL manipulation
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Cache-Control': 'no-cache',
    },
  });
  return handleResponse<T>(response);
}

export async function post<T>(endpoint: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return handleResponse<T>(response);
}

export async function put<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function del<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
  });
  return handleResponse<T>(response);
}
