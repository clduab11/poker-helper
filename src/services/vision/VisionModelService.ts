import { Logger } from '../../utils/logger';
import axios, { AxiosInstance } from 'axios';

export interface VisionModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

export interface VisionAnalysisRequest {
  imageData: Buffer | string; // Base64 or Buffer
  prompt: string;
  context?: string;
}

export interface VisionAnalysisResponse {
  analysis: string;
  confidence?: number;
  metadata?: Record<string, any>;
}

export class VisionModelService {
  private config: VisionModelConfig;
  private logger: Logger;
  private httpClient: AxiosInstance;

  constructor(config: VisionModelConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize HTTP client with base configuration
    this.httpClient = axios.create({
      baseURL: this.getBaseURL(),
      timeout: config.timeout || 30000,
      headers: this.getHeaders(),
    });
  }

  private getBaseURL(): string {
    if (this.config.baseURL) {
      return this.config.baseURL;
    }

    switch (this.config.provider) {
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'anthropic':
        return 'https://api.anthropic.com/v1';
      case 'google':
        return 'https://generativelanguage.googleapis.com/v1beta';
      default:
        throw new Error(`Base URL required for provider: ${this.config.provider}`);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    switch (this.config.provider) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = this.config.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      case 'google':
        // Google uses API key in URL params
        break;
      case 'custom':
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        break;
    }

    return headers;
  }

  public async analyzeImage(request: VisionAnalysisRequest): Promise<VisionAnalysisResponse> {
    try {
      const startTime = performance.now();
      
      // Convert image data to base64 if needed
      const base64Image = this.prepareImageData(request.imageData);
      
      // Build request based on provider
      const apiRequest = this.buildProviderRequest(base64Image, request.prompt, request.context);
      
      // Make API call
      const response = await this.makeAPICall(apiRequest);
      
      // Parse response based on provider
      const result = this.parseProviderResponse(response.data);
      
      const duration = performance.now() - startTime;
      this.logger.debug(`Vision analysis completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      this.logger.error('Vision analysis failed', error);
      throw error;
    }
  }

  private prepareImageData(imageData: Buffer | string): string {
    if (typeof imageData === 'string') {
      // Already base64
      return imageData.replace(/^data:image\/\w+;base64,/, '');
    } else {
      // Convert Buffer to base64
      return imageData.toString('base64');
    }
  }

  private buildProviderRequest(
    base64Image: string,
    prompt: string,
    context?: string
  ): any {
    const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

    switch (this.config.provider) {
      case 'openai':
        return {
          model: this.config.model || 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: fullPrompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: this.config.maxTokens || 500,
          temperature: this.config.temperature || 0.7,
        };

      case 'anthropic':
        return {
          model: this.config.model || 'claude-3-opus-20240229',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: fullPrompt,
                },
              ],
            },
          ],
          max_tokens: this.config.maxTokens || 500,
          temperature: this.config.temperature || 0.7,
        };

      case 'google':
        return {
          contents: [
            {
              parts: [
                {
                  text: fullPrompt,
                },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: this.config.temperature || 0.7,
            maxOutputTokens: this.config.maxTokens || 500,
          },
        };

      default:
        // Custom provider - assume OpenAI-compatible format
        return {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: fullPrompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: this.config.maxTokens || 500,
          temperature: this.config.temperature || 0.7,
        };
    }
  }

  private async makeAPICall(request: any): Promise<any> {
    let endpoint: string;
    let params: any = {};

    switch (this.config.provider) {
      case 'openai':
      case 'custom':
        endpoint = '/chat/completions';
        break;
      case 'anthropic':
        endpoint = '/messages';
        break;
      case 'google':
        endpoint = `/models/${this.config.model}:generateContent`;
        params = { key: this.config.apiKey };
        break;
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    return await this.httpClient.post(endpoint, request, { params });
  }

  private parseProviderResponse(response: any): VisionAnalysisResponse {
    let analysis: string;
    let confidence: number | undefined;
    let metadata: Record<string, any> = {};

    switch (this.config.provider) {
      case 'openai':
      case 'custom':
        analysis = response.choices[0].message.content;
        metadata = {
          model: response.model,
          usage: response.usage,
        };
        break;

      case 'anthropic':
        analysis = response.content[0].text;
        metadata = {
          model: response.model,
          usage: response.usage,
        };
        break;

      case 'google':
        analysis = response.candidates[0].content.parts[0].text;
        metadata = {
          model: this.config.model,
          safetyRatings: response.candidates[0].safetyRatings,
        };
        break;

      default:
        throw new Error(`Cannot parse response for provider: ${this.config.provider}`);
    }

    return {
      analysis,
      confidence,
      metadata,
    };
  }

  public async analyzePokerTable(imageData: Buffer | string): Promise<VisionAnalysisResponse> {
    const prompt = `Analyze this poker table screenshot and extract:
1. Player positions and chip counts
2. Community cards (if any)
3. Current bet amounts
4. Pot size
5. Game phase (preflop/flop/turn/river)
6. Any visible player actions

Format the response as structured data.`;

    const context = `You are analyzing a CoinPoker table screenshot. 
Focus on extracting game state information accurately. 
Pay attention to OCR-challenging elements like card suits and bet amounts.`;

    return this.analyzeImage({
      imageData,
      prompt,
      context,
    });
  }

  public updateConfig(newConfig: Partial<VisionModelConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize HTTP client with new config
    this.httpClient = axios.create({
      baseURL: this.getBaseURL(),
      timeout: this.config.timeout || 30000,
      headers: this.getHeaders(),
    });
  }
}