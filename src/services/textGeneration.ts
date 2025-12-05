import OpenAI from 'openai';

export interface TextGenerationResponse {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class TextGenerationService {
  private openai: OpenAI;

  constructor(apiKey: string, baseURL: string = "https://dashscope.aliyuncs.com/compatible-mode/v1") {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL
    });
  }

  /**
   * 获取支持的文本生成模型列表
   */
  static getSupportedModels(): Array<{ 
    value: string; 
    name: string; 
    description: string;
    supportsThinking?: boolean;
    supportsVision?: boolean;
  }> {
    return [
      {
        value: 'qwen-turbo',
        name: 'Qwen Turbo',
        description: '快速响应，适合日常对话',
        supportsThinking: false,
        supportsVision: false
      },
      {
        value: 'qwen-plus',
        name: 'Qwen Plus',
        description: '均衡性能，适合大多数场景',
        supportsThinking: false,
        supportsVision: false
      },
      {
        value: 'qwen-max',
        name: 'Qwen Max',
        description: '最强性能，适合复杂任务',
        supportsThinking: true,
        supportsVision: false
      },
      {
        value: 'qwen-long',
        name: 'Qwen Long',
        description: '长文本处理，支持超长上下文',
        supportsThinking: false,
        supportsVision: false
      },
      {
        value: 'qwen3-vl-plus',
        name: 'Qwen3-VL-Plus',
        description: '视觉语言模型，支持图片理解',
        supportsThinking: false,
        supportsVision: true
      },
      {
        value: 'qwen3-vl-flash',
        name: 'Qwen3-VL-Flash',
        description: 'Qwen3系列小尺寸视觉理解模型，支持思考模式与视觉理解',
        supportsThinking: true,
        supportsVision: true
      }
    ];
  }

  /**
   * 提取文本中的图片URL
   * @param text 输入文本
   * @returns 包含图片URL数组和处理后文本的对象
   */
  static extractImageUrls(text: string): { images: string[]; text: string } {
    // 支持的图片后缀
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    
    // 匹配URL的正则表达式
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    
    // 过滤出图片URL
    const imageUrls = urls.filter(url => {
      const lowerUrl = url.toLowerCase();
      return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
             lowerUrl.includes('img.alicdn.com') ||
             lowerUrl.includes('image') ||
             lowerUrl.includes('pic') ||
             lowerUrl.includes('photo');
    });
    
    // 从文本中移除图片URL
    let cleanedText = text;
    imageUrls.forEach(url => {
      cleanedText = cleanedText.replace(url, '').trim();
    });
    
    return {
      images: imageUrls,
      text: cleanedText
    };
  }

  /**
   * 使用 OpenAI SDK 进行文本生成（支持多模态）
   * @param prompt 用户输入的提示词
   * @param model 使用的模型名称
   * @param enableThinking 是否启用深度思考模式
   * @param supportsVision 模型是否支持视觉能力（外部传入）
   * @returns 生成的文本内容和 token 使用量
   */
  async generateTextWithUsage(
    prompt: string, 
    model: string = 'qwen-plus', 
    enableThinking: boolean = false,
    supportsVision?: boolean
  ): Promise<{ content: string; totalTokens: number }> {
    try {
      // 提取图片URL
      const { images, text } = TextGenerationService.extractImageUrls(prompt);
      
      // 构建消息内容
      let userContent: any = text;
      
      // 获取模型信息以判断是否支持视觉
      const modelInfo = TextGenerationService.getSupportedModels().find(m => m.value === model);
      const modelSupportsVision = supportsVision !== undefined ? supportsVision : (modelInfo?.supportsVision || false);
      
      // 如果有图片且模型支持视觉，构建多模态消息
      if (images.length > 0 && modelSupportsVision) {
        userContent = [
          ...images.map(img => ({ type: "image_url", image_url: { url: img } })),
          { type: "text", text }
        ];
      }
      
      const requestBody: any = {
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: userContent }
        ],
      };
      
      // 如果启用深度思考模式，添加 extra_body 参数
      if (enableThinking) {
        requestBody.extra_body = {
          enable_thinking: true,
          thinking_budget: 81920  // 设置最大推理过程 Token 数
        };
      }
      
      const completion = await this.openai.chat.completions.create(requestBody);
      
      if (completion.choices && completion.choices.length > 0) {
        let content = completion.choices[0].message.content || '未获取到回复内容';
        
        // 如果启用了思考模式，尝试从响应中获取思考内容
        if (enableThinking && (completion.choices[0].message as any).thinking) {
          const thinking = (completion.choices[0].message as any).thinking;
          content = `思考过程：\n${thinking}\n\n回复：\n${content}`;
        }
        
        // 如果检测到图片且模型支持视觉，在回复中注明
        if (images.length > 0 && modelSupportsVision) {
          content = `[已识别并处理 ${images.length} 张图片]\n\n${content}`;
        } else if (images.length > 0 && !modelSupportsVision) {
          content = `[注意：检测到 ${images.length} 张图片链接，但当前模型不支持图片理解]\n\n${content}`;
        }
        
        return {
          content: content,
          totalTokens: completion.usage?.total_tokens || 0
        };
      }
      
      throw new Error('文本生成失败: 未获取到有效回复');
    } catch (error: any) {
      if (error.status) {
        // API 返回了错误状态码
        throw new Error(`API 请求失败 (${error.status}): ${error.message || error.error?.message || JSON.stringify(error)}`);
      } else {
        throw new Error(`文本生成失败: ${error.message}`);
      }
    }
  }

  /**
   * 使用 OpenAI SDK 进行文本生成（兼容旧版本）
   * @param prompt 用户输入的提示词
   * @param model 使用的模型名称
   * @returns 生成的文本内容
   */
  async generateText(prompt: string, model: string = 'qwen-plus'): Promise<string> {
    const result = await this.generateTextWithUsage(prompt, model);
    return result.content;
  }

  /**
   * 流式文本生成（如果需要的话）
   * @param prompt 用户输入的提示词
   * @param model 使用的模型名称
   * @param onChunk 接收到数据块时的回调函数
   */
  async generateTextStream(
    prompt: string, 
    model: string = 'qwen-plus',
    onChunk: (chunk: string) => void
  ): Promise<string> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt }
        ],
        stream: true,
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }
      
      return fullResponse;
    } catch (error: any) {
      if (error.status) {
        throw new Error(`API 请求失败 (${error.status}): ${error.message || error.error?.message || JSON.stringify(error)}`);
      } else {
        throw new Error(`流式文本生成失败: ${error.message}`);
      }
    }
  }
}